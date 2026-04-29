import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is authenticated
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user: caller } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!caller) throw new Error("Non autorisé");

    // Check caller is ADMIN
    const { data: callerProfile } = await supabase
      .from("User")
      .select("role")
      .eq("id", caller.id)
      .single();
    if (callerProfile?.role !== "ADMIN") throw new Error("Accès refusé : admin uniquement");

    const { email, name, role } = await req.json();
    if (!email || !name || !role) throw new Error("email, name, role requis");
    if (!email.endsWith("@2cconseil.com")) throw new Error("Seuls les emails @2cconseil.com sont autorisés");

    // Check if user already exists
    const { data: existing } = await supabase
      .from("User")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();
    if (existing) throw new Error("Cet email est déjà utilisé");

    // Create auth user with invite — Supabase sends a confirmation email
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: { name, role },
      redirectTo: `${new URL(req.url).origin}/setup-password`,
    });
    if (authError) throw authError;

    // The trigger will auto-create the User row with the role from metadata
    // But we need to update the name since the trigger uses a default
    await supabase
      .from("User")
      .update({ name, role })
      .eq("id", authData.user.id);

    // Send Brevo welcome email
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");
    if (BREVO_API_KEY) {
      try {
        await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subject: "Bienvenue sur CRC Reporting !",
            htmlContent: `
              <html><body style="font-family: Arial, sans-serif; color: #1e293b;">
                <div style="max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
                  <h1 style="color: #2563eb;">Bienvenue sur CRC Reporting !</h1>
                  <p>Nous sommes ravis de vous compter parmi nous.</p>
                  <p>Votre compte a été créé. Cliquez sur le lien dans l'email de confirmation pour configurer votre mot de passe.</p>
                </div>
              </body></html>
            `,
            sender: { name: "CRC Reporting", email: "serviceclient@2cconseil.com" },
            to: [{ email, name }],
          }),
        });
      } catch (e) {
        console.error("[BREVO ERROR]", e);
      }
    }

    return new Response(JSON.stringify({ ok: true, message: "Utilisateur invité avec succès" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
