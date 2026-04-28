import "dotenv/config";
import cors from "cors";
import express from "express";
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";
import { requireAuth, requireRole, signToken } from "./auth.js";
import type { AuthRequest } from "./types.js";
import {
  changePasswordSchema,
  createCampaignSchema,
  forgotPasswordSchema,
  inviteUserSchema,
  loginRequestSchema,
  reportActionSchema,
  reportUpsertSchema,
  setupPasswordSchema,
  teamAssignmentSchema,
  updateCampaignSchema,
  updateUserRoleSchema,
} from "./contracts.js";
import cron from "node-cron";
import crypto from "crypto";
import * as Brevo from "@getbrevo/brevo";
import bcrypt from "bcryptjs";

const isVercel = Boolean(process.env.VERCEL);

// Prisma client singleton for serverless
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function getBrevoClient() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY manquant (configure-le dans apps/api/.env)");
  }

  const BrevoAny = Brevo as any;
  const apiInstance = new BrevoAny.TransactionalEmailsApi();

  // Selon versions du SDK, l'injection de clé peut varier.
  if (typeof apiInstance.setApiKey === "function" && BrevoAny.TransactionalEmailsApiApiKeys?.apiKey) {
    apiInstance.setApiKey(BrevoAny.TransactionalEmailsApiApiKeys.apiKey, apiKey);
  } else if ((apiInstance as any).authentications?.apiKey) {
    (apiInstance as any).authentications.apiKey.apiKey = apiKey;
  } else if ((apiInstance as any).authentications?.partnerKey) {
    (apiInstance as any).authentications.partnerKey.apiKey = apiKey;
  } else {
    // Dernier recours
    (apiInstance as any).apiKey = apiKey;
  }

  return { apiInstance, BrevoAny };
}

function formatBrevoError(err: unknown): string {
  const anyErr = err as any;
  const status = anyErr?.status ?? anyErr?.statusCode;
  const body = anyErr?.response?.body ?? anyErr?.body ?? anyErr?.response?.data;
  const message = anyErr?.message;
  try {
    return JSON.stringify({ status, message, body });
  } catch {
    return String(message ?? err);
  }
}

async function sendBrevoEmail(
  to: { email: string; name?: string },
  subject: string,
  htmlContent: string,
  tag: string,
): Promise<{ ok: boolean }> {
  try {
    const { apiInstance, BrevoAny } = getBrevoClient();
    const sendSmtpEmail = new BrevoAny.SendSmtpEmail();
    sendSmtpEmail.subject = subject;
    sendSmtpEmail.htmlContent = htmlContent;
    sendSmtpEmail.sender = { name: "CRC Reporting", email: "serviceclient@2cconseil.com" };
    sendSmtpEmail.to = [{ email: to.email, name: to.name || "" }];
    await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log(`[BREVO] Mail ${tag} envoyé avec succès à ${to.email}`);
    return { ok: true };
  } catch (error) {
    console.error(`[BREVO ERROR] Erreur envoi mail ${tag} à ${to.email}: ${formatBrevoError(error)}`);
    return { ok: false };
  }
}

async function checkMissingReports(forDate?: Date) {
  console.log("[CRON] Vérification des rapports manquants...");
  const day = forDate ? new Date(forDate) : new Date();
  if (!forDate) day.setDate(day.getDate() - 1);
  day.setHours(0, 0, 0, 0);
  const dayEnd = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  // 1. Trouver tous les membres actifs sur la date ciblée
  const members = await prisma.campaignMember.findMany({
    where: {
      startDate: { lte: day },
      OR: [{ endDate: null }, { endDate: { gte: day } }],
    },
    include: {
      user: true,
      campaign: true,
    },
  });

  let created = 0;
  for (const member of members) {
    if (member.user.role === "ADMIN") continue;

    // 2. Vérifier si un rapport existe pour la date ciblée
    const report = await prisma.dailyReport.findFirst({
      where: {
        userId: member.userId,
        campaignId: member.campaignId,
        date: { gte: day, lt: dayEnd },
        status: { in: ["SUBMITTED", "VALIDATED"] },
      },
      select: { id: true },
    });

    if (report) continue;

    const msg = `Votre rapport du ${day.toLocaleDateString("fr-FR")} pour la campagne ${member.campaign.name} n'a pas été soumis. Merci de le compléter.`;

    // Déduplication: éviter de créer plusieurs fois la même notif (ex: si la tâche est relancée)
    const existing = await prisma.notification.findFirst({
      where: {
        userId: member.userId,
        title: "Rapport manquant",
        message: msg,
        createdAt: { gte: day },
      },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        userId: member.userId,
        title: "Rapport manquant",
        message: msg,
        type: "warning",
      },
    });
    created++;
    console.log(`[CRON] Rapport manquant → notification créée pour ${member.user.email} sur ${member.campaign.name}`);
  }
  return { ok: true, date: day.toISOString().slice(0, 10), created };
}

// Tâche planifiée : Rapport manquant (chaque jour à 08h00)
if (!isVercel) {
  cron.schedule("0 8 * * *", async () => {
    try {
      await checkMissingReports();
    } catch (e) {
      console.error("[CRON] Erreur vérification rapports manquants", e);
    }
  });
}

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: isVercel ? true : (process.env.CORS_ORIGIN ?? "http://localhost:5173"),
  }),
);

app.get("/api/v1/health", (_req, res) => res.json({ ok: true }));

// Endpoint manuel (dev/ops) pour tester la création des notifications de rapports manquants
app.post("/api/v1/cron/check-missing-reports", requireAuth, requireRole(["ADMIN", "SUPERVISEUR"]), async (req, res) => {
  const body = (req.body ?? {}) as { date?: string };
  const d = body.date ? new Date(body.date) : undefined;
  const result = await checkMissingReports(d);
  res.json(result);
});

app.post("/api/v1/auth/login", async (req, res) => {
  const parsed = loginRequestSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.email.endsWith("@2cconseil.com") || !user.password || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }

  const payload = { id: user.id, email: user.email, name: user.name, role: user.role };
  const token = signToken(payload);
  return res.json({ token, user: payload });
});

app.get("/api/v1/auth/me", requireAuth, (req: AuthRequest, res) => {
  res.json(req.user);
});

app.post("/api/v1/auth/invite", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const parsed = inviteUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email, name, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(400).json({ error: "Cet email est déjà utilisé" });

  const setupToken = crypto.randomBytes(32).toString("hex");
  
  const user = await (prisma.user as any).create({
    data: {
      email,
      name,
      role,
      setupToken,
    }
  });

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

  const htmlContent = `
    <html>
      <body style="font-family: Arial, sans-serif; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
          <h1 style="color: #2563eb;">Bienvenue sur CRC Reporting !</h1>
          <p>Nous sommes ravis de vous compter parmi nous sur <strong>CRC Reporting</strong>.</p>
          <p>Votre compte a été créé avec succès par l'administration. Vous pouvez désormais accéder à votre espace de travail pour gérer vos rapports et suivre vos indicateurs.</p>
          <p style="margin-top: 32px;">Pour finaliser votre inscription et choisir votre mot de passe, veuillez cliquer sur le bouton ci-dessous :</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${frontendUrl}/setup-password?token=${setupToken}" 
               style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
               Configurer mon compte
            </a>
          </div>
          <p style="font-size: 14px; color: #64748b;">Ce lien de sécurité est personnel et expirera après votre première configuration.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            Si le bouton ne s'affiche pas, copiez ce lien : <br/>
            ${frontendUrl}/setup-password?token=${setupToken}
          </p>
        </div>
      </body>
    </html>
  `;

  const mail = await sendBrevoEmail({ email, name }, "Bienvenue sur CRC Reporting !", htmlContent, "INVITE");

  res.status(201).json({
    ok: true,
    message: mail.ok
      ? "Utilisateur invité avec succès"
      : "Utilisateur invité, mais l'email n'a pas pu être envoyé (vérifiez BREVO_API_KEY / logs API)",
  });
});

app.post("/api/v1/auth/setup-password", async (req, res) => {
  const parsed = setupPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { token, password } = parsed.data;
  const user = await (prisma.user as any).findUnique({ where: { setupToken: token } });
  
  if (!user) return res.status(400).json({ error: "Lien invalide ou expiré" });

  const hashed = await bcrypt.hash(password, 10);
  await (prisma.user as any).update({
    where: { id: user.id },
    data: {
      password: hashed,
      setupToken: null,
    }
  });

  res.json({ ok: true, message: "Mot de passe configuré avec succès. Vous pouvez maintenant vous connecter." });
});

app.post("/api/v1/auth/forgot-password", async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Toujours répondre ok pour ne pas révéler si l'email existe
  if (!user || !user.email.endsWith("@2cconseil.com")) {
    return res.json({ ok: true, message: "Si cet email existe, un lien de réinitialisation a été envoyé." });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  await (prisma.user as any).update({
    where: { id: user.id },
    data: { setupToken: resetToken },
  });

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

  const htmlContent = `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1e293b;">
          <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
            <h1 style="color: #2563eb;">Réinitialisation du mot de passe</h1>
            <p>Bonjour ${user.name || ''},</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>CRC Reporting</strong>.</p>
            <p style="margin-top: 32px;">Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${frontendUrl}/setup-password?token=${resetToken}" 
                 style="background-color: #2563eb; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">
                 Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="font-size: 14px; color: #64748b;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
            <p style="font-size: 12px; color: #94a3b8; text-align: center;">
              Si le bouton ne s'affiche pas, copiez ce lien : <br/>
              ${frontendUrl}/setup-password?token=${resetToken}
            </p>
          </div>
        </body>
      </html>
    `;

  await sendBrevoEmail(
    { email: user.email, name: user.name || "" },
    "Réinitialisation de votre mot de passe - CRC Reporting",
    htmlContent,
    "RESET",
  );

  res.json({ ok: true, message: "Si cet email existe, un lien de réinitialisation a été envoyé." });
});

app.post("/api/v1/auth/change-password", requireAuth, async (req: AuthRequest, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success || !req.user) return res.status(400).json({ error: parsed.success ? "User missing" : parsed.error.flatten() });

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user || !user.password || !(await bcrypt.compare(parsed.data.currentPassword, user.password))) {
    return res.status(400).json({ error: "Mot de passe actuel incorrect" });
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hashed } });
  res.json({ ok: true, message: "Mot de passe modifié avec succès" });
});

app.get("/api/v1/campaigns", requireAuth, async (_req, res) => {
  const req = _req as AuthRequest;

  const include = {
    members: {
      where: { endDate: null },
      include: { user: { select: { id: true, name: true, email: true } } },
    },
  };

  // ADMIN et SUPERVISEUR : voient toutes les campagnes
  if (req.user?.role === "ADMIN" || req.user?.role === "SUPERVISEUR") {
    const campaigns = await prisma.campaign.findMany({ orderBy: { name: "asc" }, include });
    res.json(campaigns);
    return;
  }

  // TELECONSEILLER : uniquement les campagnes auxquelles il est assigné
  const memberships = await prisma.campaignMember.findMany({
    where: { userId: req.user!.id, endDate: null },
    select: { campaignId: true },
  });
  const campaignIds = memberships.map((m) => m.campaignId);
  const campaigns = await prisma.campaign.findMany({
    where: { id: { in: campaignIds } },
    orderBy: { name: "asc" },
    include,
  });
  res.json(campaigns);
});

app.post("/api/v1/campaigns", requireAuth, requireRole(["ADMIN", "SUPERVISEUR"]), async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const campaign = await prisma.campaign.create({ data: { name: parsed.data.name.trim(), active: true } });
  res.status(201).json(campaign);
});

app.put("/api/v1/campaigns/:id", requireAuth, requireRole(["ADMIN", "SUPERVISEUR"]), async (req, res) => {
  const parsed = updateCampaignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const campaign = await prisma.campaign.update({ where: { id: String(req.params.id) }, data: parsed.data });
  res.json(campaign);
});

app.delete("/api/v1/campaigns/:id", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  await prisma.campaign.delete({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});

app.post("/api/v1/teams", requireAuth, requireRole(["ADMIN", "SUPERVISEUR"]), async (req, res) => {
  const parsed = teamAssignmentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { campaignId, userIds } = parsed.data;

  await prisma.campaignMember.updateMany({ where: { campaignId, endDate: null }, data: { endDate: new Date() } });
  if (userIds.length > 0) {
    await prisma.campaignMember.createMany({
      data: userIds.map((userId) => ({ campaignId, userId })),
    });
  }

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      members: {
        where: { endDate: null },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  res.json(campaign);
});

app.get("/api/v1/users", requireAuth, requireRole(["ADMIN"]), async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      campaignMemberships: {
        where: { endDate: null },
        select: { campaignId: true, campaign: { select: { name: true } } },
      },
    },
  });
  res.json(users);
});

app.patch("/api/v1/users", requireAuth, requireRole(["ADMIN"]), async (req, res) => {
  const parsed = updateUserRoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const user = await prisma.user.update({ where: { id: parsed.data.userId }, data: { role: parsed.data.role } });
  res.json(user);
});

app.get("/api/v1/reports", requireAuth, async (req: AuthRequest, res) => {
  const first = (value: unknown) => (Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined);
  const campaignId = first(req.query.campaignId);
  const userId = first(req.query.userId);
  const dateFrom = first(req.query.dateFrom);
  const dateTo = first(req.query.dateTo);
  const status = first(req.query.status);

  const where: Record<string, unknown> = {};
  if (campaignId) where.campaignId = campaignId;
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }
  if (req.user?.role === "TELECONSEILLER") {
    // Le téléconseiller ne voit QUE ses propres rapports
    where.userId = req.user.id;
    
    // Il ne voit que les rapports des campagnes auxquelles il est assigné
    const userCampaigns = await prisma.campaignMember.findMany({
      where: { userId: req.user.id, endDate: null },
      select: { campaignId: true }
    });
    const campaignIds = userCampaigns.map(c => c.campaignId);
    
    if (campaignId) {
      where.campaignId = campaignIds.includes(campaignId) ? campaignId : { in: [] };
    } else {
      where.campaignId = { in: campaignIds };
    }
  } else if (req.user?.role === "SUPERVISEUR") {
    // Le superviseur ne voit que les rapports des campagnes auxquelles il est assigné
    const managedCampaigns = await prisma.campaignMember.findMany({
      where: { userId: req.user.id, endDate: null },
      select: { campaignId: true }
    });
    const campaignIds = managedCampaigns.map(c => c.campaignId);
    
    if (campaignId) {
      // Si un filtre est appliqué, on vérifie qu'il a le droit
      where.campaignId = campaignIds.includes(campaignId) ? campaignId : { in: [] };
    } else {
      where.campaignId = { in: campaignIds };
    }

    // Si un filtre userId est demandé, on le restreint aux utilisateurs des campagnes qu'il gère
    if (userId) {
      const allowedUserIds = await prisma.campaignMember.findMany({
        where: { campaignId: { in: campaignIds }, endDate: null },
        select: { userId: true },
      });
      const set = new Set(allowedUserIds.map((x) => x.userId));
      if (!set.has(userId)) {
        where.userId = { in: [] };
      }
    }
  }
  // L'ADMIN voit tout

  const reports = await prisma.dailyReport.findMany({
    where,
    orderBy: [{ date: "desc" }, { campaignId: "asc" }],
    include: {
      user: { select: { id: true, name: true, email: true } },
      campaign: { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
    },
  });
  res.json(
    reports.map((r) => ({
      ...r,
      date: r.date.toISOString(),
      submittedAt: r.submittedAt?.toISOString() ?? null,
      validatedAt: r.validatedAt?.toISOString() ?? null,
    })),
  );
});

app.post("/api/v1/reports", requireAuth, async (req: AuthRequest, res) => {
  const parsed = reportUpsertSchema.safeParse(req.body);
  if (!parsed.success || !req.user) return res.status(400).json({ error: parsed.success ? "User missing" : parsed.error.flatten() });
  const data = parsed.data;

  // Interdire la saisie si l'utilisateur n'est pas membre actif de la campagne (ADMIN exempté)
  if (req.user.role !== "ADMIN") {
    const membership = await prisma.campaignMember.findFirst({
      where: { userId: req.user.id, campaignId: data.campaignId, endDate: null },
      select: { userId: true },
    });
    if (!membership) {
      return res.status(403).json({ error: "Vous n'êtes pas assigné à cette campagne" });
    }
  }

  const date = new Date(data.date);
  const report = await prisma.dailyReport.upsert({
    where: { date_campaignId_userId: { date, campaignId: data.campaignId, userId: req.user.id } },
    create: { ...data, date, userId: req.user.id, status: "DRAFT" },
    update: {
      incomingTotal: data.incomingTotal,
      outgoingTotal: data.outgoingTotal,
      handled: data.handled,
      missed: data.missed,
      rdvTotal: data.rdvTotal,
      smsTotal: data.smsTotal,
      observations: data.observations,
    },
  });
  res.status(201).json({ ...report, date: report.date.toISOString() });
});

app.patch("/api/v1/reports/:id", requireAuth, async (req: AuthRequest, res) => {
  const parsed = reportActionSchema.safeParse(req.body);
  if (!parsed.success || !req.user) return res.status(400).json({ error: parsed.success ? "User missing" : parsed.error.flatten() });
  const report = await prisma.dailyReport.findUnique({ where: { id: String(req.params.id) } });
  if (!report) return res.status(404).json({ error: "Rapport introuvable" });

  if (parsed.data.action === "submit") {
    if (report.userId !== req.user.id) return res.status(403).json({ error: "Action non autorisée" });
    const updated = await prisma.dailyReport.update({
      where: { id: report.id },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    return res.json(updated);
  }

  if (!["ADMIN", "SUPERVISEUR"].includes(req.user.role)) return res.status(403).json({ error: "Accès refusé" });
  const updated = await prisma.dailyReport.update({
    where: { id: report.id },
    data: {
      status: parsed.data.action === "validate" ? "VALIDATED" : "REJECTED",
      validatedAt: new Date(),
      validatedById: req.user.id,
      ...(parsed.data.action === "reject" ? { rejectionReason: parsed.data.reason || null } : {}),
    },
  });
  // Notifier le téléconseiller
  if (parsed.data.action === "validate") {
    await notifyUser(report.userId, "Rapport validé", `Votre rapport du ${report.date.toLocaleDateString('fr-FR')} a été validé par ${req.user.name || "un superviseur"}.`, "success");
  } else {
    const reasonText = parsed.data.reason ? ` Raison : ${parsed.data.reason}` : "";
    await notifyUser(report.userId, "Rapport rejeté", `Votre rapport du ${report.date.toLocaleDateString('fr-FR')} a été rejeté.${reasonText} Merci de le corriger et le resoumettre.`, "error");
  }
  return res.json(updated);
});

app.get("/api/v1/export", requireAuth, requireRole(["ADMIN", "SUPERVISEUR"]), async (req, res) => {
  const first = (value: unknown) => (Array.isArray(value) ? value[0] : typeof value === "string" ? value : undefined);
  const campaignId = first(req.query.campaignId);
  if (!campaignId) return res.status(400).json({ error: "campaignId requis" });

  const dateFrom = first(req.query.dateFrom);
  const dateTo = first(req.query.dateTo);
  const where: Record<string, unknown> = { campaignId };
  if (dateFrom || dateTo) {
    where.date = {
      ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
      ...(dateTo ? { lte: new Date(dateTo) } : {}),
    };
  }

  const reports = await prisma.dailyReport.findMany({
    where,
    orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
    include: { user: { select: { name: true, email: true } }, campaign: { select: { name: true } } },
  });

  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Reporting");
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Conseiller", key: "conseiller", width: 24 },
    { header: "Reçus", key: "incoming", width: 12 },
    { header: "Émis", key: "outgoing", width: 12 },
    { header: "Traités", key: "handled", width: 12 },
    { header: "Manqués", key: "missed", width: 12 },
    { header: "RDV", key: "rdv", width: 12 },
    { header: "SMS", key: "sms", width: 12 },
    { header: "Statut", key: "status", width: 14 },
  ];
  for (const r of reports) {
    sheet.addRow({
      date: r.date.toLocaleDateString("fr-FR"),
      conseiller: r.user.name ?? r.user.email ?? "",
      incoming: r.incomingTotal,
      outgoing: r.outgoingTotal,
      handled: r.handled,
      missed: r.missed,
      rdv: r.rdvTotal,
      sms: r.smsTotal,
      status: r.status,
    });
  }
  const data = await wb.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="reporting_${Date.now()}.xlsx"`);
  res.send(data);
});

// ── Notifications ────────────────────────────────────────────────────────────

app.get("/api/v1/notifications", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Non autorisé" });
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json(notifications.map(n => ({ ...n, createdAt: n.createdAt.toISOString() })));
});

app.patch("/api/v1/notifications/:id/read", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Non autorisé" });
  const notification = await prisma.notification.findUnique({ where: { id: String(req.params.id) } });
  if (!notification || notification.userId !== req.user.id) {
    return res.status(404).json({ error: "Notification introuvable" });
  }
  const updated = await prisma.notification.update({ where: { id: notification.id }, data: { read: true } });
  res.json({ ...updated, createdAt: updated.createdAt.toISOString() });
});

app.patch("/api/v1/notifications/read-all", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Non autorisé" });
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
});

app.delete("/api/v1/notifications/:id", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Non autorisé" });
  const notification = await prisma.notification.findUnique({ where: { id: String(req.params.id) } });
  if (!notification || notification.userId !== req.user.id) {
    return res.status(404).json({ error: "Notification introuvable" });
  }
  await prisma.notification.delete({ where: { id: notification.id } });
  res.json({ ok: true });
});

app.delete("/api/v1/notifications", requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: "Non autorisé" });
  await prisma.notification.deleteMany({ where: { userId: req.user.id } });
  res.json({ ok: true });
});

// Créer une notification (utilisé en interne)
async function notifyUser(userId: string, title: string, message: string, type = "info") {
  await prisma.notification.create({ data: { userId, title, message, type } });
}

if (!isVercel) {
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

export default app;
