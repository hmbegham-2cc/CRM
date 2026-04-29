import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { campaignId, dateFrom, dateTo } = await req.json();
    if (!campaignId) throw new Error("campaignId requis");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Build query for reports
    let query = `select=date,campaign:Campaign(name),user:User(name,email),incomingTotal,outgoingTotal,handled,missed,rdvTotal,smsTotal,status`;
    let filter = `campaignId=eq.${campaignId}`;
    if (dateFrom) filter += `&date=gte.${dateFrom}`;
    if (dateTo) filter += `&date=lte.${dateTo}`;
    filter += `&order=date.asc`;

    const res = await fetch(
      `${supabaseUrl}/rest/v1/DailyReport?${query}&${filter}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      }
    );
    const reports = await res.json();

    // Generate Excel using simple CSV-like format (XLSX is complex in Deno)
    // We'll generate a proper Excel file using a minimal approach
    const BREVO_API_KEY = Deno.env.get("BREVO_API_KEY");

    // Build CSV content as fallback (Excel can open it)
    let csv = "Date;Conseiller;Reçus;Émis;Traités;Manqués;RDV;SMS;Statut\n";
    for (const r of reports) {
      const date = new Date(r.date).toLocaleDateString("fr-FR");
      const name = r.user?.name || r.user?.email || "";
      csv += `${date};${name};${r.incomingTotal};${r.outgoingTotal};${r.handled};${r.missed};${r.rdvTotal};${r.smsTotal};${r.status}\n`;
    }

    // Return as CSV with Excel-friendly headers
    return new Response(csv, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reporting_${Date.now()}.csv"`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
