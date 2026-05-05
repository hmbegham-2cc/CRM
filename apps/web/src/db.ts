import { supabase } from "./supabase";
import type {
  Campaign,
  DailyReport,
  NotificationRow,
  Role,
  Team,
  UserRow,
} from "@crc/types";
import { diag, classifyError } from "./lib/diag";

let campaignsLiteCache: { data: Campaign[]; at: number } | null = null;
let usersLiteCache: { data: Pick<UserRow, "id" | "name" | "email" | "role" | "active">[]; at: number } | null = null;
const LITE_CACHE_TTL_MS = 60_000;

// ── Helpers ────────────────────────────────────────────────

function fail(error: { message?: string } | null | undefined, fallback: string): never {
  throw new Error(error?.message || fallback);
}

async function failFunction(error: unknown, fallback: string): Promise<never> {
  const context = (error as any)?.context;
  if (context instanceof Response) {
    try {
      const body = await context.clone().json();
      const message = body?.error || body?.message || body?.warning;
      if (message) throw new Error(message);
    } catch (jsonErr) {
      if (jsonErr instanceof Error && jsonErr.message !== "Unexpected end of JSON input") {
        throw jsonErr;
      }
      try {
        const text = await context.clone().text();
        if (text) throw new Error(text);
      } catch {
        // Fall through to the Supabase error message below.
      }
    }
  }

  throw new Error((error as any)?.message || fallback);
}

const DATA_OPERATION_TIMEOUT_MS = 25_000;

function withOperationTimeout<T>(name: string, promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DOMException(`Opération DB trop longue: ${name}`, "TimeoutError"));
    }, DATA_OPERATION_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Wraps a data-access promise so every call gets logged with its name and
 * duration. Network admins / support can grep the console for `[CRC db]`.
 *
 * Important: the custom fetch timeout in supabase.ts only starts once the
 * browser fetch() is called. Supabase can occasionally wait before that
 * (session/token queue, browser wake-up, extension interference), which left
 * screens stuck on "Chargement...". This timeout caps the whole DB operation.
 */
async function track<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  diag.info("db", `→ ${name}`);
  try {
    const out = await withOperationTimeout(name, fn());
    const ms = Math.round(performance.now() - start);
    diag.info("db", `✓ ${name} (${ms}ms)`);
    return out;
  } catch (err) {
    const ms = Math.round(performance.now() - start);
    const { category, detail } = classifyError(err);
    diag.error("db", `✗ ${name} failed after ${ms}ms — ${category}: ${detail}`, err);
    throw err;
  }
}

async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Non authentifié");
  return user;
}

// ── Campaigns ──────────────────────────────────────────────

export async function getCampaigns(): Promise<Campaign[]> {
  return track("getCampaigns", async () => {
    const { data, error } = await supabase
      .from("Campaign")
      .select(`*, members:CampaignMember(id, endDate, user:User(id, name, email))`)
      .order("name");
    if (error) fail(error, "Impossible de charger les campagnes");
    return (data || []).map((c: any) => ({
      ...c,
      members: (c.members || []).filter((m: any) => !m.endDate),
    }));
  });
}

export async function getCampaignsLite(options?: { force?: boolean }): Promise<Campaign[]> {
  return track("getCampaignsLite", async () => {
    const now = Date.now();
    if (!options?.force && campaignsLiteCache && now - campaignsLiteCache.at < LITE_CACHE_TTL_MS) {
      return campaignsLiteCache.data;
    }

    const { data, error } = await supabase
      .from("Campaign")
      .select("id, name, active")
      .order("name");
    if (error) fail(error, "Impossible de charger les campagnes");
    const result = (data || []).map((c: any) => ({
      ...c,
      members: [],
    })) as Campaign[];
    campaignsLiteCache = { data: result, at: now };
    return result;
  });
}

export async function createCampaign(name: string) {
  const { data, error } = await supabase
    .from("Campaign")
    .insert({ name: name.trim(), active: true })
    .select()
    .single();
  if (error) fail(error, "Impossible de créer la campagne");
  return data;
}

export async function updateCampaign(id: string, updates: { name?: string; active?: boolean }) {
  const { data, error } = await supabase
    .from("Campaign")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) fail(error, "Impossible de mettre à jour la campagne");
  return data;
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from("Campaign").delete().eq("id", id);
  if (error) fail(error, "Impossible de supprimer la campagne");
}

// ── Teams ──────────────────────────────────────────────────

export async function assignTeam(campaignId: string, userIds: string[]) {
  return track(`assignTeam(${campaignId}, ${userIds.length} users)`, async () => {
    const { data, error } = await supabase.rpc("assign_team", {
      p_campaign_id: campaignId,
      p_user_ids: userIds,
    });
    if (error) fail(error, "Impossible d'assigner l'équipe");
    if (data?.error) throw new Error(data.error);
    return data;
  });
}

/**
 * Assign a single user to a set of campaigns.
 *
 * The underlying `assign_team(campaign, users[])` RPC overwrites the full
 * member list of a campaign. To assign one user to multiple campaigns we
 * therefore have to:
 *  1. Find which campaigns the user must be added to (was not member, now is).
 *  2. Find which campaigns the user must be removed from (was member, now isn't).
 *  3. For each affected campaign, rebuild the full member list and call assignTeam.
 *
 * `allCampaigns` is the in-memory list returned by `getCampaigns()` — passing
 * it in keeps this synchronous from the API's point of view.
 */
export async function assignUserCampaigns(
  userId: string,
  desiredCampaignIds: string[],
  allCampaigns: Campaign[],
): Promise<{ added: number; removed: number }> {
  return track(
    `assignUserCampaigns(${userId}, ${desiredCampaignIds.length} campaigns)`,
    async () => {
      const desired = new Set(desiredCampaignIds);
      const toAdd: Campaign[] = [];
      const toRemove: Campaign[] = [];

      for (const c of allCampaigns) {
        const isMember = (c as any).members?.some((m: any) => m.user?.id === userId);
        const shouldBeMember = desired.has(c.id);
        if (shouldBeMember && !isMember) toAdd.push(c);
        else if (!shouldBeMember && isMember) toRemove.push(c);
      }

      const errors: string[] = [];

      // Sequential calls keep RLS / DB-side validation in assign_team consistent
      // (each call sees a stable snapshot of CampaignMember rows).
      for (const c of toAdd) {
        const memberIds = ((c as any).members || []).map((m: any) => m.user.id);
        const next = Array.from(new Set([...memberIds, userId]));
        try {
          await assignTeam(c.id, next);
        } catch (err: any) {
          errors.push(`${c.name}: ${err?.message || "erreur"}`);
        }
      }
      for (const c of toRemove) {
        const memberIds = ((c as any).members || [])
          .map((m: any) => m.user.id)
          .filter((id: string) => id !== userId);
        try {
          await assignTeam(c.id, memberIds);
        } catch (err: any) {
          errors.push(`${c.name}: ${err?.message || "erreur"}`);
        }
      }

      if (errors.length > 0) {
        throw new Error(errors.join(" • "));
      }
      return { added: toAdd.length, removed: toRemove.length };
    },
  );
}

// ── Users ──────────────────────────────────────────────────

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  active: boolean;
  createdAt: string;
  campaignMemberships: { campaign: { name: string } }[];
};

export async function getUsers(): Promise<UserRow[]> {
  return track("getUsers", async () => {
    // Soft-deleted users (deletedAt IS NOT NULL) are excluded from every UI
    // list. Their underlying public.User row survives so their historical
    // reports keep resolving correctly in joins, but the admin should never
    // see them in pickers / management screens anymore.
    const { data, error } = await supabase
      .from("User")
      .select(
        `id, name, email, role, "active", "createdAt",
         campaignMemberships:CampaignMember(id, "endDate", campaign:Campaign(name))`,
      )
      .is("deletedAt", null)
      .order("name");
    if (error) fail(error, "Impossible de charger les utilisateurs");
    return (data || []).map((u: any) => ({
      ...u,
      active: u.active ?? true,
      campaignMemberships: (u.campaignMemberships || []).filter((m: any) => !m.endDate),
    }));
  });
}

export async function getUsersLite(options?: { force?: boolean }): Promise<Pick<UserRow, "id" | "name" | "email" | "role" | "active">[]> {
  return track("getUsersLite", async () => {
    const now = Date.now();
    if (!options?.force && usersLiteCache && now - usersLiteCache.at < LITE_CACHE_TTL_MS) {
      return usersLiteCache.data;
    }

    const { data, error } = await supabase
      .from("User")
      .select("id, name, email, role, active")
      .is("deletedAt", null)
      .order("name");
    if (error) fail(error, "Impossible de charger les utilisateurs");
    const result = (data || []).map((u: any) => ({
      ...u,
      active: u.active ?? true,
    }));
    usersLiteCache = { data: result, at: now };
    return result;
  });
}

export async function updateUserRole(userId: string, role: Role) {
  return track(`updateUserRole(${role})`, async () => {
    const { data, error } = await supabase.functions.invoke("update-role", {
      body: { userId, role },
    });
    if (error) await failFunction(error, "Impossible de mettre à jour le rôle");
    if (data?.error) throw new Error(data.error);
    return data;
  });
}

// ── Reports ────────────────────────────────────────────────

type ReportFilters = {
  campaignId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  excludeStatus?: string; // exclude a single status (e.g. "REJECTED")
  statusIn?: string[]; // include only these statuses
};

export async function getReports(filters: ReportFilters = {}): Promise<DailyReport[]> {
  return track(`getReports(${JSON.stringify(filters)})`, async () => {
    let query = supabase
      .from("DailyReport")
      .select(
        `*,
         user:User!userId(id, name, email),
         campaign:Campaign(id, name),
         validatedBy:User!validatedById(id, name)`,
      )
      .order("date", { ascending: false })
      .limit(1000); // safety cap to prevent loading excessive rows

    if (filters.campaignId) query = query.eq("campaignId", filters.campaignId);
    if (filters.userId) query = query.eq("userId", filters.userId);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.excludeStatus) query = query.neq("status", filters.excludeStatus);
    if (filters.statusIn && filters.statusIn.length > 0) {
      query = query.in("status", filters.statusIn);
    }
    if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("date", filters.dateTo);

    const { data, error } = await query;
    if (error) fail(error, "Impossible de charger les rapports");
    return (data || []) as DailyReport[];
  });
}

export async function upsertReport(reportData: {
  date: string;
  campaignId: string;
  incomingTotal: number;
  outgoingTotal: number;
  handled: number;
  missed: number;
  rdvTotal: number;
  smsTotal: number;
  observations?: string;
}): Promise<{ id: string }> {
  const user = await requireUser();
  const now = new Date().toISOString();

  // Check for existing report (includes status to preserve it)
  const existing = await supabase
    .from("DailyReport")
    .select("id,status")
    .eq("date", reportData.date)
    .eq("campaignId", reportData.campaignId)
    .eq("userId", user.id)
    .maybeSingle();

  if (existing.error) fail(existing.error, "Impossible de vérifier le rapport existant");

  const existingStatus = (existing.data?.status as string | undefined) ?? null;
  const isNew = !existing.data?.id;

  // Only force DRAFT on insert; preserve existing status on update
  const payload = {
    ...reportData,
    userId: user.id,
    status: isNew ? "DRAFT" : (existingStatus ?? "DRAFT"),
    updatedAt: now,
  };

  const write = isNew
    ? await supabase
      .from("DailyReport")
      .insert({ id: crypto.randomUUID(), ...payload, createdAt: now })
      .select("id")
      .single()
    : await supabase
      .from("DailyReport")
      .update(payload)
      .eq("id", existing.data!.id)
      .select("id")
      .single();

  const { data, error } = write;
  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (error.code === "42501" || msg.includes("row-level security") || msg.includes("rls")) {
      throw new Error(
        "Vous ne pouvez enregistrer un rapport que sur une campagne qui vous est assignée.",
      );
    }
    fail(error, "Impossible d'enregistrer le rapport");
  }
  return data!;
}

export async function submitReport(id: string) {
  const { data, error } = await supabase.rpc("submit_report", { p_report_id: id });
  if (error) fail(error, "Impossible de soumettre le rapport");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function actionReport(id: string, action: "validate" | "reject", reason?: string) {
  const user = await requireUser();

  const { data, error } = await supabase.rpc("action_report", {
    p_report_id: id,
    p_action: action,
    p_validator_id: user.id,
    p_reason: reason || null,
  });
  if (error) fail(error, action === "validate" ? "Impossible de valider" : "Impossible de rejeter");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Notifications ──────────────────────────────────────────

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export async function getNotifications(): Promise<NotificationRow[]> {
  return track("getNotifications", async () => {
    const user = await requireUser();
    const { data, error } = await supabase
      .from("Notification")
      .select("*")
      .eq("userId", user.id)
      .order("createdAt", { ascending: false })
      .limit(50);
    if (error) fail(error, "Impossible de charger les notifications");
    return data || [];
  });
}

export async function markNotificationRead(id: string) {
  const user = await requireUser();
  const { error } = await supabase
    .from("Notification")
    .update({ read: true })
    .eq("id", id)
    .eq("userId", user.id);
  if (error) fail(error, "Impossible de marquer comme lue");
}

export async function markAllNotificationsRead() {
  const user = await requireUser();
  const { error } = await supabase
    .from("Notification")
    .update({ read: true })
    .eq("userId", user.id)
    .eq("read", false);
  if (error) fail(error, "Impossible de tout marquer comme lu");
}

export async function deleteNotification(id: string) {
  const user = await requireUser();
  const { error } = await supabase.from("Notification").delete().eq("id", id).eq("userId", user.id);
  if (error) fail(error, "Impossible de supprimer la notification");
}

export async function deleteAllNotifications() {
  const user = await requireUser();
  const { error } = await supabase.from("Notification").delete().eq("userId", user.id);
  if (error) fail(error, "Impossible de tout supprimer");
}

// ── Auth operations ────────────────────────────────────────

export async function inviteUser(email: string, name: string, role: Role) {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: { email, name, role },
  });
  if (error) await failFunction(error, "Impossible d'inviter l'utilisateur");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function resendInvite(userId: string) {
  const { data, error } = await supabase.functions.invoke("admin-user-action", {
    body: { action: "resend-invite", userId },
  });
  if (error) await failFunction(error, "Impossible de renvoyer l'invitation");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function deleteUser(userId: string) {
  const { data, error } = await supabase.functions.invoke("admin-user-action", {
    body: { action: "delete-user", userId },
  });
  if (error) await failFunction(error, "Impossible de supprimer l'utilisateur");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function setUserActive(userId: string, active: boolean) {
  const { data, error } = await supabase.rpc("set_user_active", {
    p_user_id: userId,
    p_active: active,
  });
  if (error) fail(error, "Impossible de modifier l'état du compte");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function forgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/setup-password`,
  });
  if (error) fail(error, "Impossible d'envoyer le lien de réinitialisation");
}

export async function changePassword(currentPassword: string, newPassword: string) {
  // Note: We intentionally do NOT use signInWithPassword here because it
  // refreshes the session and triggers onAuthStateChange events across the app.
  // The user is already authenticated (verified below), and Supabase requires
  // a valid session to call updateUser anyway.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user?.email) throw new Error("Non authentifié");

  // Verify current password via a lightweight RPC instead of full re-auth
  const { error: verifyError } = await supabase.rpc("verify_password", {
    p_password: currentPassword,
  });
  if (verifyError) throw new Error("Mot de passe actuel incorrect");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) fail(error, "Impossible de modifier le mot de passe");
}

export async function ensureUserRow(): Promise<void> {
  return track("ensureUserRow", async () => {
    const { error } = await supabase.rpc("ensure_user_row");
    if (error) fail(error, "Impossible de synchroniser votre profil");
  });
}

export async function setupPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) fail(error, "Impossible de configurer le mot de passe");
  // After first password set, public.User may still be missing if the DB
  // trigger never ran — repair so login / dashboard work immediately.
  await ensureUserRow();
}

// ── Export ─────────────────────────────────────────────────

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const XLS_MIME = "application/vnd.ms-excel";

export async function exportReports(
  campaignId: string | null,
  dateFrom?: string,
  dateTo?: string,
  groupBy: "campaign" | "all" = "campaign",
): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke("export-reports", {
    body: { campaignId: campaignId || null, dateFrom, dateTo, groupBy },
  });
  if (error) await failFunction(error, "Impossible d'exporter les rapports");

  // Robustly coerce the Edge Function response into a Blob with the correct MIME type.
  if (data instanceof Blob) {
    // If the SDK already parsed it as a Blob but lost the MIME type, re-wrap with the correct one.
    return data.type.includes("excel") || data.type.includes("xml")
      ? data
      : new Blob([data], { type: XLS_MIME });
  }
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    return new Blob([data], { type: XLS_MIME });
  }
  if (typeof data === "string") {
    return new Blob([data], { type: XLS_MIME });
  }
  // Fallback: try to stringify whatever we got
  return new Blob([JSON.stringify(data)], { type: XLS_MIME });
}

// ── Cron (admin) ───────────────────────────────────────────

export async function checkMissingReports(date?: string) {
  const { data, error } = await supabase.rpc("check_missing_reports", {
    p_date: date || null,
  });
  if (error) fail(error, "Impossible de vérifier les rapports manquants");
  return data;
}
