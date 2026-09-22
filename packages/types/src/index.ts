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
  connectionTime: number;
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

// ── Qualité (écoutes) ───────────────────────────────────────

export interface QualityCriterion {
  id: string;
  domain: string;
  name: string;
  maxPoints: number;
  blocking: boolean;
  allowThree: boolean;
  expected: string;
  rubrics?: Record<string, string>;
}

export interface QualityReferentialThresholds {
  plafondMinusOne: number;
  plafondBlocking: number;
  conformeMin: number;
  coachingMax: number;
  mentionExcellent: number;
  mentionTresSatisfaisant: number;
  mentionSatisfaisant: number;
  mentionAmeliorer: number;
}

export interface QualityReferentialConfig {
  criteria: QualityCriterion[];
  thresholds: QualityReferentialThresholds;
}

export type QualityScores = Record<string, number>;

export interface QualityComputed {
  totalPoints: number;
  finalScore: number;
  finalPercent: number;
  mention: string;
  status: string;
  improvementAreas: string;
  coachingPriority: boolean;
  immediateAction: boolean;
  conform: boolean;
  hasMinusOne: boolean;
  blockingFail: boolean;
  cap: number;
}

export interface QualityEvaluation {
  id: string;
  evaluatedAt: string;
  externalCallId: string | null;
  channel: string;
  scores: QualityScores;
  totalPoints: number;
  finalScore: number;
  finalPercent: number;
  mention: string;
  status: string;
  improvementAreas: string | null;
  coachingPriority: boolean;
  immediateAction: boolean;
  conform: boolean;
  positivePoints: string | null;
  actionPlan: string | null;
  comments: Record<string, string>;
  debriefDate: string | null;
  debriefConclusion: string | null;
  createdAt: string;
  updatedAt: string;
  agent: { id: string; name: string | null; email: string };
  evaluator: { id: string; name: string | null; email: string };
  campaign: { id: string; name: string } | null;
}
