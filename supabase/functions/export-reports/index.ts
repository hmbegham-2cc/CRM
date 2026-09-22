import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGIN = Deno.env.get("FRONTEND_URL") ?? "https://crm-api-rose.vercel.app";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(value: unknown) {
  // Remove invalid XML control characters (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F)
  // These can appear in user-entered observations and break the XML parser
  const cleaned = String(value ?? "")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
  return cleaned
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sheetName(name: string, used: Set<string>) {
  const base = (name || "Feuille")
    .replace(/[:\\/?*\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Feuille";
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) {
    const suffix = ` ${i++}`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate);
  return candidate;
}

function cell(value: unknown) {
  const isNumber = typeof value === "number" && Number.isFinite(value);
  const type = isNumber ? "Number" : "String";
  return `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
}

function worksheet(name: string, headers: string[], rows: unknown[][], used: Set<string>) {
  const safeName = escapeXml(sheetName(name, used));
  const headerRow = `<Row>${headers.map((h) => cell(h)).join("")}</Row>`;
  const dataRows = rows.map((r) => `<Row>${r.map((v) => cell(v)).join("")}</Row>`).join("");
  const colCount = Math.max(1, headers.length);
  const rowCount = 1 + rows.length; // header + data rows
  return `<Worksheet ss:Name="${safeName}"><Table ss:ExpandedColumnCount="${colCount}" ss:ExpandedRowCount="${rowCount}">${headerRow}${dataRows}</Table></Worksheet>`;
}

function formatFrDate(value: unknown): string {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!ymd) return raw;
  const [, year, month, day] = ymd;
  return `${day}/${month}/${year}`;
}

function formatStatus(status: unknown): string {
  const map: Record<string, string> = {
    VALIDATED: "OK",
    SUBMITTED: "Soumis",
    DRAFT: "Brouillon",
    REJECTED: "Rejeté",
  };
  const key = String(status ?? "");
  return map[key] ?? key;
}

function workbookXml(sheets: string[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center"/></Style>
 </Styles>
 ${sheets.join("\n")}
</Workbook>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Auth check ──────────────────────────────────────────────
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
    if (!["ADMIN", "SUPERVISEUR", "COACH_QUALITE"].includes(callerRole ?? "")) {
      throw new Error("Accès refusé : rôle insuffisant");
    }
    // ─────────────────────────────────────────────────────────────

    // campaignIds: null / [] → all campaigns; [id] → one; [id1, id2] → subset
    // groupBy: "campaign" → one sheet per campaign (default for multi/all)
    //          "all"      → single sheet
    const { campaignId, campaignIds, dateFrom, dateTo, groupBy = "campaign" } = await req.json();

    const effectiveIds: string[] | null = (() => {
      if (Array.isArray(campaignIds) && campaignIds.length > 0) return campaignIds;
      if (campaignId) return [campaignId];
      return null;
    })();

    const fields =
      `select=date,campaign:Campaign(id,name),user:User!userId(name,email),` +
      `incomingTotal,outgoingTotal,handled,missed,rdvTotal,smsTotal,status,observations`;

    const filters: string[] = [];
    if (effectiveIds?.length === 1) {
      filters.push(`campaignId=eq.${encodeURIComponent(effectiveIds[0])}`);
    } else if (effectiveIds && effectiveIds.length > 1) {
      filters.push(`campaignId=in.(${effectiveIds.map((id) => encodeURIComponent(id)).join(",")})`);
    }
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

    const HEADERS = [
      "Date", "Campagne", "Conseiller", "Reçus", "Émis",
      "Traités", "Manqués", "RDV", "SMS", "Statut", "Observations",
    ];

    const toRow = (r: any) => [
      formatFrDate(r.date),
      r.campaign?.name ?? "",
      r.user?.name ?? r.user?.email ?? "",
      r.incomingTotal ?? 0,
      r.outgoingTotal ?? 0,
      r.handled ?? 0,
      r.missed ?? 0,
      r.rdvTotal ?? 0,
      r.smsTotal ?? 0,
      formatStatus(r.status),
      r.observations ?? "",
    ];

    const sheets: string[] = [];
    const usedSheetNames = new Set<string>();
    const multiSheetMode = !effectiveIds || effectiveIds.length !== 1;
    if (multiSheetMode && groupBy === "campaign") {
      // One sheet per campaign
      const byCampaign: Record<string, any[]> = {};
      for (const r of reports) {
        const name = r.campaign?.name ?? "Inconnue";
        (byCampaign[name] ??= []).push(r);
      }

      if (Object.keys(byCampaign).length === 0) {
        sheets.push(worksheet("Rapports", ["Information"], [["Aucun rapport trouvé"]], usedSheetNames));
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
        sheets.push(worksheet(
          "Résumé",
          ["Campagne", "Nb rapports", "Reçus", "Émis", "Traités", "Manqués", "RDV", "SMS"],
          summaryRows,
          usedSheetNames,
        ));

        // One sheet per campaign
        for (const [campName, campReports] of Object.entries(byCampaign)) {
          const sheetHeaders = ["Date", "Conseiller", "Reçus", "Émis", "Traités", "Manqués", "RDV", "SMS", "Statut", "Observations"];
          const rows = campReports.map((r: any) => [
            formatFrDate(r.date),
            r.user?.name ?? r.user?.email ?? "",
            r.incomingTotal ?? 0,
            r.outgoingTotal ?? 0,
            r.handled ?? 0,
            r.missed ?? 0,
            r.rdvTotal ?? 0,
            r.smsTotal ?? 0,
            formatStatus(r.status),
            r.observations ?? "",
          ]);
          sheets.push(worksheet(campName, sheetHeaders, rows, usedSheetNames));
        }
      }
    } else {
      // Single sheet (specific campaign or "all together")
      const rows = reports.map(toRow);
      sheets.push(worksheet("Rapports", HEADERS, rows, usedSheetNames));
    }

    const xml = workbookXml(sheets);

    // UTF-8 BOM helps Excel correctly interpret French characters (accents)
    const BOM = "\xEF\xBB\xBF";
    const body = new TextEncoder().encode(BOM + xml);

    const label = effectiveIds?.length === 1
      ? `_campagne`
      : effectiveIds && effectiveIds.length > 1
        ? `_${effectiveIds.length}_campagnes`
        : `_toutes_campagnes`;
    const filename = `reporting${label}_${Date.now()}.xls`;

    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.ms-excel; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(body.byteLength),
      },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
