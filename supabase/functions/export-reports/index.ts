import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
// @deno-types="https://esm.sh/xlsx@0.18.5/types/index.d.ts"
import * as XLSX from "https://esm.sh/xlsx@0.18.5?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // campaignId is optional — omit / null → export ALL campaigns
    // groupBy: "campaign" → one sheet per campaign (default when no campaignId)
    //          "all"      → single sheet
    const { campaignId, dateFrom, dateTo, groupBy = "campaign" } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const fields =
      `select=date,campaign:Campaign(id,name),user:User!userId(name,email),` +
      `incomingTotal,outgoingTotal,handled,missed,rdvTotal,smsTotal,status,observations`;

    const filters: string[] = [];
    if (campaignId) filters.push(`campaignId=eq.${encodeURIComponent(campaignId)}`);
    if (dateFrom)   filters.push(`date=gte.${encodeURIComponent(dateFrom)}`);
    if (dateTo)     filters.push(`date=lte.${encodeURIComponent(dateTo)}`);
    filters.push("order=date.asc");

    const res = await fetch(
      `${supabaseUrl}/rest/v1/DailyReport?${fields}&${filters.join("&")}`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          Accept: "application/json",
        },
      },
    );
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`PostgREST error ${res.status}: ${body}`);
    }
    const reports: any[] = await res.json();

    // ─── Build workbook ────────────────────────────────────────────────────
    const wb = XLSX.utils.book_new();

    const HEADERS = [
      "Date", "Campagne", "Conseiller", "Reçus", "Émis",
      "Traités", "Manqués", "RDV", "SMS", "Statut", "Observations",
    ];

    const toRow = (r: any) => [
      new Date(r.date + "T12:00:00").toLocaleDateString("fr-FR"),
      r.campaign?.name ?? "",
      r.user?.name ?? r.user?.email ?? "",
      r.incomingTotal ?? 0,
      r.outgoingTotal ?? 0,
      r.handled ?? 0,
      r.missed ?? 0,
      r.rdvTotal ?? 0,
      r.smsTotal ?? 0,
      r.status ?? "",
      r.observations ?? "",
    ];

    const applyColumnWidths = (ws: XLSX.WorkSheet, rows: any[][]) => {
      if (!rows.length) return;
      const colWidths = HEADERS.map((h, i) => {
        const max = Math.max(
          h.length,
          ...rows.map((r) => String(r[i] ?? "").length),
        );
        return { wch: Math.min(max + 2, 40) };
      });
      ws["!cols"] = colWidths;
    };

    if (!campaignId && groupBy === "campaign") {
      // One sheet per campaign
      const byCampaign: Record<string, any[]> = {};
      for (const r of reports) {
        const name = (r.campaign?.name ?? "Inconnue").substring(0, 31);
        (byCampaign[name] ??= []).push(r);
      }

      if (Object.keys(byCampaign).length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([["Aucun rapport trouvé"]]);
        XLSX.utils.book_append_sheet(wb, ws, "Rapports");
      } else {
        // Summary sheet
        const summaryRows: any[][] = [];
        for (const [campName, campReports] of Object.entries(byCampaign)) {
          summaryRows.push([
            campName,
            campReports.length,
            campReports.reduce((s, r) => s + (r.incomingTotal ?? 0), 0),
            campReports.reduce((s, r) => s + (r.outgoingTotal ?? 0), 0),
            campReports.reduce((s, r) => s + (r.handled ?? 0), 0),
            campReports.reduce((s, r) => s + (r.missed ?? 0), 0),
            campReports.reduce((s, r) => s + (r.rdvTotal ?? 0), 0),
            campReports.reduce((s, r) => s + (r.smsTotal ?? 0), 0),
          ]);
        }
        const summaryWs = XLSX.utils.aoa_to_sheet([
          ["Campagne", "Nb rapports", "Reçus", "Émis", "Traités", "Manqués", "RDV", "SMS"],
          ...summaryRows,
        ]);
        summaryWs["!cols"] = [{ wch: 30 }, ...Array(7).fill({ wch: 14 })];
        XLSX.utils.book_append_sheet(wb, summaryWs, "Résumé");

        // One sheet per campaign
        for (const [campName, campReports] of Object.entries(byCampaign)) {
          const sheetHeaders = ["Date", "Conseiller", "Reçus", "Émis", "Traités", "Manqués", "RDV", "SMS", "Statut", "Observations"];
          const rows = campReports.map((r: any) => [
            new Date(r.date + "T12:00:00").toLocaleDateString("fr-FR"),
            r.user?.name ?? r.user?.email ?? "",
            r.incomingTotal ?? 0,
            r.outgoingTotal ?? 0,
            r.handled ?? 0,
            r.missed ?? 0,
            r.rdvTotal ?? 0,
            r.smsTotal ?? 0,
            r.status ?? "",
            r.observations ?? "",
          ]);
          const ws = XLSX.utils.aoa_to_sheet([sheetHeaders, ...rows]);
          ws["!cols"] = sheetHeaders.map((h, i) => ({
            wch: Math.min(Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)) + 2, 40),
          }));
          XLSX.utils.book_append_sheet(wb, ws, campName);
        }
      }
    } else {
      // Single sheet (specific campaign or "all together")
      const rows = reports.map(toRow);
      const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
      applyColumnWidths(ws, rows);
      XLSX.utils.book_append_sheet(wb, ws, "Rapports");
    }

    // Write to Uint8Array (cross-platform, works in Deno)
    const buf: Uint8Array = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    const label = campaignId ? `_campagne` : `_toutes_campagnes`;
    const filename = `reporting${label}_${Date.now()}.xlsx`;

    return new Response(buf, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
