import { z } from "zod";

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const createCampaignSchema = z.object({
  name: z.string().min(1),
});

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
});

export const teamAssignmentSchema = z.object({
  campaignId: z.string(),
  userIds: z.array(z.string()),
});

export const updateUserRoleSchema = z.object({
  userId: z.string(),
  role: z.enum(["TELECONSEILLER", "SUPERVISEUR", "ADMIN"]),
});

export const reportUpsertSchema = z.object({
  date: z.string(),
  campaignId: z.string(),
  incomingTotal: z.number().int().min(0),
  outgoingTotal: z.number().int().min(0),
  handled: z.number().int().min(0),
  missed: z.number().int().min(0),
  rdvTotal: z.number().int().min(0),
  smsTotal: z.number().int().min(0),
  observations: z.string().optional(),
});

export const reportActionSchema = z.object({
  action: z.enum(["submit", "validate", "reject"]),
  reason: z.string().optional(),
});

export const inviteUserSchema = z.object({
  email: z.string().email().refine(e => e.endsWith("@2cconseil.com"), "Seul le domaine @2cconseil.com est autorisé"),
  name: z.string().min(2),
  role: z.enum(["TELECONSEILLER", "SUPERVISEUR", "ADMIN"]),
});

export const setupPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères"),
});
