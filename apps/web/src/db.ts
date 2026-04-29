import { supabase } from "./supabase";
import type { Campaign, DailyReport, Role } from "@crc/types";

// ── Campaigns ──────────────────────────────────────────────

export async function getCampaigns(): Promise<Campaign[]> {
  const { data, error } = await supabase
    .from("Campaign")
    .select(`*, members:CampaignMember!endDate(endDate, user:User(id, name, email))`)
    .order("name");
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  return data;
}

export async function updateCampaign(id: string, updates: { name?: string; active?: boolean }) {
  const { data, error } = await supabase
    .from("Campaign")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deleteCampaign(id: string) {
  const { error } = await supabase.from("Campaign").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Teams ──────────────────────────────────────────────────

export async function assignTeam(campaignId: string, userIds: string[]) {
  const { data, error } = await supabase.rpc("assign_team", {
    p_campaign_id: campaignId,
    p_user_ids: userIds,
  });
  if (error) throw new Error(error.message);
  return data;
}

// ── Users ──────────────────────────────────────────────────

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: Role;
  createdAt: string;
  campaignMemberships: { campaign: { name: string } }[];
};

export async function getUsers(): Promise<UserRow[]> {
  const { data, error } = await supabase
    .from("User")
    .select(`id, name, email, role, createdAt, campaignMemberships:CampaignMember!endDate(endDate, campaign:Campaign(name))`)
    .order("name");
  if (error) throw new Error(error.message);
  return (data || []).map((u: any) => ({
    ...u,
    campaignMemberships: (u.campaignMemberships || []).filter((m: any) => !m.endDate),
  }));
}

export async function updateUserRole(userId: string, role: Role) {
  const { data, error } = await supabase.functions.invoke("update-role", {
    body: { userId, role },
  });
  if (error) throw new Error(error.message);
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
  let query = supabase
    .from("DailyReport")
    .select(`*, user:User(id, name, email), campaign:Campaign(id, name), validatedBy:ValidatedBy(id, name)`)
    .order("date", { ascending: false });

  if (filters.campaignId) query = query.eq("campaignId", filters.campaignId);
  if (filters.userId) query = query.eq("userId", filters.userId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.dateFrom) query = query.gte("date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("date", filters.dateTo);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map((r: any) => ({
    ...r,
    date: r.date,
    submittedAt: r.submittedAt ?? null,
    validatedAt: r.validatedAt ?? null,
  }));
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data, error } = await supabase
    .from("DailyReport")
    .upsert(
      {
        ...reportData,
        date: reportData.date,
        userId: user.id,
        status: "DRAFT",
      },
      { onConflict: "date,campaignId,userId" }
    )
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function submitReport(id: string) {
  const { data, error } = await supabase.rpc("submit_report", { p_report_id: id });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function actionReport(id: string, action: "validate" | "reject", reason?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");

  const { data, error } = await supabase.rpc("action_report", {
    p_report_id: id,
    p_action: action,
    p_validator_id: user.id,
    p_reason: reason || null,
  });
  if (error) throw new Error(error.message);
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
  if (error) throw new Error(error.message);
  return data || [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase.from("Notification").update({ read: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  const { error } = await supabase
    .from("Notification")
    .update({ read: true })
    .eq("userId", user.id)
    .eq("read", false);
  if (error) throw new Error(error.message);
}

export async function deleteNotification(id: string) {
  const { error } = await supabase.from("Notification").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAllNotifications() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Non authentifié");
  const { error } = await supabase.from("Notification").delete().eq("userId", user.id);
  if (error) throw new Error(error.message);
}

// ── Auth operations ────────────────────────────────────────

export async function inviteUser(email: string, name: string, role: Role) {
  const { data, error } = await supabase.functions.invoke("invite-user", {
    body: { email, name, role },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function forgotPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/setup-password`,
  });
  if (error) throw new Error(error.message);
}

export async function changePassword(currentPassword: string, newPassword: string) {
  // Re-authenticate first to verify current password
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) throw new Error("Non authentifié");

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signInError) throw new Error("Mot de passe actuel incorrect");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

export async function setupPassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

// ── Export ──────────────────────────────────────────────────

export async function exportReports(campaignId: string, dateFrom?: string, dateTo?: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke("export-reports", {
    body: { campaignId, dateFrom, dateTo },
  });
  if (error) throw new Error(error.message);
  return data;
}

// ── Cron (admin) ────────────────────────────────────────────

export async function checkMissingReports(date?: string) {
  const { data, error } = await supabase.rpc("check_missing_reports", {
    p_date: date || null,
  });
  if (error) throw new Error(error.message);
  return data;
}
