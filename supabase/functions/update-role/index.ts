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

    const { userId, role } = await req.json();
    if (!userId || !role) throw new Error("userId et role requis");

    // Update public.User table
    const { error: dbError } = await supabase
      .from("User")
      .update({ role })
      .eq("id", userId);
    if (dbError) throw dbError;

    // Update auth.users app_metadata so role is in the JWT
    const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    });
    if (authError) throw authError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
