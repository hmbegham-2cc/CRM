export type Role = "TELECONSEILLER" | "SUPERVISEUR" | "ADMIN" | "COACH_QUALITE";
export type ReportStatus = "DRAFT" | "SUBMITTED" | "VALIDATED" | "REJECTED";

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  role: Role;
}

export interface Campaign {
  id: string;
  name: string;
  active: boolean;
  members: { user: { id: string; name: string | null; email: string | null } }[];
}

export interface DailyReport {
  id: string;
  date: string;
  incomingTotal: number;
  outgoingTotal: number;
  handled: number;
  missed: number;
  rdvTotal: number;
  smsTotal: number;
  observations: string | null;
  rejectionReason: string | null;
  status: ReportStatus;
  user: { id: string; name: string | null; email: string | null };
  campaign: { id: string; name: string };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}
