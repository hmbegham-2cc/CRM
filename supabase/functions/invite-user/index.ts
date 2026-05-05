import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("FRONTEND_URL") ?? "https://crm-api-rose.vercel.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = ["TELECONSEILLER", "SUPERVISEUR", "ADMIN", "COACH_QUALITE"] as const;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://crm-api-rose.vercel.app";
    // Optional: set ALLOWED_EMAIL_DOMAIN to restrict invites to a specific domain (e.g. "2cconseil.com")
    const ALLOWED_DOMAIN = Deno.env.get("ALLOWED_EMAIL_DOMAIN") ?? "";

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Verify caller and ADMIN role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Non autorisé");
    const { data: { user: caller } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (!caller) throw new Error("Non autorisé");

    const { data: callerProfile } = await supabase
      .from("User")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (!callerProfile?.role || !["ADMIN", "COACH_QUALITE"].includes(callerProfile.role)) {
      throw new Error("Accès refusé : admin ou coach qualité uniquement");
    }

    // 2. Validate input
    const { email: rawEmail, name, role } = await req.json();
    if (!rawEmail || !name || !role) throw new Error("email, name et role requis");
    const email = String(rawEmail).toLowerCase().trim();
    const trimmedName = String(name).trim();
    if (ALLOWED_DOMAIN && !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
      throw new Error(`Seuls les emails @${ALLOWED_DOMAIN} sont autorisés`);
    }
    if (!VALID_ROLES.includes(role)) {
      throw new Error("Rôle invalide");
    }

    // 3. Check existing user (only block if NOT soft-deleted)
    const { data: existing } = await supabase
      .from("User")
      .select("id, deletedAt")
      .eq("email", email)
      .maybeSingle();
    if (existing && !existing.deletedAt) throw new Error("Cet email est déjà utilisé");

    // 4. Generate invite link WITHOUT sending Supabase's default email.
    //    The `generateLink({ type: 'invite' })` call creates auth.users (and auth.identities)
    //    AND returns a one-time recovery URL we can embed in our own Brevo email.
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: { name: trimmedName, role },
        redirectTo: `${FRONTEND_URL}/setup-password`,
      },
    });
    if (linkError) throw linkError;

    const actionLink = (linkData as any)?.properties?.action_link;
    const userId = (linkData as any)?.user?.id;
    if (!actionLink || !userId) {
      throw new Error("Échec de la génération du lien d'invitation");
    }

    // 5. Ensure public.User exists with the right name + role.
    //    generateLink creates auth.users (trigger *should* insert public.User)
    //    but if the trigger was never deployed, UPDATE touches 0 rows and the
    //    invited user can never log in. Upsert fixes both cases.
    const now = new Date().toISOString();
    const { error: userErr } = await supabase.from("User").upsert(
      {
        id: userId,
        email,
        name: trimmedName,
        role,
        active: true,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      { onConflict: "id" },
    );
    if (userErr) throw userErr;

    const { error: notifErr } = await supabase.from("Notification").insert({
      userId,
      title: "Bienvenue sur CRC Reporting",
      message: `Bienvenue ${trimmedName} ! Votre compte a été créé. Configurez votre mot de passe pour commencer.`,
      type: "info",
      read: false,
      createdAt: new Date().toISOString(),
    });
    if (notifErr) {
      console.warn("[invite-user] welcome notification failed", notifErr);
    }

    // 6. Send the invite email via Brevo (single email — no duplicates)
    if (!BREVO_API_KEY) {
      console.warn("[invite-user] BREVO_API_KEY missing — invite link generated but not emailed");
      return new Response(
        JSON.stringify({
          ok: true,
          action_link: actionLink,
          message:
            "Utilisateur créé. BREVO_API_KEY manquante : copiez le lien d'invitation depuis cette réponse.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const html = `<html><body style="font-family: Arial, sans-serif; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
        <h1 style="color: #2563eb;">Bienvenue sur CRC Reporting !</h1>
        <p>Bonjour ${escapeHtml(trimmedName)},</p>
        <p>Un compte vient d'être créé pour vous sur la plateforme <strong>CRC Reporting</strong>.</p>
        <p>Pour configurer votre mot de passe et accéder à votre espace, cliquez sur le bouton ci-dessous :</p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${actionLink}"
             style="background:#2563eb; color:#fff; padding:14px 28px; text-decoration:none; border-radius:8px; display:inline-block; font-weight:bold;">
             Configurer mon compte
          </a>
        </div>
        <p style="font-size:14px; color:#64748b;">Ce lien est personnel et expire après usage.</p>
        <hr style="border:none; border-top:1px solid #e2e8f0; margin: 32px 0;" />
        <p style="font-size:12px; color:#94a3b8; text-align:center;">
          Si le bouton ne s'affiche pas, copiez ce lien :<br />
          <span style="word-break: break-all;">${actionLink}</span>
        </p>
      </div>
    </body></html>`;

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "Bienvenue sur CRC Reporting !",
        htmlContent: html,
        sender: { name: "CRC Reporting", email: "serviceclient@2cconseil.com" },
        to: [{ email, name: trimmedName }],
      }),
    });
    if (!brevoRes.ok) {
      const errText = await brevoRes.text();
      console.error("[BREVO ERROR]", brevoRes.status, errText);
      return new Response(
        JSON.stringify({
          ok: true,
          warning: "Utilisateur créé, mais l'email d'invitation n'a pas pu être envoyé via Brevo.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true, message: "Utilisateur invité avec succès" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
