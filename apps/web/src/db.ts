import { supabase } from "./supabase";
import type { Campaign, DailyReport, Role } from "@crc/types";

// ── Helpers ────────────────────────────────────────────────

function fail(error: { message?: string } | null | undefined, fallback: string): never {
  throw new Error(error?.message || fallback);
}

async function requireUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Non authentifié");
  return user;
}

// ── Campaigns ──────────────────────────────────────────────

export async function getCampaigns(): Promise<Campaign[]> {
  // Single FK Campaign↔CampaignMember (campaignId): no need to disambiguate.
  // We fetch all members then filter active ones (endDate IS NULL) client-side.
  const { data, error } = await supabase
    .from("Campaign")
    .select(`*, members:CampaignMember(id, endDate, user:User(id, name, email))`)
    .order("name");
  if (error) fail(error, "Impossible de charger les campagnes");
  return (data || []).map((c: any) => ({
    ...c,
    members: (c.members || []).filter((m: any) => !m.endDate),
  }));
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
  const { data, error } = await supabase.rpc("assign_team", {
    p_campaign_id: campaignId,
    p_user_ids: userIds,
  });
  if (error) fail(error, "Impossible d'assigner l'équipe");
  if (data?.error) throw new Error(data.error);
  return data;
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
  const { data, error } = await supabase
    .from("User")
    .select(
      `id, name, email, role, "active", "createdAt",
       campaignMemberships:CampaignMember(id, "endDate", campaign:Campaign(name))`,
    )
    .order("name");
  if (error) fail(error, "Impossible de charger les utilisateurs");
  return (data || []).map((u: any) => ({
    ...u,
    active: u.active ?? true,
    campaignMemberships: (u.campaignMemberships || []).filter((m: any) => !m.endDate),
  }));
}

export async function updateUserRole(userId: string, role: Role) {
  const { data, error } = await supabase.functions.invoke("update-role", {
    body: { userId, role },
  });
  if (error) fail(error, "Impossible de mettre à jour le rôle");
  if (data?.error) throw new Error(data.error);
  return data;
}

// ── Reports ────────────────────────────────────────────────

type ReportFilters = {
  campaignId?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
};

export async function getReports(filters: ReportFilters = {}): Promise<DailyReport[]> {
  // DailyReport has TWO FKs to User (userId and validatedById):
  // disambiguate by FK column name (PostgREST embedded resource hint).
  let query = supabase
    .from("DailyReport")
    .select(
      `*,
       user:User!userId(id, name, email),
       campaign:Campaign(id, name),
       validatedBy:User!validatedById(id, name)`,
    )
    .order("date", { ascending: false });

  if (filters.campaignId) query = query.eq("campaignId", filters.campaignId);
  if (filters.userId) query = query.eq("userId", filters.userId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("date", filters.dateTo);

  const { data, error } = await query;
  if (error) fail(error, "Impossible de charger les rapports");
  return (data || []) as DailyReport[];
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

  const { data, error } = await supabase
    .from("DailyReport")
    .upsert(
      {
        ...reportData,
        userId: user.id,
        status: "DRAFT",
      },
      { onConflict: "date,campaignId,userId" },
    )
    .select("id")
    .single();
  if (error) fail(error, "Impossible d'enregistrer le rapport");
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
  const { data, error } = await supabase
    .from("Notification")
    .select("*")
    .order("createdAt", { ascending: false })
    .limit(50);
  if (error) fail(error, "Impossible de charger les notifications");
  return data || [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("Notification").update({ read: true }).eq("id", id);
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
  const { error } = await supabase.from("Notification").delete().eq("id", id);
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
  if (error) fail(error, "Impossible d'inviter l'utilisateur");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function resendInvite(userId: string) {
  const { data, error } = await supabase.functions.invoke("admin-user-action", {
    body: { action: "resend-invite", userId },
  });
  if (error) fail(error, "Impossible de renvoyer l'invitation");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function deleteUser(userId: string) {
  const { data, error } = await supabase.functions.invoke("admin-user-action", {
    body: { action: "delete-user", userId },
  });
  if (error) fail(error, "Impossible de supprimer l'utilisateur");
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
  // Note: signInWithPassword refreshes the session but does NOT log out.
  // We use it to verify the current password without disrupting the session.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Non authentifié");

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) throw new Error("Mot de passe actuel incorrect");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) fail(error, "Impossible de modifier le mot de passe");
}

export async function setupPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) fail(error, "Impossible de configurer le mot de passe");
}

// ── Export ─────────────────────────────────────────────────

export async function exportReports(
  campaignId: string,
  dateFrom?: string,
  dateTo?: string,
): Promise<Blob> {
  // The export-reports Edge Function returns text/csv (not JSON).
  // Supabase JS v2 returns a Blob for non-JSON content-types when invoked via .invoke().
  // We normalize to a Blob regardless to keep callers simple.
  const { data, error } = await supabase.functions.invoke("export-reports", {
    body: { campaignId, dateFrom, dateTo },
  });
  if (error) fail(error, "Impossible d'exporter les rapports");

  if (data instanceof Blob) return data;
  if (typeof data === "string") {
    return new Blob([data], { type: "text/csv;charset=utf-8" });
  }
  // Fallback: shouldn't happen but be safe (some SDK versions return ArrayBuffer)
  return new Blob([data as BlobPart], { type: "text/csv;charset=utf-8" });
}

// ── Cron (admin) ───────────────────────────────────────────

export async function checkMissingReports(date?: string) {
  const { data, error } = await supabase.rpc("check_missing_reports", {
    p_date: date || null,
  });
  if (error) fail(error, "Impossible de vérifier les rapports manquants");
  return data;
}
