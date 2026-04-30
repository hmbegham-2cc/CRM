import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VALID_ROLES = ["TELECONSEILLER", "SUPERVISEUR", "ADMIN", "COACH_QUALITE"] as const;
// Roles that COACH_QUALITE is allowed to assign (cannot promote to ADMIN or COACH_QUALITE)
const COACH_ASSIGNABLE_ROLES = ["TELECONSEILLER", "SUPERVISEUR"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    const callerRole = callerProfile?.role;
    if (callerRole !== "ADMIN" && callerRole !== "COACH_QUALITE") {
      throw new Error("Accès refusé : admin ou coach qualité uniquement");
    }

    const { userId, role } = await req.json();
    if (!userId || !role) throw new Error("userId et role requis");
    if (!VALID_ROLES.includes(role)) throw new Error("Rôle invalide");

    // COACH_QUALITE can only assign TELECONSEILLER or SUPERVISEUR
    if (callerRole === "COACH_QUALITE" && !COACH_ASSIGNABLE_ROLES.includes(role as any)) {
      throw new Error("Le Coach Qualité ne peut attribuer que les rôles Téléconseiller et Superviseur");
    }

    // Prevent demoting the last admin
    if (role !== "ADMIN") {
      const { count: adminCount } = await supabase
        .from("User")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN");
      const { data: target } = await supabase
        .from("User")
        .select("role")
        .eq("id", userId)
        .single();
      if (target?.role === "ADMIN" && (adminCount ?? 0) <= 1) {
        throw new Error("Impossible de retirer le dernier administrateur");
      }
    }

    const { error: dbError } = await supabase
      .from("User")
      .update({ role })
      .eq("id", userId);
    if (dbError) throw dbError;

    // Sync role into JWT app_metadata so RLS / claims see the latest role
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    });
    if (authError) throw authError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
