import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? new URL(req.url).origin;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Verify caller is ADMIN
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
    if (callerProfile?.role !== "ADMIN") {
      throw new Error("Accès refusé : admin uniquement");
    }

    // 2. Dispatch action
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "resend-invite") {
      const userId = String(body.userId || "");
      if (!userId) throw new Error("userId requis");

      // Find the auth user
      const { data: { user: target }, error: getErr } =
        await supabase.auth.admin.getUserById(userId);
      if (getErr || !target?.email) throw new Error("Utilisateur introuvable");

      const { data: profile } = await supabase
        .from("User")
        .select("name, role")
        .eq("id", userId)
        .single();

      // Generate fresh invite link without sending the default email
      const { data: linkData, error: linkErr } =
        await supabase.auth.admin.generateLink({
          type: target.email_confirmed_at ? "recovery" : "invite",
          email: target.email,
          options: { redirectTo: `${FRONTEND_URL}/setup-password` },
        });
      if (linkErr) throw linkErr;
      const actionLink = (linkData as any)?.properties?.action_link;
      if (!actionLink) throw new Error("Échec de la génération du lien");

      if (!BREVO_API_KEY) {
        return new Response(
          JSON.stringify({
            ok: true,
            action_link: actionLink,
            warning: "BREVO_API_KEY manquante : copiez le lien ci-dessus pour l'utilisateur",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const subject = target.email_confirmed_at
        ? "Réinitialisation de votre mot de passe — CRC Reporting"
        : "Bienvenue sur CRC Reporting !";
      const intro = target.email_confirmed_at
        ? "Vous avez demandé la réinitialisation de votre mot de passe."
        : "Un compte vient d'être créé pour vous sur la plateforme CRC Reporting.";
      const cta = target.email_confirmed_at
        ? "Réinitialiser mon mot de passe"
        : "Configurer mon compte";

      const html = `<html><body style="font-family: Arial, sans-serif; color: #1e293b;">
        <div style="max-width:600px; margin:0 auto; border:1px solid #e2e8f0; border-radius:12px; padding:24px;">
          <h1 style="color:#2563eb;">${escapeHtml(subject)}</h1>
          <p>Bonjour ${escapeHtml(profile?.name || "")},</p>
          <p>${intro}</p>
          <div style="text-align:center; margin:32px 0;">
            <a href="${actionLink}" style="background:#2563eb; color:#fff; padding:14px 28px; text-decoration:none; border-radius:8px; display:inline-block; font-weight:bold;">${cta}</a>
          </div>
          <p style="font-size:14px; color:#64748b;">Ce lien est personnel et expire après usage.</p>
          <hr style="border:none; border-top:1px solid #e2e8f0; margin:32px 0;" />
          <p style="font-size:12px; color:#94a3b8; text-align:center;">
            Si le bouton ne fonctionne pas, copiez ce lien :<br />
            <span style="word-break:break-all;">${actionLink}</span>
          </p>
        </div>
      </body></html>`;

      const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          htmlContent: html,
          sender: { name: "CRC Reporting", email: "serviceclient@2cconseil.com" },
          to: [{ email: target.email, name: profile?.name || target.email }],
        }),
      });
      if (!brevoRes.ok) {
        const errText = await brevoRes.text();
        console.error("[BREVO ERROR]", brevoRes.status, errText);
        return new Response(
          JSON.stringify({
            ok: true,
            warning: "Lien généré mais l'email n'a pas pu être envoyé via Brevo",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-user") {
      const userId = String(body.userId || "");
      if (!userId) throw new Error("userId requis");
      if (userId === caller.id) throw new Error("Vous ne pouvez pas vous supprimer vous-même");

      // Last-admin guard
      const { data: target } = await supabase
        .from("User")
        .select("role")
        .eq("id", userId)
        .single();
      if (target?.role === "ADMIN") {
        const { count: adminCount } = await supabase
          .from("User")
          .select("id", { count: "exact", head: true })
          .eq("role", "ADMIN");
        if ((adminCount ?? 0) <= 1) {
          throw new Error("Impossible de supprimer le dernier administrateur");
        }
      }

      // Cascade: User_id_fkey ON DELETE CASCADE removes public.User row
      const { error: delErr } = await supabase.auth.admin.deleteUser(userId);
      if (delErr) throw delErr;

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Action inconnue");
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
