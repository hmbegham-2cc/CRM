import { useEffect, useMemo, useState, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { Campaign, DailyReport } from "@crc/types";
import { request } from "./api";
import { useAuth } from "./auth";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

import { 
  Plus, 
  Save, 
  Send, 
  Calendar, 
  Target, 
  PhoneIncoming, 
  PhoneOutgoing, 
  CheckSquare, 
  PhoneMissed, 
  ClipboardCheck, 
  MessageSquare,
  Filter,
  TrendingUp,
  Settings,
  Users,
  Download,
  AlertCircle,
  LayoutDashboard,
  FileEdit,
  CheckCircle,
  Clock,
  UserPlus,
  ShieldCheck,
  Search,
  BarChart3,
  History as HistoryIcon,
  Bell,
  Info,
  CheckCircle2,
  XCircle,
  Trash2,
  Check
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from "recharts";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "TELECONSEILLER" | "SUPERVISEUR" | "ADMIN";
  campaignMemberships: { campaign: { name: string } }[];
};

type ReportFormState = {
  incomingTotal: number;
  outgoingTotal: number;
  handled: number;
  missed: number;
  rdvTotal: number;
  smsTotal: number;
  observations: string;
};

export function HomePage() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ background: "rgba(37, 99, 235, 0.1)", width: "64px", height: "64px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
        <LayoutDashboard size={32} color="var(--primary)" />
      </div>
      <h1>Bienvenue sur CRC Reporting</h1>
      <p className="muted" style={{ maxWidth: "500px", margin: "0 auto" }}>
        Plateforme de reporting pour le télésecrétariat. Suivez vos indicateurs et gérez vos campagnes en temps réel.
      </p>
    </div>
  );
}

export function RapportPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [state, setState] = useState<ReportFormState>({ incomingTotal: 0, outgoingTotal: 0, handled: 0, missed: 0, rdvTotal: 0, smsTotal: 0, observations: "" });
  
  useEffect(() => {
    setState(prev => ({
      ...prev,
      handled: (Number(prev.incomingTotal) || 0) + (Number(prev.outgoingTotal) || 0)
    }));
  }, [state.incomingTotal, state.outgoingTotal]);
  const [message, setMessage] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    request<Campaign[]>("/campaigns").then((all) => {
      // Même si SUPERVISEUR voit toutes les campagnes, la saisie doit rester limitée
      // aux campagnes où il est membre actif.
      if (user?.role === "SUPERVISEUR") {
        setCampaigns(all.filter((c: any) => (c.members || []).some((m: any) => m.user?.id === user.id)));
      } else {
        setCampaigns(all);
      }
    });
  }, [user]);

  async function save(submit = false) {
    setMessage("");
    try {
      const report = await request<{ id: string }>("/reports", "POST", { date, campaignId, ...state });
      setReportId(report.id);
      if (submit) {
        await request(`/reports/${report.id}`, "PATCH", { action: "submit" });
        toast.success("Rapport soumis avec succès !");
      } else {
        toast.info("Brouillon enregistré.");
      }
      setMessage(submit ? "Rapport soumis avec succès." : "Brouillon enregistré.");
    } catch (err: any) {
      const errorMsg = err.message || "Impossible d'enregistrer le rapport";
      toast.error(errorMsg);
      setMessage("Erreur : " + errorMsg);
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h2>Mon rapport</h2>
          <p className="muted" style={{ marginTop: 4 }}>
            Renseignez vos indicateurs journaliers. Saisissez directement les chiffres dans les champs.
          </p>
        </div>
        <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
          <FileEdit color="var(--primary)" />
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        <div className="field" style={{ minWidth: 0 }}>
          <label className="label" htmlFor="reportDate">
            <Calendar size={14} style={{ marginRight: 6 }} />
            Date du rapport
          </label>
          <input id="reportDate" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field" style={{ minWidth: 0 }}>
          <label className="label" htmlFor="reportCampaign">
            <Target size={14} style={{ marginRight: 6 }} />
            Campagne
          </label>
          <select id="reportCampaign" className="select" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Sélectionner une campagne</option>
            {campaigns.map((c) => <option value={c.id} key={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 24, marginBottom: 16, fontSize: 13, fontWeight: 600, borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
        Indicateurs journaliers
      </p>
      
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {[
          { id: "incomingTotal", label: "Appels reçus", icon: PhoneIncoming, key: "incomingTotal" },
          { id: "outgoingTotal", label: "Appels émis", icon: PhoneOutgoing, key: "outgoingTotal" },
          { id: "handled", label: "Appels traités (Auto)", icon: CheckSquare, key: "handled", disabled: true },
          { id: "missed", label: "Appels manqués", icon: PhoneMissed, key: "missed" },
          { id: "rdvTotal", label: "Nombre de RDV", icon: ClipboardCheck, key: "rdvTotal" },
          { id: "smsTotal", label: "Nombre de SMS", icon: MessageSquare, key: "smsTotal" },
        ].map((item) => (
          <div className="field" style={{ minWidth: 0 }} key={item.id}>
            <label className="label" htmlFor={item.id}>
              <item.icon size={14} style={{ marginRight: 6 }} />
              {item.label}
            </label>
            <input
              id={item.id}
              className="input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={(item as any).disabled}
              style={(item as any).disabled ? { background: '#f8fafc', cursor: 'not-allowed', fontWeight: 700, color: 'var(--primary)' } : {}}
              value={state[item.key as keyof ReportFormState]}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setState((p) => ({ ...p, [item.key]: val === '' ? 0 : parseInt(val) }));
              }}
              placeholder="0"
            />
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24 }} className="field">
        <label className="label" htmlFor="reportObservations">
          <MessageSquare size={14} style={{ marginRight: 6 }} />
          Observations
        </label>
        <textarea
          id="reportObservations"
          className="textarea"
          rows={4}
          placeholder="Commentaires, contexte, anomalies..."
          value={state.observations}
          onChange={(e) => setState((p) => ({ ...p, observations: e.target.value }))}
        />
      </div>

      <div className="row" style={{ marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
        <button className="btn btn-secondary" disabled={!campaignId} onClick={() => save(false)}>
          <Save size={18} />
          Enregistrer brouillon
        </button>
        <button className="btn btn-primary" disabled={!campaignId} onClick={() => save(true)}>
          <Send size={18} />
          Soumettre le rapport
        </button>
        {reportId && (
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }} className="muted">
            <AlertCircle size={14} />
            <span>ID Rapport: {reportId.slice(0, 8)}...</span>
          </div>
        )}
      </div>
      
      {message && (
        <div style={{ 
          marginTop: 16, 
          padding: "12px 16px", 
          borderRadius: "8px", 
          background: message.includes("Erreur") ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
          color: message.includes("Erreur") ? "var(--danger)" : "var(--success)",
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          {message.includes("Erreur") ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          {message}
        </div>
      )}
    </div>
  );
}

export function MesSaisiesPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { 
    const qp = new URLSearchParams({ ...(user?.id ? { userId: user.id } : {}) });
    request<DailyReport[]>(`/reports?${qp.toString()}`)
      .then(setReports)
      .finally(() => setLoading(false)); 
  }, [user?.id]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Mes saisies</h1>
          <p className="muted">Historique de vos rapports d'activité</p>
        </div>
        <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
          <HistoryIcon color="var(--primary)" />
        </div>
      </div>
      
      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <div className="muted">Chargement de vos rapports...</div>
        </div>
      ) : (
        <ReportsTable title="Historique" reports={reports} />
      )}
    </div>
  );
}

export function ValidationPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { request<Campaign[]>("/campaigns").then(setCampaigns); }, []);
  
  useEffect(() => {
    setLoading(true);
    const qp = new URLSearchParams({ 
      status: "SUBMITTED", 
      ...(campaignId ? { campaignId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {})
    });
    request<DailyReport[]>(`/reports?${qp.toString()}`)
      .then(setReports)
      .finally(() => setLoading(false));
  }, [campaignId, dateFrom, dateTo]);

  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  async function act(id: string, action: "validate" | "reject") {
    const body: any = { action };
    if (action === "reject" && rejectReasons[id]) {
      body.reason = rejectReasons[id];
    }
    await request(`/reports/${id}`, "PATCH", body);
    setReports((prev) => prev.filter((r) => r.id !== id));
    setRejectReasons((prev) => { const next = { ...prev }; delete next[id]; return next; });
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Validation</h1>
          <p className="muted">Rapports en attente de vérification</p>
        </div>
        <div style={{ background: "rgba(16, 185, 129, 0.1)", padding: "12px", borderRadius: "12px" }}>
          <CheckCircle color="var(--success)" />
        </div>
      </div>

      <div className="card">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="validation-campaign">
              <Filter size={14} style={{ marginRight: 6 }} />
              Campagne
            </label>
            <select id="validation-campaign" className="select" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Toutes les campagnes</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="val-date-from">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Du
            </label>
            <input id="val-date-from" type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="val-date-to">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Au
            </label>
            <input id="val-date-to" type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <div className="muted">Recherche des rapports en attente...</div>
        </div>
      ) : reports.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <div style={{ marginBottom: "16px", color: "var(--success)" }}>
            <CheckCircle size={48} />
          </div>
          <h3>Tout est à jour !</h3>
          <p className="muted">Aucun rapport en attente de validation pour le moment.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: "16px" }}>
          {reports.map((r) => (
            <div key={r.id} className="card" style={{ margin: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px", color: "var(--primary)" }}>
                      {((r.user?.name || r.user?.email || "U")).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.user.name ?? r.user.email}</div>
                      <div className="muted" style={{ fontSize: "12px" }}>{new Date(r.date).toLocaleDateString("fr-FR")}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <Target size={14} className="muted" />
                    <span style={{ fontWeight: 600 }}>{r.campaign.name}</span>
                  </div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", width: "100%", marginTop: "16px", padding: "12px", background: "#f8fafc", borderRadius: "12px" }}>
                  <div style={{ textAlign: "center" }}>
                    <div className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>REÇUS</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)" }}>{r.incomingTotal}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>ÉMIS</div>
                    <div style={{ fontWeight: 800, color: "var(--primary)" }}>{r.outgoingTotal}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>TRAITÉS</div>
                    <div style={{ fontWeight: 800, color: "var(--success)" }}>{r.handled}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>MANQUÉS</div>
                    <div style={{ fontWeight: 800, color: "var(--danger)" }}>{r.missed}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>RDV</div>
                    <div style={{ fontWeight: 800, color: "var(--accent)" }}>{r.rdvTotal}</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div className="muted" style={{ fontSize: "10px", fontWeight: 700 }}>SMS</div>
                    <div style={{ fontWeight: 800, color: "var(--secondary)" }}>{r.smsTotal}</div>
                  </div>
                </div>
              </div>

              {r.observations && (
                <div style={{ marginTop: "16px", padding: "12px", background: "#f8fafc", borderRadius: "8px", fontSize: "13px" }}>
                  <div style={{ fontWeight: 600, fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }}>OBSERVATIONS :</div>
                  {r.observations}
                </div>
              )}

              <div style={{ marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                <div className="field" style={{ marginBottom: "12px" }}>
                  <label className="label" style={{ fontSize: "12px", color: "var(--danger)" }}>Raison du rejet (optionnel)</label>
                  <input 
                    className="input" 
                    placeholder="Expliquez pourquoi ce rapport est rejeté..." 
                    value={rejectReasons[r.id] || ""} 
                    onChange={(e) => setRejectReasons((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    style={{ fontSize: "13px" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <button className="btn btn-primary" onClick={() => act(r.id, "validate")} style={{ background: "var(--success)" }}>
                    <CheckSquare size={18} />
                    Valider le rapport
                  </button>
                  <button className="btn btn-danger" onClick={() => act(r.id, "reject")}>
                    <AlertCircle size={18} />
                    Rejeter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState<'PERSONAL' | 'TEAM'>(
    user?.role === 'TELECONSEILLER' ? 'PERSONAL' : 'TEAM'
  );
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [pendingCampaignId, setPendingCampaignId] = useState("");
  const [pendingDateFrom, setPendingDateFrom] = useState("");
  const [pendingDateTo, setPendingDateTo] = useState("");

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // On ne charge que les campagnes auxquelles l'utilisateur a accès
    request<Campaign[]>("/campaigns").then(setCampaigns);
    if (user?.role === 'ADMIN' || user?.role === 'SUPERVISEUR') {
      request<UserRow[]>("/users").then(setUsers).catch(() => setUsers([]));
    }
  }, [user]);

  const loadData = (cid: string, from: string, to: string, mode: 'PERSONAL' | 'TEAM') => {
    setLoading(true);
    const qp = new URLSearchParams({ 
      ...(cid ? { campaignId: cid } : {}),
      ...(from ? { dateFrom: from } : {}),
      ...(to ? { dateTo: to } : {}),
      ...(mode === 'PERSONAL' ? { userId: user?.id } : {}),
      ...(mode === 'TEAM' ? { status: 'VALIDATED' } : {})
    });
    request<DailyReport[]>(`/reports?${qp.toString()}`)
      .then(setReports)
      .finally(() => setLoading(false));
  };

  // Chargement initial (tout par défaut, sans limite de date)
  useEffect(() => {
    loadData("", "", "", viewMode);
  }, []);

  const handleApplyFilters = () => {
    setCampaignId(pendingCampaignId);
    setDateFrom(pendingDateFrom);
    setDateTo(pendingDateTo);
    loadData(pendingCampaignId, pendingDateFrom, pendingDateTo, viewMode);
    toast.success("Filtres appliqués");
  };

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    const tId = toast.loading("Génération du PDF...");
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: "#f8fafc"
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`dashboard_${campaignId || 'global'}_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("PDF téléchargé", { id: tId });
    } catch (err) {
      toast.error("Erreur lors de l'export PDF", { id: tId });
    }
  };
  const stats = useMemo(() => ({
    incoming: reports.reduce((s, r) => s + (Number(r.incomingTotal) || 0), 0),
    outgoing: reports.reduce((s, r) => s + (Number(r.outgoingTotal) || 0), 0),
    handled: reports.reduce((s, r) => s + (Number(r.handled) || 0), 0),
    missed: reports.reduce((s, r) => s + (Number(r.missed) || 0), 0),
    rdv: reports.reduce((s, r) => s + (Number(r.rdvTotal) || 0), 0),
    sms: reports.reduce((s, r) => s + (Number(r.smsTotal) || 0), 0),
  }), [reports]);

  const conversionRate = useMemo(() => {
    return stats.handled > 0 ? (stats.rdv / stats.handled * 100).toFixed(1) : "0.0";
  }, [stats]);

  const chartData = useMemo(() => {
    const daily: Record<string, any> = {};
    reports.forEach((r: any) => {
      const d = new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      if (!daily[d]) daily[d] = { date: d, recus: 0, traites: 0, rdv: 0, emis: 0, manques: 0 };
      daily[d].recus += (Number(r.incomingTotal) || 0);
      daily[d].emis += (Number(r.outgoingTotal) || 0);
      daily[d].traites += (Number(r.handled) || 0);
      daily[d].rdv += (Number(r.rdvTotal) || 0);
      daily[d].manques += (Number(r.missed) || 0);
    });
    return Object.values(daily).sort((a: any, b: any) => {
      const dateA = a.date.split('/').reverse().join('');
      const dateB = b.date.split('/').reverse().join('');
      return dateA.localeCompare(dateB);
    });
  }, [reports]);

  const rdvChartData = useMemo(() => {
    return chartData.map((d: any) => ({
      date: d.date,
      rdv: d.rdv,
      conversion: d.traites > 0 ? ((d.rdv / d.traites) * 100).toFixed(1) : 0
    }));
  }, [chartData]);

  return (
    <div ref={dashboardRef} style={{ padding: "4px" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
              <h2 style={{ margin: 0 }}>
                {viewMode === 'PERSONAL' ? 'Mon Dashboard Personnel' : 'Tableau de bord Équipe'}
              </h2>
              {(user?.role === 'SUPERVISEUR' || user?.role === 'ADMIN') && (
                <div style={{ display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "8px", gap: "4px" }}>
                  <button 
                    onClick={() => { setViewMode('TEAM'); loadData(pendingCampaignId, pendingDateFrom, pendingDateTo, 'TEAM'); }}
                    className={`btn ${viewMode === 'TEAM' ? 'btn-primary' : ''}`}
                    style={{ padding: "6px 12px", fontSize: "12px", height: "auto" }}
                  >
                    Vue Équipe
                  </button>
                  <button 
                    onClick={() => { setViewMode('PERSONAL'); loadData(pendingCampaignId, pendingDateFrom, pendingDateTo, 'PERSONAL'); }}
                    className={`btn ${viewMode === 'PERSONAL' ? 'btn-primary' : ''}`}
                    style={{ padding: "6px 12px", fontSize: "12px", height: "auto" }}
                  >
                    Ma Performance
                  </button>
                </div>
              )}
            </div>
            <p className="muted" style={{ margin: 0 }}>
              {viewMode === 'PERSONAL' 
                ? 'Suivi de vos performances et indicateurs personnels' 
                : 'Statistiques consolidées par campagne'}
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button className="btn btn-secondary" onClick={handleExportPDF} title="Télécharger en PDF">
              <Download size={18} />
              PDF
            </button>
            <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
              <TrendingUp color="var(--primary)" />
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="dashboard-campaign">
              <Filter size={14} style={{ marginRight: 6 }} />
              Campagne
            </label>
            <select id="dashboard-campaign" className="select" value={pendingCampaignId} onChange={(e) => setPendingCampaignId(e.target.value)}>
              <option value="">Toutes les campagnes</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="date-from">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Du
            </label>
            <input id="date-from" type="date" className="input" value={pendingDateFrom} onChange={(e) => setPendingDateFrom(e.target.value)} />
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="date-to">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Au
            </label>
            <input id="date-to" type="date" className="input" value={pendingDateTo} onChange={(e) => setPendingDateTo(e.target.value)} />
          </div>

          <button className="btn btn-primary" onClick={handleApplyFilters} style={{ height: "42px" }}>
            <Search size={18} />
            Appliquer les filtres
          </button>
        </div>
      </div>

      <div className="grid4" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-label">Appels reçus</div>
          <div className="stat-value">{stats.incoming}</div>
          <div style={{ fontSize: "12px", color: "var(--primary)" }}>Entrants</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Appels émis</div>
          <div className="stat-value" style={{ color: "var(--primary)" }}>{stats.outgoing}</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Sortants</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Taux de Conversion</div>
          <div className="stat-value" style={{ color: "var(--accent)" }}>{conversionRate}%</div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{stats.rdv} rendez-vous</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Qualité (Manqués)</div>
          <div className="stat-value" style={{ color: stats.missed > 0 ? "var(--danger)" : "var(--success)" }}>
            {stats.incoming > 0 ? (stats.missed / stats.incoming * 100).toFixed(1) : 0}%
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{stats.missed} manqués</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "24px" }}>
        {/* Graphique 1: Activité des appels */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <BarChart3 size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Répartition des appels</h3>
          </div>
          <div style={{ width: "100%", height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                <Bar dataKey="recus" name="Reçus" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="emis" name="Émis" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="manques" name="Manqués" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graphique 2: Performance RDV */}
        <div className="card" style={{ margin: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <ClipboardCheck size={20} color="var(--success)" />
            <h3 style={{ margin: 0 }}>Performance Rendez-vous</h3>
          </div>
          <div style={{ width: "100%", height: "300px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rdvChartData}>
                <defs>
                  <linearGradient id="colorRdv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                <Area type="monotone" dataKey="rdv" name="RDV Fixés" stroke="var(--success)" fillOpacity={1} fill="url(#colorRdv)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: "auto" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ margin: 0, fontSize: "16px" }}>
              {viewMode === 'PERSONAL' ? 'Mes campagnes actives' : 'Membres de l\'équipe'}
            </h3>
          </div>
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>{viewMode === 'PERSONAL' ? 'Campagne' : 'Utilisateur'}</th>
                <th>Rôle</th>
                <th>{viewMode === 'PERSONAL' ? 'Statut' : 'Campagnes assignées'}</th>
              </tr>
            </thead>
            <tbody>
              {viewMode === 'PERSONAL' ? (
                campaigns.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Target size={16} color="var(--primary)" />
                        </div>
                        <span style={{ fontWeight: 600 }}>{c.name}</span>
                      </div>
                    </td>
                    <td><span className="badge badge-validated">Actif</span></td>
                    <td><span className="muted" style={{ fontSize: "12px" }}>Assigné</span></td>
                  </tr>
                ))
              ) : (
                users.map((u: any) => (
                  <tr key={u.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{ 
                          width: "32px", 
                          height: "32px", 
                          borderRadius: "8px", 
                          background: u.role === "SUPERVISEUR" ? "var(--accent)" : "#f1f5f9", 
                          color: u.role === "SUPERVISEUR" ? "white" : "var(--primary)",
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "center", 
                          fontWeight: 700,
                          fontSize: "13px"
                        }}>
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: "14px" }}>{u.name ?? "Sans nom"}</div>
                          <div className="muted" style={{ fontSize: "12px" }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${u.role === "SUPERVISEUR" ? "badge-validated" : "badge-draft"}`} style={{ fontSize: "11px" }}>
                        {u.role}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {u.campaignMemberships.map((c: any) => (
                          <span key={c.campaign.name} className="badge" style={{ fontSize: "10px", background: "#f1f5f9", color: "#475569" }}>
                            {c.campaign.name}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
  );
}

export function AllReportsPage() {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    request<Campaign[]>("/campaigns").then(setCampaigns);
    load();
  }, []);

  const load = () => {
    setLoading(true);
    const qp = new URLSearchParams({ 
      ...(campaignId ? { campaignId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {})
    });
    request<DailyReport[]>(`/reports?${qp.toString()}`)
      .then(setReports)
      .finally(() => setLoading(false));
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Tous les rapports</h1>
          <p className="muted">Vue détaillée de tous les rapports saisis</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "flex-end" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Campagne</label>
            <select className="select" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">Toutes les campagnes</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Du</label>
            <input type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">Au</label>
            <input type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={load}>
            <Search size={18} />
            Filtrer
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>Chargement...</div>
      ) : (
        <ReportsTable title="Liste des rapports" reports={reports} />
      )}
    </div>
  );
}

export function CampagnesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  
  const load = () => {
    setLoading(true);
    request<Campaign[]>("/campaigns")
      .then(setCampaigns)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Campagnes</h1>
          <p className="muted">Gestion des campagnes de télésecrétariat</p>
        </div>
        <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
          <Settings color="var(--primary)" />
        </div>
      </div>

      <div className="card">
        <h3>Créer une nouvelle campagne</h3>
        <div className="row" style={{ alignItems: "flex-end", marginTop: "16px" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="campaign-name">Nom de la campagne</label>
            <input id="campaign-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: AXA Prévoyance" />
          </div>
          <button className="btn btn-primary" onClick={async () => { await request("/campaigns", "POST", { name }); setName(""); load(); }}>
            <Plus size={18} />
            Créer
          </button>
        </div>
      </div>

      {loading ? (
        <div className="muted" style={{ textAlign: "center", padding: "24px" }}>Chargement...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {campaigns.map((c) => (
            <div key={c.id} className="card" style={{ margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <span className={`badge ${c.active ? "badge-validated" : "badge-draft"}`}>
                    {c.active ? "Active" : "Inactive"}
                  </span>
                  <div className="muted" style={{ fontSize: "12px" }}>{c.members.length} membres</div>
                </div>
                <h3 style={{ marginBottom: "8px" }}>{c.name}</h3>
                <div className="muted" style={{ fontSize: "12px", marginTop: "8px", lineHeight: 1.4 }}>
                  {(c as any).members?.length ? (c as any).members.map((m: any) => (m.user?.name || m.user?.email)).join(", ") : "Aucun membre"}
                </div>
              </div>

              <div className="row" style={{ marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }}>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: "13px" }}
                  onClick={async () => {
                    const nextName = prompt("Nouveau nom de campagne", c.name);
                    if (!nextName) return;
                    await request(`/campaigns/${c.id}`, "PUT", { name: nextName });
                    load();
                  }}
                >
                  Modifier
                </button>
                <button
                  className="btn btn-secondary"
                  style={{ flex: 1, fontSize: "13px" }}
                  onClick={() => navigate(`/equipes?campaignId=${c.id}`)}
                >
                  Voir l'équipe
                </button>
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: 1, fontSize: "13px" }}
                  onClick={async () => { await request(`/campaigns/${c.id}`, "PUT", { active: !c.active }); load(); }}
                >
                  {c.active ? "Désactiver" : "Activer"}
                </button>
                <button 
                  className="btn btn-danger" 
                  style={{ flex: 1, fontSize: "13px" }}
                  onClick={async () => { if(confirm("Supprimer cette campagne ?")) { await request(`/campaigns/${c.id}`, "DELETE"); load(); } }}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EquipesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => { 
    request<Campaign[]>("/campaigns").then(setCampaigns); 
    request<UserRow[]>("/users").then(setUsers).catch(() => setUsers([])); 
  }, []);

  useEffect(() => {
    const qpCampaignId = searchParams.get("campaignId");
    if (qpCampaignId) setCampaignId(qpCampaignId);
  }, [searchParams]);

  useEffect(() => {
    const c = campaigns.find((x) => x.id === campaignId);
    setSelected(c ? c.members.map((m) => m.user.id) : []);
  }, [campaignId, campaigns]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Équipes</h1>
          <p className="muted">Assignation des conseillers aux campagnes</p>
        </div>
        <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
          <Users color="var(--primary)" />
        </div>
      </div>

      <div className="card">
        <div className="field">
          <label className="label" htmlFor="equipes-campaign">Sélectionner une campagne</label>
          <select id="equipes-campaign" className="select" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Sélectionner une campagne</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {campaignId && (
          <div style={{ marginTop: "24px" }}>
            <label className="label" style={{ marginBottom: "16px", color: "var(--primary)", fontWeight: 700 }}>
              MEMBRES DE LA CAMPAGNE
            </label>
            
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "16px" }}>
              {users.map((u) => {
                const isSelected = selected.includes(u.id);
                return (
                  <div key={u.id} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    padding: "16px",
                    border: "1px solid var(--border)",
                    borderRadius: "12px",
                    background: isSelected ? "rgba(37, 99, 235, 0.02)" : "transparent",
                    borderColor: isSelected ? "var(--primary)" : "var(--border)",
                    transition: "all 0.2s"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <input 
                        type="checkbox" 
                        style={{ width: "18px", height: "18px" }}
                        checked={isSelected} 
                        onChange={() => setSelected((prev) => prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id])} 
                      /> 
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "14px" }}>{u.name ?? u.email}</div>
                        <div className="muted" style={{ fontSize: "12px" }}>{u.email}</div>
                      </div>
                    </div>

                    {isSelected && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "4px 12px", background: "#f1f5f9", borderRadius: "20px" }}>
                        <ShieldCheck size={14} color={u.role === 'SUPERVISEUR' ? "var(--success)" : "#94a3b8"} />
                        <select 
                          className="select" 
                          style={{ padding: "2px 4px", fontSize: "11px", height: "auto", width: "auto", border: "none", background: "transparent", fontWeight: 600 }}
                          value={u.role} 
                          onChange={async (e) => { 
                            const tId = toast.loading("Mise à jour...");
                            try {
                              await request("/users", "PATCH", { userId: u.id, role: e.target.value }); 
                              toast.success("Rôle mis à jour", { id: tId });
                              request<UserRow[]>("/users").then(setUsers); 
                            } catch (err: any) {
                              toast.error("Erreur", { id: tId });
                            }
                          }}
                        >
                          <option value="TELECONSEILLER">Conseiller</option>
                          <option value="SUPERVISEUR">Superviseur</option>
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "24px" }}>
              <button 
                className="btn btn-primary" 
                disabled={saving || !campaignId} 
                onClick={async () => { 
                  setSaving(true);
                  try {
                    await request("/teams", "POST", { campaignId, userIds: selected }); 
                    toast.success("Équipe mise à jour avec succès"); 
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Enregistrement..." : "Enregistrer l'équipe"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function UtilisateursPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", name: "", role: "TELECONSEILLER" as any });
  const [inviteMsg, setInviteMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const load = () => {
    setLoading(true);
    request<UserRow[]>("/users")
      .then(setUsers)
      .finally(() => setLoading(false));
  };
  
  useEffect(() => { load(); }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      (u.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteMsg("");
    const tId = toast.loading("Envoi de l'invitation...");
    try {
      await request("/auth/invite", "POST", inviteData);
      toast.success("Utilisateur invité avec succès !", { id: tId });
      setInviteMsg("Invitation envoyée !");
      setInviteData({ email: "", name: "", role: "TELECONSEILLER" });
      setShowInvite(false);
      load();
    } catch (err: any) {
      const errorMsg = err.message || "Impossible d'inviter";
      toast.error(errorMsg, { id: tId });
      setInviteMsg("Erreur : " + errorMsg);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Utilisateurs</h1>
          <p className="muted">Gérez vos équipes et invitez de nouveaux collaborateurs</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? <Plus size={18} style={{ transform: 'rotate(45deg)' }} /> : <UserPlus size={18} />}
          {showInvite ? "Annuler" : "Nouvel utilisateur"}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: showInvite ? "1fr 350px" : "1fr", gap: "24px", alignItems: "start" }}>
        <div style={{ display: "grid", gap: "20px" }}>
          {/* Barre de recherche */}
          <div className="card" style={{ marginBottom: 0, padding: "12px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <Search size={18} className="muted" />
              <input 
                type="text" 
                placeholder="Rechercher un utilisateur (nom, email...)" 
                style={{ border: "none", outline: "none", width: "100%", fontSize: "15px", background: "transparent" }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: "center", padding: "48px" }}>
              <div className="muted">Chargement des utilisateurs...</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {filteredUsers.map((u) => (
                <div key={u.id} className="card user-card" style={{ margin: 0, padding: "20px", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                    <div style={{ 
                      width: "48px", 
                      height: "48px", 
                      borderRadius: "12px", 
                      background: "linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "center", 
                      fontWeight: 700, 
                      fontSize: "18px",
                      color: "white",
                      boxShadow: "0 4px 12px rgba(37, 99, 235, 0.2)"
                    }}>
                      {(u.name || u.email).charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.name ?? "Sans nom"}</div>
                      <div className="muted" style={{ fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u.email}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span className="muted" style={{ fontSize: "12px", fontWeight: 600 }}>RÔLE</span>
                      <select 
                        className="select" 
                        style={{ padding: "4px 8px", fontSize: "12px", width: "auto", height: "auto" }}
                        value={u.role} 
                        onChange={async (e) => { 
                          const tId = toast.loading("Mise à jour du rôle...");
                          try {
                            await request("/users", "PATCH", { userId: u.id, role: e.target.value }); 
                            toast.success("Rôle mis à jour", { id: tId });
                            load(); 
                          } catch (err: any) {
                            toast.error("Erreur", { id: tId });
                          }
                        }}
                      >
                        <option value="TELECONSEILLER">Téléconseiller</option>
                        <option value="SUPERVISEUR">Superviseur</option>
                        <option value="ADMIN">Administrateur</option>
                      </select>
                    </div>

                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                      <div className="muted" style={{ fontSize: "11px", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.05em" }}>CAMPAGNES ACTIVES</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {u.campaignMemberships.length > 0 ? (
                          u.campaignMemberships.map((c) => (
                            <span key={c.campaign.name} className="badge badge-validated" style={{ fontSize: "10px", padding: "2px 8px" }}>
                              {c.campaign.name}
                            </span>
                          ))
                        ) : (
                          <span className="muted" style={{ fontSize: "11px", fontStyle: "italic" }}>Aucune campagne</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {showInvite && (
          <div className="card" style={{ margin: 0, position: "sticky", top: "24px", border: "1px solid var(--primary)", boxShadow: "0 10px 25px rgba(37, 99, 235, 0.1)" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <UserPlus size={20} color="var(--primary)" />
              Inviter un membre
            </h3>
            <form onSubmit={handleInvite} style={{ marginTop: "20px", display: "grid", gap: "16px" }}>
              <div className="field">
                <label className="label">Nom complet</label>
                <input className="input" placeholder="Ex: Jean Dupont" value={inviteData.name} onChange={e => setInviteData({...inviteData, name: e.target.value})} required />
              </div>
              <div className="field">
                <label className="label">Email professionnel</label>
                <input className="input" type="email" placeholder="nom@2cconseil.com" value={inviteData.email} onChange={e => setInviteData({...inviteData, email: e.target.value})} required />
              </div>
              <div className="field">
                <label className="label">Rôle assigné</label>
                <select className="select" value={inviteData.role} onChange={e => setInviteData({...inviteData, role: e.target.value as any})}>
                  <option value="TELECONSEILLER">Téléconseiller</option>
                  <option value="SUPERVISEUR">Superviseur</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary" style={{ marginTop: "8px", height: "44px" }}>
                Envoyer l'invitation
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export function SetupPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  if (!token) return <Navigate to="/login" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setMsg("Les mots de passe ne correspondent pas");
    setLoading(true);
    try {
      await request("/auth/setup-password", "POST", { token, password });
      setMsg("Succès ! Redirection vers la connexion...");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err: any) {
      setMsg("Erreur : " + (err.message || "Impossible de configurer le mot de passe"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
      <div className="card" style={{ maxWidth: 400, width: "100%" }}>
        <h2>Configurer votre compte</h2>
        <p className="muted">Veuillez choisir votre mot de passe pour finaliser votre inscription.</p>
        <form onSubmit={handleSubmit} style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
          <div className="field">
            <label className="label">Nouveau mot de passe</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="field">
            <label className="label">Confirmer le mot de passe</label>
            <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Chargement..." : "Enregistrer et continuer"}
          </button>
          {msg && <p className="muted" style={{ color: msg.includes("Erreur") ? "var(--danger)" : "var(--success)" }}>{msg}</p>}
        </form>
      </div>
    </div>
  );
}

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    request<NotificationRow[]>("/notifications")
      .then(setNotifications)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const markAsRead = async (id: string) => {
    await request(`/notifications/${id}/read`, "PATCH");
    setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = async () => {
    await request("/notifications/read-all", "PATCH");
    setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
    toast.success("Toutes les notifications marquées comme lues");
  };

  const deleteNotification = async (id: string) => {
    await request(`/notifications/${id}`, "DELETE");
    setNotifications((prev) => prev.filter(n => n.id !== id));
    toast.success("Notification supprimée");
  };

  const clearAll = async () => {
    await request("/notifications", "DELETE");
    setNotifications([]);
    toast.success("Toutes les notifications ont été effacées");
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "success": return <CheckCircle2 size={20} color="var(--success)" />;
      case "warning": return <AlertCircle size={20} color="var(--accent)" />;
      case "error": return <XCircle size={20} color="var(--danger)" />;
      default: return <Info size={20} color="var(--primary)" />;
    }
  };

  const getTypeBg = (type: string) => {
    switch (type) {
      case "success": return "rgba(16, 185, 129, 0.1)";
      case "warning": return "rgba(245, 158, 11, 0.1)";
      case "error": return "rgba(239, 68, 68, 0.1)";
      default: return "rgba(37, 99, 235, 0.1)";
    }
  };

  const getTypeBorder = (type: string, read: boolean) => {
    if (read) return "1px solid var(--border)";
    switch (type) {
      case "success": return "4px solid var(--success)";
      case "warning": return "4px solid var(--accent)";
      case "error": return "4px solid var(--danger)";
      default: return "4px solid var(--primary)";
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Notifications</h1>
          <p className="muted">Suivez les mises à jour et les alertes système</p>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {notifications.some(n => !n.read) && (
            <button className="btn btn-secondary" onClick={markAllRead}>
              <Check size={16} />
              Tout marquer comme lu
            </button>
          )}
          <button className="btn btn-secondary" onClick={clearAll} disabled={notifications.length === 0}>
            <Trash2 size={16} />
            Tout effacer
          </button>
          <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
            <Bell color="var(--primary)" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <div className="muted">Chargement des notifications...</div>
        </div>
      ) : (
        <div className="grid1" style={{ gap: "16px" }}>
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <div key={n.id} className="card" style={{ 
                margin: 0, 
                borderLeft: getTypeBorder(n.type, n.read),
                opacity: n.read ? 0.7 : 1,
                transition: "all 0.2s"
              }}>
                <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                  <div style={{ 
                    width: "40px", 
                    height: "40px", 
                    borderRadius: "10px", 
                    background: getTypeBg(n.type),
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0
                  }}>
                    {getTypeIcon(n.type)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                      <h3 style={{ fontSize: "16px", margin: 0 }}>{n.title}</h3>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <span className="muted" style={{ fontSize: "12px" }}>
                          {new Date(n.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {!n.read && (
                            <button 
                              onClick={() => markAsRead(n.id)} 
                              className="btn-icon" 
                              title="Marquer comme lu"
                              style={{ padding: "4px", color: "var(--success)" }}
                            >
                              <Check size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => deleteNotification(n.id)} 
                            className="btn-icon" 
                            title="Supprimer"
                            style={{ padding: "4px", color: "var(--danger)" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <p style={{ margin: 0, color: "#475569", lineHeight: "1.5", fontSize: "14px" }}>{n.message}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="card" style={{ textAlign: "center", padding: "48px" }}>
              <div className="muted" style={{ marginBottom: "16px" }}>
                <Bell size={48} style={{ opacity: 0.2 }} />
              </div>
              <h3>Aucune notification</h3>
              <p className="muted">Vous êtes à jour !</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await request("/auth/forgot-password", "POST", { email });
      setSent(true);
    } catch {
      setSent(true); // Même en cas d'erreur, on montre le même message pour ne pas révéler les emails
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", padding: "20px" }}>
      <div style={{ maxWidth: 400, width: "100%" }} className="card">
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ width: "56px", height: "56px", background: "rgba(37, 99, 235, 0.1)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <TrendingUp size={30} color="var(--primary)" />
          </div>
          <h2 style={{ marginBottom: "8px" }}>Mot de passe oublié</h2>
          <p className="muted">Entrez votre email pour recevoir un lien de réinitialisation</p>
        </div>

        {sent ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <CheckCircle size={48} color="var(--success)" style={{ marginBottom: "16px" }} />
            <p style={{ fontWeight: 600, marginBottom: "8px" }}>Email envoyé !</p>
            <p className="muted" style={{ fontSize: "14px" }}>Si cet email existe dans notre système, vous recevrez un lien de réinitialisation.</p>
            <button className="btn btn-primary" style={{ marginTop: "24px" }} onClick={() => navigate("/login")}>
              Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "20px" }}>
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label">Email professionnel</label>
              <input className="input" type="email" placeholder="votre.email@2cconseil.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" style={{ height: "48px" }} disabled={loading}>
              {loading ? "Envoi en cours..." : "Envoyer le lien"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) {
      setMsg("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    setMsg("");
    try {
      await request("/auth/change-password", "POST", { currentPassword, newPassword });
      toast.success("Mot de passe modifié avec succès");
      navigate(-1);
    } catch (err: any) {
      const errorMsg = err.message || "Erreur lors du changement de mot de passe";
      setMsg(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 500, margin: "0 auto" }}>
      <h2>Changer mon mot de passe</h2>
      <p className="muted" style={{ marginTop: 4 }}>Modifiez votre mot de passe pour sécuriser votre compte</p>
      <form onSubmit={handleSubmit} style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
        <div className="field">
          <label className="label">Mot de passe actuel</label>
          <input className="input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Nouveau mot de passe</label>
          <input className="input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="field">
          <label className="label">Confirmer le nouveau mot de passe</label>
          <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Enregistrement..." : "Changer le mot de passe"}
        </button>
        {msg && <p style={{ color: msg.includes("Erreur") || msg.includes("correspondent") || msg.includes("incorrect") ? "var(--danger)" : "var(--success)", fontWeight: 600, fontSize: "14px" }}>{msg}</p>}
      </form>
    </div>
  );
}

export function ExportPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => { request<Campaign[]>("/campaigns").then(setCampaigns); }, []);

  async function doExport() {
    const qp = new URLSearchParams({ 
      campaignId,
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {})
    });
    const tId = toast.loading("Génération du fichier Excel...");
    try {
      const blob = await request<Blob>(`/export?${qp.toString()}`, "GET", undefined, true);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporting_${campaignId}_${Date.now()}.xlsx`;
      a.click();
      toast.success("Export terminé !", { id: tId });
    } catch (err: any) {
      toast.error("Échec de l'export : " + err.message, { id: tId });
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1>Export Excel</h1>
          <p className="muted">Générez des rapports détaillés au format Excel</p>
        </div>
        <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
          <Download color="var(--primary)" />
        </div>
      </div>

      <div style={{ display: "grid", gap: "20px" }}>
        <div className="field">
          <label className="label" htmlFor="export-campaign">
            <Target size={14} style={{ marginRight: 6 }} />
            Sélectionner la campagne
          </label>
          <select id="export-campaign" className="select" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
            <option value="">Sélectionner une campagne</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div className="field">
            <label className="label" htmlFor="exp-date-from">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Date de début
            </label>
            <input id="exp-date-from" type="date" className="input" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="field">
            <label className="label" htmlFor="exp-date-to">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Date de fin
            </label>
            <input id="exp-date-to" type="date" className="input" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </div>

        <button 
          className="btn btn-primary" 
          style={{ height: "48px" }} 
          disabled={!campaignId} 
          onClick={doExport}
        >
          <Download size={18} />
          Générer le fichier Excel
        </button>
      </div>
    </div>
  );
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "DRAFT": return "badge-draft";
    case "SUBMITTED": return "badge-submitted";
    case "VALIDATED": return "badge-validated";
    case "REJECTED": return "badge-rejected";
    default: return "";
  }
}

function ReportsTable({ title, reports }: { title: string; reports: DailyReport[] }) {
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <h2 style={{ marginBottom: "20px" }}>{title}</h2>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Campagne</th>
            <th>Conseiller</th>
            <th>Reçus</th>
            <th>Émis</th>
            <th>Traités</th>
            <th>Manqués</th>
            <th>RDV</th>
            <th>SMS</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {reports.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                Aucun rapport trouvé
              </td>
            </tr>
          ) : (
            reports.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{new Date(r.date).toLocaleDateString("fr-FR")}</td>
                <td>{r.campaign.name}</td>
                <td>{r.user.name ?? r.user.email}</td>
                <td>{r.incomingTotal}</td>
                <td>{r.outgoingTotal}</td>
                <td>{r.handled}</td>
                <td style={{ color: r.missed > 0 ? "var(--danger)" : "inherit" }}>{r.missed}</td>
                <td>{r.rdvTotal}</td>
                <td>{r.smsTotal}</td>
                <td>
                  <span className={`badge ${getStatusBadgeClass(r.status)}`}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  return (
    <div style={{ 
      minHeight: "100vh", 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "center", 
      background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
      padding: "20px"
    }}>
      <div style={{ maxWidth: 400, width: "100%" }} className="card">
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <div style={{ 
            width: "56px", 
            height: "56px", 
            background: "rgba(37, 99, 235, 0.1)", 
            borderRadius: "14px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            margin: "0 auto 16px"
          }}>
            <TrendingUp size={30} color="var(--primary)" />
          </div>
          <h2 style={{ marginBottom: "8px" }}>CRC Reporting</h2>
          <p className="muted">Connectez-vous pour accéder au portail</p>
        </div>

        {error && (
          <div style={{ 
            marginBottom: "20px", 
            padding: "12px", 
            borderRadius: "8px", 
            background: "rgba(239, 68, 68, 0.1)", 
            color: "var(--danger)",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: "20px" }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="login-email">Email professionnel</label>
            <input 
              id="login-email" 
              className="input" 
              placeholder="votre.email@2cconseil.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label" htmlFor="login-password">Mot de passe</label>
            <input 
              id="login-password" 
              className="input" 
              type="password" 
              placeholder="••••••••" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
            />
          </div>
          
          <button 
            className="btn btn-primary" 
            style={{ marginTop: 8, height: "48px" }} 
            disabled={loading}
            onClick={async () => {
              if (!email || !password) {
                setError("Veuillez remplir tous les champs");
                return;
              }
              setLoading(true);
              setError("");
              try {
                await login(email, password);
              } catch {
                setError("Email ou mot de passe incorrect");
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
        </div>
        
        <div style={{ marginTop: "12px", textAlign: "center" }}>
          <button 
            type="button" 
            className="muted" 
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "var(--primary)" }}
            onClick={() => navigate("/forgot-password")}
          >
            Mot de passe oublié ?
          </button>
        </div>
        
        <div style={{ marginTop: "12px", textAlign: "center", fontSize: "12px" }} className="muted">
          Seuls les domaines <strong>@2cconseil.com</strong> sont autorisés
        </div>
      </div>
    </div>
  );
}
