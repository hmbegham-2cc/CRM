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

    // Build query for reports.
    // DailyReport has 2 FKs to User (userId, validatedById) → disambiguate user:User!userId(...)
    let query =
      `select=date,campaign:Campaign(name),user:User!userId(name,email),` +
      `incomingTotal,outgoingTotal,handled,missed,rdvTotal,smsTotal,status`;
    let filter = `campaignId=eq.${encodeURIComponent(campaignId)}`;
    if (dateFrom) filter += `&date=gte.${encodeURIComponent(dateFrom)}`;
    if (dateTo) filter += `&date=lte.${encodeURIComponent(dateTo)}`;
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
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PostgREST error ${res.status}: ${body}`);
    }
    const reports = await res.json();

    // Build CSV (Excel-friendly, ; separator + UTF-8 BOM for proper encoding in Excel-FR)
    const escape = (v: unknown) => {
      const s = String(v ?? "");
      // Escape quotes and wrap if contains separator/quote/newline
      if (s.includes('"') || s.includes(";") || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    let csv = "\uFEFF"; // BOM for Excel UTF-8 detection
    csv += "Date;Conseiller;Reçus;Émis;Traités;Manqués;RDV;SMS;Statut\n";
    for (const r of reports) {
      const date = new Date(r.date).toLocaleDateString("fr-FR");
      const name = r.user?.name || r.user?.email || "";
      csv +=
        [
          escape(date),
          escape(name),
          r.incomingTotal,
          r.outgoingTotal,
          r.handled,
          r.missed,
          r.rdvTotal,
          r.smsTotal,
          r.status,
        ].join(";") + "\n";
    }

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
