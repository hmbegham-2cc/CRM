import {
  useEffect, useMemo, useState, useRef,
  Children, cloneElement, isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import type { Campaign, DailyReport, Role } from "@crc/types";
import {
  getCampaigns, getCampaignsLite, createCampaign, updateCampaign, deleteCampaign,
  assignTeam, assignUserCampaigns, getUsers, getUsersLite, updateUserRole, getReports, upsertReport,
  submitReport, actionReport, getNotifications, markNotificationRead,
  markAllNotificationsRead, deleteNotification, deleteAllNotifications,
  inviteUser, forgotPassword, changePassword, setupPassword, exportReports,
  resendInvite, deleteUser, setUserActive,
} from "./db";
import { useAuth } from "./auth";
import { supabase } from "./supabase";
import { useAsync } from "./hooks/useAsync";
import { useReloadOnFocus } from "./hooks/useReloadOnFocus";
import { ConfirmModal } from "./components/ConfirmModal";
import { diag } from "./lib/diag";
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
  Check,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ReferenceLine
} from "recharts";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "TELECONSEILLER" | "SUPERVISEUR" | "ADMIN" | "COACH_QUALITE";
  active?: boolean;
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

/**
 * Recharts' ResponsiveContainer often reads parent size as -1 when the chart
 * sits inside a CSS grid / flex item without a stable width. We measure the
 * host with ResizeObserver and pass explicit width/height to the chart instead.
 */
function StableResponsiveChart({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 300 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const measure = () => {
      const rect = host.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.max(260, Math.floor(rect.height) || 300);
      if (w >= 120) setDims({ w, h });
    };

    measure();
    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(measure);
    });
    const timer = window.setTimeout(measure, 120);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(measure);
      ro.observe(host);
    }

    return () => {
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      window.clearTimeout(timer);
      ro?.disconnect();
    };
  }, []);

  let chart: ReactNode = null;
  try {
    const only = Children.only(children);
    if (isValidElement(only) && dims.w > 0) {
      chart = cloneElement(only as ReactElement<{ width?: number; height?: number }>, {
        width: dims.w,
        height: dims.h,
      });
    }
  } catch {
    chart = children;
  }

  return (
    <div
      ref={hostRef}
      style={{
        width: "100%",
        height: 300,
        minWidth: 0,
        minHeight: 280,
        position: "relative",
      }}
    >
      {chart}
    </div>
  );
}

export function HomePage() {
  return (
    <div className="card" style={{ textAlign: "center", padding: "48px 24px" }}>
      <div style={{ width: "180px", margin: "0 auto 24px" }}>
        <img src="/logo.png" alt="2C Conseil" style={{ maxWidth: '100%', height: 'auto' }} />
      </div>
      <h1>Bienvenue sur votre portail</h1>
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
    getCampaigns()
      .then((all) => {
        const visibleCampaigns = (user?.role === "ADMIN" || user?.role === "COACH_QUALITE")
          ? all
          : all.filter((c: any) => (c.members || []).some((m: any) => m.user?.id === user?.id));
        setCampaigns(visibleCampaigns);
        setCampaignId((current) => {
          if (current && visibleCampaigns.some((c) => c.id === current)) return current;
          return visibleCampaigns.length === 1 ? visibleCampaigns[0].id : "";
        });
      })
      .catch((err) => {
        console.error("[Rapport] getCampaigns failed", err);
        toast.error(err?.message || "Impossible de charger les campagnes");
      });
  }, [user?.id, user?.role]);

  const [busy, run] = useAsync();

  async function save(submit = false) {
    setMessage("");
    if ([state.incomingTotal, state.outgoingTotal, state.handled, state.missed,
         state.rdvTotal, state.smsTotal].some((n) => n < 0)) {
      const msg = "Les valeurs ne peuvent pas être négatives";
      toast.error(msg); setMessage("Erreur : " + msg);
      return;
    }

    await run(async () => {
      try {
        const report = await upsertReport({ date, campaignId, ...state });
        setReportId(report.id);
        if (submit) {
          await submitReport(report.id);
          toast.success("Rapport soumis avec succès !");
          setMessage("Rapport soumis avec succès.");
        } else {
          toast.info("Brouillon enregistré.");
          setMessage("Brouillon enregistré.");
        }
      } catch (err: any) {
        const errorMsg = err.message || "Impossible d'enregistrer le rapport";
        toast.error(errorMsg);
        setMessage("Erreur : " + errorMsg);
      }
    });
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
        <button className="btn btn-secondary" disabled={!campaignId || busy} onClick={() => save(false)}>
          <Save size={18} />
          {busy ? "Enregistrement..." : "Enregistrer brouillon"}
        </button>
        <button className="btn btn-primary" disabled={!campaignId || busy} onClick={() => save(true)}>
          <Send size={18} />
          {busy ? "Soumission..." : "Soumettre le rapport"}
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

  const load = () => {
    if (!user?.id) {
      // On first mount, auth can still be hydrating. Avoid a stuck loader.
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getReports({ userId: user.id })
      .then(setReports)
      .catch((err) => {
        console.error("[MesSaisies] load failed", err);
        toast.error(err?.message || "Impossible de charger vos rapports");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [user?.id]);
  useReloadOnFocus(load, !!user?.id);

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
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getCampaignsLite()
      .then(setCampaigns)
      .catch((err) => console.error("[Validation] getCampaigns failed", err));
  }, []);

  const load = () => {
    setLoading(true);
    getReports({
      status: "SUBMITTED",
      ...(campaignId ? { campaignId } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    })
      .then(setReports)
      .catch((err) => {
        console.error("[Validation] load failed", err);
        toast.error(err?.message || "Impossible de charger les rapports");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [campaignId, dateFrom, dateTo]);
  useReloadOnFocus(load);

  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [acting, setActing] = useState<Set<string>>(new Set());

  async function act(id: string, action: "validate" | "reject") {
    if (acting.has(id)) return; // anti double-submit
    if (action === "reject" && !(rejectReasons[id] || "").trim()) {
      toast.error("Merci d'indiquer une raison de rejet");
      return;
    }
    setActing((prev) => new Set(prev).add(id));
    try {
      await actionReport(id, action, action === "reject" ? rejectReasons[id] : undefined);
      setReports((prev) => prev.filter((r) => r.id !== id));
      setRejectReasons((prev) => { const next = { ...prev }; delete next[id]; return next; });
      toast.success(action === "validate" ? "Rapport validé" : "Rapport rejeté");
    } catch (err: any) {
      toast.error(err.message || "Action impossible");
    } finally {
      setActing((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
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
                  <button
                    className="btn btn-primary"
                    onClick={() => act(r.id, "validate")}
                    disabled={acting.has(r.id)}
                    style={{ background: "var(--success)" }}
                  >
                    <CheckSquare size={18} />
                    {acting.has(r.id) ? "Validation..." : "Valider le rapport"}
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => act(r.id, "reject")}
                    disabled={acting.has(r.id)}
                  >
                    <AlertCircle size={18} />
                    {acting.has(r.id) ? "Rejet..." : "Rejeter"}
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
  const [viewMode, setViewMode] = useState<'PERSONAL' | 'TEAM'>('TEAM');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userIdFilter, setUserIdFilter] = useState("");
  
  const [pendingCampaignId, setPendingCampaignId] = useState("");
  const [pendingDateFrom, setPendingDateFrom] = useState("");
  const [pendingDateTo, setPendingDateTo] = useState("");
  const [pendingUserId, setPendingUserId] = useState("");

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [prevReports, setPrevReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getCampaignsLite()
      .then(setCampaigns)
      .catch((err) => console.error("[Dashboard] getCampaigns failed", err));
    if (user?.role === 'ADMIN' || user?.role === 'SUPERVISEUR' || user?.role === 'COACH_QUALITE') {
      getUsersLite().then(setUsers as any).catch(() => setUsers([]));
    }
  }, [user]);

  const loadData = async (cid: string, from: string, to: string, uid: string, mode: 'PERSONAL' | 'TEAM') => {
    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const currentParams = {
        ...(cid ? { campaignId: cid } : {}),
        ...(from ? { dateFrom: from } : {}),
        ...(to ? { dateTo: to } : {}),
        ...(mode === 'PERSONAL' ? { userId: user?.id } : (uid ? { userId: uid } : {})),
        // COACH_QUALITE and ADMIN see ALL statuses (including DRAFT) in TEAM mode
        // Other users in TEAM mode: only VALIDATED + SUBMITTED (exclude DRAFT and REJECTED)
        // PERSONAL mode: exclude REJECTED only (allow DRAFT so user sees their work-in-progress)
        ...(mode === 'TEAM'
          ? (user?.role === 'ADMIN' || user?.role === 'COACH_QUALITE'
              ? { excludeStatus: 'REJECTED' as const }  // Admin/Coach see everything except rejected
              : { statusIn: ['VALIDATED', 'SUBMITTED'] as any })  // Others see only validated/submitted
          : { excludeStatus: 'REJECTED' as const }),  // Personal mode: exclude rejected only
      };

      // Load current period
      let currentData = await getReports(currentParams);
      setReports(currentData);

      // Only compute trends when a date range is explicitly set
      if (from && to && !controller.signal.aborted) {
        const start = new Date(from);
        const end = new Date(to);
        const duration = end.getTime() - start.getTime();

        const prevEnd = new Date(start.getTime() - (24 * 60 * 60 * 1000));
        const prevStart = new Date(prevEnd.getTime() - duration);

        const prevParams = {
          ...currentParams,
          dateFrom: prevStart.toISOString().split('T')[0],
          dateTo: prevEnd.toISOString().split('T')[0],
        };
        // Parallel load for previous period
        const previousData = await getReports(prevParams);
        if (!controller.signal.aborted) setPrevReports(previousData);
      } else {
        setPrevReports([]);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error("Erreur lors du chargement des données du dashboard", err);
      toast.error(err?.message || "Impossible de charger les données du dashboard");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  };

  // Chargement initial (attendre le profil pour éviter un mode de vue incohérent)
  useEffect(() => {
    if (!user?.id) return;
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initialMode: 'PERSONAL' | 'TEAM' =
      (user.role === 'TELECONSEILLER' || user.role === 'SUPERVISEUR') ? 'PERSONAL' : 'TEAM';
    // Default: ALL TIME (no date filter). Users can add filters manually.
    setViewMode(initialMode);
    setPendingDateFrom("");
    setPendingDateTo("");
    setPendingUserId("");
    setCampaignId("");
    setDateFrom("");
    setDateTo("");
    setUserIdFilter("");
    loadData("", "", "", "", initialMode);
  }, [user?.id, user?.role]);

  // Reload current filters when the tab regains focus.
  useReloadOnFocus(() => loadData(campaignId, dateFrom, dateTo, userIdFilter, viewMode));

  const handleApplyFilters = () => {
    setCampaignId(pendingCampaignId);
    setDateFrom(pendingDateFrom);
    setDateTo(pendingDateTo);
    setUserIdFilter(pendingUserId);
    loadData(pendingCampaignId, pendingDateFrom, pendingDateTo, pendingUserId, viewMode);
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

  const prevStats = useMemo(() => ({
    incoming: prevReports.reduce((s, r) => s + (Number(r.incomingTotal) || 0), 0),
    outgoing: prevReports.reduce((s, r) => s + (Number(r.outgoingTotal) || 0), 0),
    handled: prevReports.reduce((s, r) => s + (Number(r.handled) || 0), 0),
    missed: prevReports.reduce((s, r) => s + (Number(r.missed) || 0), 0),
    rdv: prevReports.reduce((s, r) => s + (Number(r.rdvTotal) || 0), 0),
  }), [prevReports]);

  const getTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return null;
    const diff = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(diff).toFixed(1),
      isUp: diff >= 0,
      isPositive: diff >= 0 // Par défaut, monter est positif (sauf pour les manqués)
    };
  };

  const conversionRate = useMemo(() => {
    return stats.handled > 0 ? (stats.rdv / stats.handled * 100).toFixed(1) : "0.0";
  }, [stats]);

  const prevConversionRate = useMemo(() => {
    return prevStats.handled > 0 ? (prevStats.rdv / prevStats.handled * 100).toFixed(1) : "0.0";
  }, [prevStats]);

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

  const campaignStatsData = useMemo(() => {
    const data: Record<string, number> = {};
    reports.forEach(r => {
      const name = r.campaign.name;
      data[name] = (data[name] || 0) + (Number(r.handled) || 0);
    });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [reports]);

  const COLORS = ['#ef4444', '#1e293b', '#3b82f6', '#10b981', '#f59e0b', '#6366f1'];

  return (
    <div ref={dashboardRef} className="dashboard-page">
      <div className="card">
        <div className="dashboard-header">
          <div>
            <div className="dashboard-title-row">
              <h2 style={{ margin: 0 }}>
                {viewMode === 'PERSONAL' ? 'Mon Dashboard Personnel' : 'Tableau de bord Équipe'}
              </h2>
              {(user?.role === 'SUPERVISEUR' || user?.role === 'ADMIN' || user?.role === 'COACH_QUALITE') && (
                <div className="view-toggle">
                  <button 
                    onClick={() => { setViewMode('TEAM'); loadData(pendingCampaignId, pendingDateFrom, pendingDateTo, pendingUserId, 'TEAM'); }}
                    className={`btn ${viewMode === 'TEAM' ? 'btn-primary' : ''}`}
                  >
                    Vue Équipe
                  </button>
                  <button 
                    onClick={() => { setViewMode('PERSONAL'); loadData(pendingCampaignId, pendingDateFrom, pendingDateTo, "", 'PERSONAL'); }}
                    className={`btn ${viewMode === 'PERSONAL' ? 'btn-primary' : ''}`}
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
              {dateFrom && dateTo && ` (Comparé à la période précédente)`}
            </p>
          </div>
          <div className="dashboard-actions">
            <button className="btn btn-secondary" onClick={handleExportPDF} title="Télécharger en PDF">
              <Download size={18} />
              PDF
            </button>
            <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
              <TrendingUp color="var(--primary)" />
            </div>
          </div>
        </div>

        <div className="dashboard-filters">
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

          {viewMode === 'TEAM' && (user?.role === 'ADMIN' || user?.role === 'SUPERVISEUR' || user?.role === 'COACH_QUALITE') && (
            <div className="field" style={{ marginBottom: 0 }}>
              <label className="label" htmlFor="dashboard-user">
                <Users size={14} style={{ marginRight: 6 }} />
                Conseiller
              </label>
              <select id="dashboard-user" className="select" value={pendingUserId} onChange={(e) => setPendingUserId(e.target.value)}>
                <option value="">Tous les conseillers</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
              </select>
            </div>
          )}

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

          <button className="btn btn-primary" onClick={handleApplyFilters}>
            <Search size={18} />
            Appliquer les filtres
          </button>
        </div>
      </div>

      <div className="grid4" style={{ marginBottom: "24px" }}>
        <div className="stat-card">
          <div className="stat-label">Appels reçus</div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className="stat-value">{stats.incoming}</div>
            {(() => {
              const trend = getTrend(stats.incoming, prevStats.incoming);
              if (!trend) return null;
              const Icon = trend.isUp ? ArrowUpRight : ArrowDownRight;
              return (
                <span className={`trend ${trend.isUp ? 'trend-up' : 'trend-down'}`}>
                  <Icon size={14} />
                  {trend.value}%
                </span>
              );
            })()}
          </div>
          <div style={{ fontSize: "12px", color: "var(--primary)" }}>Entrants</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Appels émis</div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className="stat-value" style={{ color: "var(--primary)" }}>{stats.outgoing}</div>
            {(() => {
              const trend = getTrend(stats.outgoing, prevStats.outgoing);
              if (!trend) return null;
              const Icon = trend.isUp ? ArrowUpRight : ArrowDownRight;
              return (
                <span className={`trend ${trend.isUp ? 'trend-up' : 'trend-down'}`}>
                  <Icon size={14} />
                  {trend.value}%
                </span>
              );
            })()}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>Sortants</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Taux de Conversion</div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className="stat-value" style={{ color: "var(--accent)" }}>{conversionRate}%</div>
            {(() => {
              const trend = getTrend(Number(conversionRate), Number(prevConversionRate));
              if (!trend) return null;
              const Icon = trend.isUp ? ArrowUpRight : ArrowDownRight;
              return (
                <span className={`trend ${trend.isUp ? 'trend-up' : 'trend-down'}`}>
                  <Icon size={14} />
                  {trend.value}%
                </span>
              );
            })()}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{stats.rdv} rendez-vous</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Qualité (Manqués)</div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div className="stat-value" style={{ color: stats.missed > 0 ? "var(--danger)" : "var(--success)" }}>
              {stats.incoming > 0 ? (stats.missed / stats.incoming * 100).toFixed(1) : 0}%
            </div>
            {(() => {
              const currentQual = stats.incoming > 0 ? (stats.missed / stats.incoming * 100) : 0;
              const prevQual = prevStats.incoming > 0 ? (prevStats.missed / prevStats.incoming * 100) : 0;
              const trend = getTrend(currentQual, prevQual);
              if (!trend) return null;
              const Icon = trend.isUp ? ArrowUpRight : ArrowDownRight;
              // Pour la qualité (taux de manqués), monter est MAUVAIS
              return (
                <span className={`trend ${trend.isUp ? 'trend-down' : 'trend-up'}`}>
                  <Icon size={14} />
                  {trend.value}%
                </span>
              );
            })()}
          </div>
          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{stats.missed} manqués</div>
        </div>
      </div>

      <div className="dashboard-charts">
        {/* Graphique 1: Activité des appels */}
        <div className="card chart-card">
          <div className="chart-title">
            <BarChart3 size={20} color="var(--primary)" />
            <h3 style={{ margin: 0 }}>Répartition des appels</h3>
          </div>
          <StableResponsiveChart>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                />
                <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }}/>
                <ReferenceLine y={50} stroke="rgba(100, 116, 139, 0.5)" strokeDasharray="3 3" />
                <Bar dataKey="recus" name="Reçus" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="emis" name="Émis" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="manques" name="Manqués" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
          </StableResponsiveChart>
        </div>

        {/* Graphique 2: Répartition par Campagne (PieChart) */}
        {viewMode === 'TEAM' && !campaignId && campaignStatsData.length > 0 && (
          <div className="card chart-card">
            <div className="chart-title">
              <Target size={20} color="var(--primary)" />
              <h3 style={{ margin: 0 }}>Volume par Campagne</h3>
            </div>
            <StableResponsiveChart>
                <PieChart>
                  <Pie
                    data={campaignStatsData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {campaignStatsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
            </StableResponsiveChart>
          </div>
        )}

        {/* Graphique 3: Performance RDV */}
        <div className="card chart-card">
          <div className="chart-title">
            <ClipboardCheck size={20} color="var(--success)" />
            <h3 style={{ margin: 0 }}>Performance Rendez-vous</h3>
          </div>
          <StableResponsiveChart>
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
                <ReferenceLine y={10} label={{ value: 'Objectif', position: 'insideRight', fill: '#ef4444', fontSize: 10, fontWeight: 700 }} stroke="#ef4444" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="rdv" name="RDV Fixés" stroke="var(--success)" fillOpacity={1} fill="url(#colorRdv)" strokeWidth={3} />
              </AreaChart>
          </StableResponsiveChart>
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
                          background: u.role === "ADMIN" ? "#fef2f2" : u.role === "COACH_QUALITE" ? "#eff6ff" : u.role === "SUPERVISEUR" ? "var(--accent)" : "#f1f5f9", 
                          color: u.role === "ADMIN" ? "var(--danger)" : u.role === "COACH_QUALITE" ? "var(--primary)" : u.role === "SUPERVISEUR" ? "white" : "var(--primary)",
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
                      <span className={`badge ${getRoleBadgeClass(u.role)}`} style={{ fontSize: "11px" }}>
                        {getRoleLabel(u.role)}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {(u.campaignMemberships || []).map((c: any) => (
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
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => {
    getCampaignsLite()
      .then(setCampaigns)
      .catch((err) => console.error("[AllReports] getCampaigns failed", err));
  }, []);

  // Load only after dates are set (prevents loading all reports at mount)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, campaignId]);

  const load = () => {
    setLoading(true);
    getReports({ campaignId, ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) })
      .then(setReports)
      .catch((err) => {
        console.error("[AllReports] load failed", err);
        toast.error(err?.message || "Impossible de charger les rapports");
      })
      .finally(() => setLoading(false));
  };

  useReloadOnFocus(load);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tous les rapports</h1>
          <p className="muted">Vue détaillée de tous les rapports saisis</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="responsive-filters">
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
  const [busy, run] = useAsync();
  const [toDelete, setToDelete] = useState<Campaign | null>(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    getCampaigns()
      .then(setCampaigns)
      .catch((err) => {
        console.error("[Campagnes] load failed", err);
        toast.error(err?.message || "Impossible de charger les campagnes");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useReloadOnFocus(load);

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
          <button
            className="btn btn-primary"
            disabled={!name.trim() || busy}
            onClick={() => run(async () => {
              try {
                await createCampaign(name);
                toast.success("Campagne créée");
                setName("");
                load();
              } catch (err: any) {
                toast.error(err.message || "Impossible de créer la campagne");
              }
            })}
          >
            <Plus size={18} />
            {busy ? "Création..." : "Créer"}
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
                  disabled={busy}
                  onClick={() => run(async () => {
                    const nextName = prompt("Nouveau nom de campagne", c.name);
                    if (!nextName || nextName === c.name) return;
                    try {
                      await updateCampaign(c.id, { name: nextName });
                      toast.success("Campagne modifiée");
                      load();
                    } catch (err: any) {
                      toast.error(err.message || "Erreur");
                    }
                  })}
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
                  disabled={busy}
                  onClick={() => run(async () => {
                    try {
                      await updateCampaign(c.id, { active: !c.active });
                      toast.success(c.active ? "Campagne désactivée" : "Campagne activée");
                      load();
                    } catch (err: any) {
                      toast.error(err.message || "Erreur");
                    }
                  })}
                >
                  {c.active ? "Désactiver" : "Activer"}
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1, fontSize: "13px" }}
                  disabled={busy}
                  onClick={() => setToDelete(c)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer la campagne"
        message={
          <>
            La campagne <strong>{toDelete?.name}</strong> et tous ses rapports
            associés seront <strong>définitivement supprimés</strong>. Cette action
            est <strong>irréversible</strong>.
          </>
        }
        confirmLabel="Supprimer définitivement"
        variant="danger"
        busy={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={() => run(async () => {
          if (!toDelete) return;
          try {
            await deleteCampaign(toDelete.id);
            toast.success("Campagne supprimée");
            setToDelete(null);
            load();
          } catch (err: any) {
            toast.error(err.message || "Impossible de supprimer");
          }
        })}
      />
    </div>
  );
}

type EquipesMode = "BY_CAMPAIGN" | "BY_USER";

export function EquipesPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [mode, setMode] = useState<EquipesMode>("BY_CAMPAIGN");
  const [campaignId, setCampaignId] = useState("");
  const [userId, setUserId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]); // mode BY_CAMPAIGN
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>([]); // mode BY_USER
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const loadEquipes = () => {
    getCampaigns()
      .then(setCampaigns)
      .catch((err) => {
        console.error("[Equipes] getCampaigns failed", err);
        toast.error(err?.message || "Impossible de charger les campagnes");
      });
    getUsersLite().then(setUsers as any).catch(() => setUsers([]));
  };

  useEffect(() => { loadEquipes(); }, []);
  useReloadOnFocus(loadEquipes);

  // URL param drives the initial mode/selection (deep-linkable).
  useEffect(() => {
    const qpCampaign = searchParams.get("campaignId");
    const qpUser = searchParams.get("userId");
    if (qpUser) {
      setMode("BY_USER");
      setUserId(qpUser);
    } else if (qpCampaign) {
      setMode("BY_CAMPAIGN");
      setCampaignId(qpCampaign);
    }
  }, [searchParams]);

  // Initial selection when target changes.
  useEffect(() => {
    if (mode !== "BY_CAMPAIGN") return;
    const c = campaigns.find((x) => x.id === campaignId);
    setSelectedUsers(c ? (c as any).members.map((m: any) => m.user.id) : []);
    setSearch("");
  }, [campaignId, campaigns, mode]);

  useEffect(() => {
    if (mode !== "BY_USER") return;
    const userCampaigns = campaigns
      .filter((c) => (c as any).members?.some((m: any) => m.user?.id === userId))
      .map((c) => c.id);
    setSelectedCampaigns(userCampaigns);
    setSearch("");
  }, [userId, campaigns, mode]);

  // ── Dirty tracking + diff ─────────────────────────────────
  const initialUsers = useMemo(() => {
    if (mode !== "BY_CAMPAIGN") return new Set<string>();
    const c = campaigns.find((x) => x.id === campaignId);
    return new Set<string>(c ? (c as any).members.map((m: any) => m.user.id) : []);
  }, [campaignId, campaigns, mode]);

  const initialCampaigns = useMemo(() => {
    if (mode !== "BY_USER") return new Set<string>();
    return new Set<string>(
      campaigns
        .filter((c) => (c as any).members?.some((m: any) => m.user?.id === userId))
        .map((c) => c.id),
    );
  }, [userId, campaigns, mode]);

  const diff = useMemo(() => {
    if (mode === "BY_CAMPAIGN") {
      const cur = new Set(selectedUsers);
      const added = [...cur].filter((x) => !initialUsers.has(x)).length;
      const removed = [...initialUsers].filter((x) => !cur.has(x)).length;
      return { added, removed };
    }
    const cur = new Set(selectedCampaigns);
    const added = [...cur].filter((x) => !initialCampaigns.has(x)).length;
    const removed = [...initialCampaigns].filter((x) => !cur.has(x)).length;
    return { added, removed };
  }, [mode, selectedUsers, selectedCampaigns, initialUsers, initialCampaigns]);

  const isDirty = diff.added > 0 || diff.removed > 0;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // ── Filtered + sorted list ────────────────────────────────
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = users.filter((u) => u.active !== false);
    const filtered = q
      ? base.filter(
          (u) =>
            (u.name || "").toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q),
        )
      : base;
    // Members of the current campaign first, then alphabetical.
    return [...filtered].sort((a, b) => {
      const aIn = initialUsers.has(a.id) ? 0 : 1;
      const bIn = initialUsers.has(b.id) ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });
  }, [users, search, initialUsers]);

  const filteredCampaigns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const base = campaigns.filter((c) => (c as any).active !== false);
    const filtered = q ? base.filter((c) => c.name.toLowerCase().includes(q)) : base;
    return [...filtered].sort((a, b) => {
      const aIn = initialCampaigns.has(a.id) ? 0 : 1;
      const bIn = initialCampaigns.has(b.id) ? 0 : 1;
      if (aIn !== bIn) return aIn - bIn;
      return a.name.localeCompare(b.name);
    });
  }, [campaigns, search, initialCampaigns]);

  // ── Actions ───────────────────────────────────────────────
  const reset = () => {
    if (mode === "BY_CAMPAIGN") setSelectedUsers([...initialUsers]);
    else setSelectedCampaigns([...initialCampaigns]);
  };

  const selectAll = () => {
    if (mode === "BY_CAMPAIGN") setSelectedUsers(filteredUsers.map((u) => u.id));
    else setSelectedCampaigns(filteredCampaigns.map((c) => c.id));
  };
  const selectNone = () => {
    if (mode === "BY_CAMPAIGN") setSelectedUsers([]);
    else setSelectedCampaigns([]);
  };

  const handleSwitchMode = (next: EquipesMode) => {
    if (isDirty) {
      const ok = window.confirm(
        "Vous avez des modifications non enregistrées. Les abandonner et changer de mode ?",
      );
      if (!ok) return;
    }
    setMode(next);
    setSearch("");
    setSearchParams({});
  };

  const handleSelectTarget = (id: string) => {
    if (isDirty) {
      const ok = window.confirm(
        "Vous avez des modifications non enregistrées. Les abandonner et changer de sélection ?",
      );
      if (!ok) return;
    }
    if (mode === "BY_CAMPAIGN") {
      setCampaignId(id);
      setSearchParams(id ? { campaignId: id } : {});
    } else {
      setUserId(id);
      setSearchParams(id ? { userId: id } : {});
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      if (mode === "BY_CAMPAIGN") {
        await assignTeam(campaignId, selectedUsers);
      } else {
        await assignUserCampaigns(userId, selectedCampaigns, campaigns);
      }
      toast.success(
        `Équipe mise à jour : +${diff.added} / -${diff.removed}`,
      );
      // Reload to refresh the in-memory state used for diffing.
      const next = await getCampaigns();
      setCampaigns(next);
    } catch (err: any) {
      toast.error(err?.message || "Impossible d'enregistrer");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  const target =
    mode === "BY_CAMPAIGN"
      ? campaigns.find((c) => c.id === campaignId)
      : users.find((u) => u.id === userId);

  const list = mode === "BY_CAMPAIGN" ? filteredUsers : filteredCampaigns;
  const selected = mode === "BY_CAMPAIGN" ? selectedUsers : selectedCampaigns;
  const initial = mode === "BY_CAMPAIGN" ? initialUsers : initialCampaigns;
  const setSelected = mode === "BY_CAMPAIGN" ? setSelectedUsers : setSelectedCampaigns;

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
        {/* Mode switcher */}
        <div
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            padding: 4,
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          {(
            [
              { id: "BY_CAMPAIGN", label: "Par campagne" },
              { id: "BY_USER", label: "Par utilisateur" },
            ] as { id: EquipesMode; label: string }[]
          ).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleSwitchMode(m.id)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: mode === m.id ? "white" : "transparent",
                color: mode === m.id ? "var(--primary)" : "var(--text-muted)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
                boxShadow: mode === m.id ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Target picker */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label className="label" htmlFor="equipes-target">
            {mode === "BY_CAMPAIGN" ? "Choisir une campagne" : "Choisir un utilisateur"}
          </label>
          <select
            id="equipes-target"
            className="select"
            value={mode === "BY_CAMPAIGN" ? campaignId : userId}
            onChange={(e) => handleSelectTarget(e.target.value)}
          >
            <option value="">
              {mode === "BY_CAMPAIGN" ? "— Sélectionner une campagne —" : "— Sélectionner un utilisateur —"}
            </option>
            {mode === "BY_CAMPAIGN"
              ? campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({((c as any).members || []).length})
                  </option>
                ))
              : users
                  .filter((u) => u.active !== false)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({campaigns.filter((c) => (c as any).members?.some((m: any) => m.user?.id === u.id)).length})
                    </option>
                  ))}
          </select>
        </div>

        {target && (
          <>
            {/* Toolbar: search + select all */}
            <div
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: 240,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  background: "white",
                }}
              >
                <Search size={16} className="muted" />
                <input
                  type="text"
                  placeholder={
                    mode === "BY_CAMPAIGN"
                      ? "Rechercher un utilisateur (nom, email)…"
                      : "Rechercher une campagne…"
                  }
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{
                    border: "none",
                    outline: "none",
                    width: "100%",
                    fontSize: 14,
                    background: "transparent",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={selectAll}
                >
                  Tout sélectionner
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: "6px 12px" }}
                  onClick={selectNone}
                >
                  Aucun
                </button>
              </div>
              <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                {selected.length} sélectionné{selected.length !== 1 ? "s" : ""} sur {list.length}
              </div>
            </div>

            {/* List */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 12,
              }}
            >
              {list.length === 0 ? (
                <div className="muted" style={{ fontStyle: "italic", padding: 16 }}>
                  Aucun résultat.
                </div>
              ) : (
                list.map((item) => {
                  const id = item.id;
                  const isSelected = selected.includes(id);
                  const wasMember = initial.has(id);
                  const isAddition = isSelected && !wasMember;
                  const isRemoval = !isSelected && wasMember;
                  const label =
                    mode === "BY_CAMPAIGN"
                      ? (item as UserRow).name || (item as UserRow).email
                      : (item as Campaign).name;
                  const sublabel =
                    mode === "BY_CAMPAIGN"
                      ? (item as UserRow).email
                      : `${((item as any).members || []).length} membre${((item as any).members || []).length !== 1 ? "s" : ""}`;

                  return (
                    <label
                      key={id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: 14,
                        border: `1px solid ${isAddition ? "var(--success)" : isRemoval ? "var(--danger)" : isSelected ? "var(--primary)" : "var(--border)"}`,
                        borderRadius: 12,
                        background: isAddition
                          ? "rgba(16, 185, 129, 0.06)"
                          : isRemoval
                          ? "rgba(239, 68, 68, 0.06)"
                          : isSelected
                          ? "rgba(37, 99, 235, 0.04)"
                          : "white",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                        <input
                          type="checkbox"
                          style={{ width: 18, height: 18, cursor: "pointer", flexShrink: 0 }}
                          checked={isSelected}
                          onChange={() =>
                            setSelected((prev: string[]) =>
                              prev.includes(id)
                                ? prev.filter((x) => x !== id)
                                : [...prev, id],
                            )
                          }
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontWeight: 600,
                              fontSize: 14,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {label}
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {sublabel}
                          </div>
                        </div>
                      </div>
                      {isAddition && (
                        <span
                          className="badge"
                          style={{
                            fontSize: 10,
                            background: "rgba(16, 185, 129, 0.15)",
                            color: "var(--success)",
                            fontWeight: 700,
                          }}
                        >
                          + à ajouter
                        </span>
                      )}
                      {isRemoval && (
                        <span
                          className="badge"
                          style={{
                            fontSize: 10,
                            background: "rgba(239, 68, 68, 0.15)",
                            color: "var(--danger)",
                            fontWeight: 700,
                          }}
                        >
                          − à retirer
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>

      {/* Sticky save bar */}
      {target && (
        <div
          style={{
            position: "sticky",
            bottom: 16,
            marginTop: 16,
            background: "white",
            border: "1px solid var(--border)",
            borderRadius: 12,
            boxShadow: "0 8px 24px rgba(15, 23, 42, 0.08)",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {isDirty ? (
              <span>
                Modifications en attente :
                {diff.added > 0 && (
                  <span style={{ color: "var(--success)", marginLeft: 8 }}>+{diff.added} ajout{diff.added > 1 ? "s" : ""}</span>
                )}
                {diff.removed > 0 && (
                  <span style={{ color: "var(--danger)", marginLeft: 8 }}>−{diff.removed} retrait{diff.removed > 1 ? "s" : ""}</span>
                )}
              </span>
            ) : (
              <span className="muted">Aucune modification.</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {mode === "BY_USER" && userId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(`/utilisateurs`)}
                style={{ fontSize: 13 }}
              >
                ← Utilisateurs
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!isDirty || saving}
              onClick={reset}
              style={{ fontSize: 13 }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!isDirty || saving}
              onClick={save}
              style={{ fontSize: 13 }}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function UtilisateursPage() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteData, setInviteData] = useState({ email: "", name: "", role: "TELECONSEILLER" as any });
  const [searchTerm, setSearchTerm] = useState("");
  const [busy, run] = useAsync();
  const [toDelete, setToDelete] = useState<UserRow | null>(null);
  const [toToggle, setToToggle] = useState<UserRow | null>(null);
  const [displayMode, setDisplayMode] = useState<"CARDS" | "LIST">("CARDS");

  const load = () => {
    setLoading(true);
    getUsers()
      .then(setUsers as any)
      .catch((err) => {
        console.error("[Utilisateurs] load failed", err);
        toast.error(err?.message || "Impossible de charger les utilisateurs");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useReloadOnFocus(load);

  const filteredUsers = useMemo(() => {
    return users.filter((u) =>
      (u.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [users, searchTerm]);

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    run(async () => {
      const tId = toast.loading("Envoi de l'invitation...");
      try {
        await inviteUser(inviteData.email, inviteData.name, inviteData.role);
        toast.success("Utilisateur invité avec succès !", { id: tId });
        setInviteData({ email: "", name: "", role: "TELECONSEILLER" });
        setShowInvite(false);
        load();
      } catch (err: any) {
        toast.error(err.message || "Impossible d'inviter", { id: tId });
      }
    });
  };

  const handleResend = (u: UserRow) => run(async () => {
    const tId = toast.loading("Renvoi de l'invitation...");
    try {
      await resendInvite(u.id);
      toast.success(`Invitation renvoyée à ${u.email}`, { id: tId });
    } catch (err: any) {
      toast.error(err.message || "Impossible de renvoyer", { id: tId });
    }
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Utilisateurs</h1>
          <p className="muted">Gérez vos équipes et invitez de nouveaux collaborateurs</p>
        </div>
        <div className="page-header-actions">
          {currentUser?.role === "ADMIN" && (
            <button className="btn btn-primary" onClick={() => setShowInvite(!showInvite)}>
              {showInvite ? <Plus size={18} style={{ transform: 'rotate(45deg)' }} /> : <UserPlus size={18} />}
              {showInvite ? "Annuler" : "Nouvel utilisateur"}
            </button>
          )}
        </div>
      </div>

      <div className={`users-layout ${showInvite ? "with-invite" : ""}`}>
        <div className="users-shell">
          {/* Barre de recherche */}
          <div className="card" style={{ marginBottom: 0, padding: "12px 20px" }}>
            <div className="users-toolbar">
              <div className="users-search">
                <Search size={18} className="muted" />
                <input
                  type="text"
                  placeholder="Rechercher un utilisateur (nom, email...)"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="view-switch" aria-label="Mode d'affichage des utilisateurs">
                <button
                  type="button"
                  className={`btn ${displayMode === "CARDS" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setDisplayMode("CARDS")}
                >
                  Cartes
                </button>
                <button
                  type="button"
                  className={`btn ${displayMode === "LIST" ? "btn-primary" : "btn-secondary"}`}
                  onClick={() => setDisplayMode("LIST")}
                >
                  Liste
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="card" style={{ textAlign: "center", padding: "48px" }}>
              <div className="muted">Chargement des utilisateurs...</div>
            </div>
          ) : displayMode === "LIST" ? (
            <div className="card users-list-card">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Utilisateur</th>
                      <th>Rôle</th>
                      <th>Campagnes</th>
                      <th>Statut</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                          Aucun utilisateur trouvé
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isActive = u.active !== false;
                        const isSelf = u.id === currentUser?.id;
                        return (
                          <tr key={u.id} style={{ opacity: isActive ? 1 : 0.55 }}>
                            <td>
                              <div className="user-identity">
                                <div className={`user-avatar ${isActive ? "" : "inactive"}`}>
                                  {(u.name || u.email).charAt(0).toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {u.name ?? "Sans nom"}
                                  </div>
                                  <div className="muted" style={{ fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <select
                                className="select"
                                style={{ padding: "6px 8px", fontSize: 12, minWidth: 150 }}
                                value={u.role}
                                disabled={busy || isSelf}
                                onChange={(e) => run(async () => {
                                  const tId = toast.loading("Mise à jour du rôle...");
                                  try {
                                    await updateUserRole(u.id, e.target.value as Role);
                                    toast.success("Rôle mis à jour", { id: tId });
                                    load();
                                  } catch (err: any) {
                                    toast.error(err.message || "Erreur", { id: tId });
                                  }
                                })}
                              >
                                <option value="TELECONSEILLER">Téléconseiller</option>
                                <option value="SUPERVISEUR">Superviseur</option>
                                <option value="COACH_QUALITE">Coach Qualité</option>
                                <option value="ADMIN">Administrateur</option>
                              </select>
                            </td>
                            <td>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                                {u.campaignMemberships.length > 0 ? (
                                  u.campaignMemberships.slice(0, 3).map((c) => (
                                    <span key={c.campaign.name} className="badge badge-validated" style={{ fontSize: 10, padding: "2px 8px" }}>
                                      {c.campaign.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="muted" style={{ fontSize: 12 }}>Aucune</span>
                                )}
                                {u.campaignMemberships.length > 3 && (
                                  <span className="badge badge-draft" style={{ fontSize: 10, padding: "2px 8px" }}>
                                    +{u.campaignMemberships.length - 3}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${isActive ? "badge-validated" : "badge-draft"}`}>
                                {isActive ? "Actif" : "Désactivé"}
                              </span>
                            </td>
                            <td>
                              <div className="user-list-actions">
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: 11, padding: "6px 8px" }}
                                  onClick={() => navigate(`/equipes?userId=${u.id}`)}
                                >
                                  Campagnes
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: 11, padding: "6px 8px" }}
                                  disabled={busy}
                                  onClick={() => handleResend(u)}
                                >
                                  Renvoyer
                                </button>
                                {!isSelf && currentUser?.role === "ADMIN" && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{ fontSize: 11, padding: "6px 8px" }}
                                    disabled={busy}
                                    onClick={() => setToToggle(u)}
                                  >
                                    {isActive ? "Désactiver" : "Réactiver"}
                                  </button>
                                )}
                                {!isSelf && currentUser?.role === "ADMIN" && (
                                  <button
                                    className="btn btn-danger"
                                    style={{ fontSize: 11, padding: "6px 8px" }}
                                    disabled={busy}
                                    onClick={() => setToDelete(u)}
                                  >
                                    Supprimer
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="users-grid">
              {filteredUsers.map((u) => {
                const isActive = u.active !== false;
                const isSelf = u.id === currentUser?.id;
                return (
                <div key={u.id} className="card user-card" style={{
                  margin: 0, padding: "20px", position: "relative",
                  opacity: isActive ? 1 : 0.55,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
                    <div style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "12px",
                      background: isActive
                        ? "linear-gradient(135deg, var(--primary) 0%, #3b82f6 100%)"
                        : "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
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
                      <div style={{ fontWeight: 700, fontSize: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {u.name ?? "Sans nom"}
                        {!isActive && (
                          <span className="badge" style={{ marginLeft: 8, fontSize: 10, background: "#e2e8f0", color: "#475569" }}>Désactivé</span>
                        )}
                      </div>
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
                        disabled={busy || isSelf}
                        onChange={(e) => run(async () => {
                          const tId = toast.loading("Mise à jour du rôle...");
                          try {
                            await updateUserRole(u.id, e.target.value as Role);
                            toast.success("Rôle mis à jour", { id: tId });
                            load();
                          } catch (err: any) {
                            toast.error(err.message || "Erreur", { id: tId });
                          }
                        })}
                      >
                        <option value="TELECONSEILLER">Téléconseiller</option>
                        <option value="SUPERVISEUR">Superviseur</option>
                        <option value="COACH_QUALITE">Coach Qualité</option>
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

                    <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "12px", display: "flex", flexWrap: "wrap", gap: 6 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: "1 1 100%", fontSize: 12, padding: "8px 10px" }}
                        onClick={() => navigate(`/equipes?userId=${u.id}`)}
                        title="Assigner ou retirer cet utilisateur de campagnes"
                      >
                        <Users size={14} style={{ marginRight: 6 }} />
                        Gérer les campagnes
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{ flex: 1, fontSize: 11, padding: "6px 8px", minWidth: 90 }}
                        disabled={busy}
                        onClick={() => handleResend(u)}
                        title="Renvoyer un nouveau lien d'invitation par email"
                      >
                        Renvoyer
                      </button>
                      {!isSelf && currentUser?.role === "ADMIN" && (
                        <button
                          className="btn btn-secondary"
                          style={{ flex: 1, fontSize: 11, padding: "6px 8px", minWidth: 90 }}
                          disabled={busy}
                          onClick={() => setToToggle(u)}
                        >
                          {isActive ? "Désactiver" : "Réactiver"}
                        </button>
                      )}
                      {!isSelf && currentUser?.role === "ADMIN" && (
                        <button
                          className="btn btn-danger"
                          style={{ flex: 1, fontSize: 11, padding: "6px 8px", minWidth: 90 }}
                          disabled={busy}
                          onClick={() => setToDelete(u)}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })}
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
                  <option value="COACH_QUALITE">Coach Qualité</option>
                  <option value="ADMIN">Administrateur</option>
                </select>
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ marginTop: "8px", height: "44px" }}
                disabled={busy}
              >
                {busy ? "Envoi en cours..." : "Envoyer l'invitation"}
              </button>
            </form>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer l'utilisateur"
        message={
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              Le compte <strong>{toDelete?.email}</strong> sera supprimé et anonymisé.
              Cette action est <strong>irréversible</strong>.
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.06)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--danger)", marginBottom: 6 }}>
                  Sera supprimé
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                  <li>Accès au compte (plus de connexion possible)</li>
                  <li>Nom et email (anonymisés)</li>
                  <li>
                    Appartenances aux campagnes
                    {toDelete?.campaignMemberships?.length
                      ? ` (${toDelete.campaignMemberships.length})`
                      : ""}
                  </li>
                  <li>Notifications personnelles</li>
                </ul>
              </div>

              <div
                style={{
                  background: "rgba(16, 185, 129, 0.06)",
                  border: "1px solid rgba(16, 185, 129, 0.2)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, color: "var(--success)", marginBottom: 6 }}>
                  Sera conservé
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
                  <li>
                    <strong>Tous ses rapports</strong> (chiffres comptés dans le dashboard et les exports)
                  </li>
                  <li>L'historique des validations qu'il a faites</li>
                  <li>L'identifiant interne (utilisé par les rapports passés)</li>
                </ul>
              </div>
            </div>

            <div className="muted" style={{ fontSize: 12, fontStyle: "italic" }}>
              Pour bloquer temporairement un utilisateur sans le supprimer, préférez « Désactiver ».
            </div>
          </div>
        }
        confirmLabel="Supprimer définitivement"
        variant="danger"
        busy={busy}
        onCancel={() => setToDelete(null)}
        onConfirm={() => run(async () => {
          if (!toDelete) return;
          try {
            await deleteUser(toDelete.id);
            toast.success("Utilisateur supprimé. Ses rapports sont conservés.");
            setToDelete(null);
            load();
          } catch (err: any) {
            toast.error(err.message || "Impossible de supprimer");
          }
        })}
      />

      <ConfirmModal
        open={!!toToggle}
        title={toToggle?.active === false ? "Réactiver le compte" : "Désactiver le compte"}
        message={
          toToggle?.active === false ? (
            <>
              Réactiver <strong>{toToggle?.email}</strong> ? L'utilisateur pourra à
              nouveau se connecter et travailler.
            </>
          ) : (
            <>
              Désactiver <strong>{toToggle?.email}</strong> ? L'utilisateur ne pourra
              plus se connecter, mais ses données (rapports, historique) seront
              conservées.
            </>
          )
        }
        confirmLabel={toToggle?.active === false ? "Réactiver" : "Désactiver"}
        variant={toToggle?.active === false ? "primary" : "danger"}
        busy={busy}
        onCancel={() => setToToggle(null)}
        onConfirm={() => run(async () => {
          if (!toToggle) return;
          try {
            await setUserActive(toToggle.id, toToggle.active === false);
            toast.success(toToggle.active === false ? "Compte réactivé" : "Compte désactivé");
            setToToggle(null);
            load();
          } catch (err: any) {
            toast.error(err.message || "Impossible de modifier l'état");
          }
        })}
      />
    </div>
  );
}

export function SetupPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [sessionReady, setSessionReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, run] = useAsync();

  useEffect(() => {
    let mounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session) {
          setSessionReady(true);
          setLoading(false);
        } else {
          timeoutId = setTimeout(async () => {
            const { data: { session: s2 } } = await supabase.auth.getSession();
            if (!mounted) return;
            if (s2) {
              setSessionReady(true);
            } else {
              setMsg("Lien invalide ou expiré. Veuillez demander une nouvelle invitation.");
            }
            setLoading(false);
          }, 2000);
        }
      } catch (err) {
        console.error("[SetupPassword] Error checking session:", err);
        if (mounted) {
          setMsg("Erreur lors de la vérification de la session.");
          setLoading(false);
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setSessionReady(true);
        setLoading(false);
        setMsg("");
      }
    });

    checkSession();

    return () => {
      mounted = false;
      if (timeoutId) clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionReady) {
      return setMsg("Erreur : session non prête. Veuillez attendre ou actualiser.");
    }
    setMsg("");
    if (password.length < 8) return setMsg("Erreur : 8 caractères minimum");
    if (password !== confirm) return setMsg("Erreur : les mots de passe ne correspondent pas");
    run(async () => {
      try {
        await setupPassword(password);
        setMsg("Compte configuré ! Redirection…");
        toast.success("Mot de passe configuré — bienvenue !");
        navigate("/", { replace: true });
      } catch (err: any) {
        console.error("[SetupPassword] Error:", err);
        setMsg("Erreur : " + (err.message || "Lien expiré ou invalide"));
        toast.error(err.message || "Échec");
      }
    });
  };

  if (loading && !sessionReady) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <div className="muted">Vérification de votre lien...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }}>
      <div className="card" style={{ maxWidth: 400, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ width: "180px", margin: "0 auto 16px" }}>
            <img src="/logo.png" alt="2C Conseil" style={{ maxWidth: '100%', height: 'auto' }} />
          </div>
          <h2>Configurer votre compte</h2>
          <p className="muted">Choisissez votre mot de passe pour finaliser votre inscription.</p>
        </div>
        <form onSubmit={handleSubmit} style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
          <div className="field">
            <label className="label">Nouveau mot de passe</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          </div>
          <div className="field">
            <label className="label">Confirmer le mot de passe</label>
            <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy || !sessionReady}>
            {busy ? "Enregistrement..." : "Enregistrer et continuer"}
          </button>
          {msg && <p className="muted" style={{ color: msg.includes("Erreur") || msg.includes("invalide") ? "var(--danger)" : "var(--success)" }}>{msg}</p>}
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
  const [busy, run] = useAsync();
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const load = () => {
    setLoading(true);
    getNotifications()
      .then(setNotifications)
      .catch((err) => {
        console.error("[Notifications] load failed", err);
        toast.error(err?.message || "Impossible de charger les notifications");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);
  useReloadOnFocus(load);

  const markAsRead = (id: string) => run(async () => {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  });

  const markAllRead = () => run(async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success("Toutes les notifications marquées comme lues");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  });

  const handleDeleteNotification = (id: string) => run(async () => {
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success("Notification supprimée");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  });

  const clearAll = () => run(async () => {
    try {
      await deleteAllNotifications();
      setNotifications([]);
      setConfirmClearAll(false);
      toast.success("Toutes les notifications ont été effacées");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    }
  });

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
          <button
            className="btn btn-secondary"
            onClick={() => setConfirmClearAll(true)}
            disabled={notifications.length === 0 || busy}
          >
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
                            onClick={() => handleDeleteNotification(n.id)} 
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

      <ConfirmModal
        open={confirmClearAll}
        title="Effacer toutes les notifications"
        message="Toutes vos notifications seront définitivement supprimées. Cette action est irréversible."
        confirmLabel="Tout effacer"
        variant="danger"
        busy={busy}
        onCancel={() => setConfirmClearAll(false)}
        onConfirm={clearAll}
      />
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
      await forgotPassword(email);
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
          <div style={{ width: "200px", margin: "0 auto 16px" }}>
            <img src="/logo.png" alt="2C Conseil" style={{ maxWidth: '100%', height: 'auto' }} />
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
      await changePassword(currentPassword, newPassword);
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

// ── Preset period helper ────────────────────────────────────────────────
function getPresetRange(preset: string): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startOfWeek = (d: Date) => {
    const r = new Date(d);
    r.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
    return r;
  };

  switch (preset) {
    case "this_week": {
      const mon = startOfWeek(today);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case "last_week": {
      const mon = startOfWeek(today); mon.setDate(mon.getDate() - 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { from: fmt(mon), to: fmt(sun) };
    }
    case "this_month": {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { from: fmt(from), to: fmt(to) };
    }
    case "last_month": {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to   = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(from), to: fmt(to) };
    }
    case "this_quarter": {
      const q = Math.floor(today.getMonth() / 3);
      const from = new Date(today.getFullYear(), q * 3, 1);
      const to   = new Date(today.getFullYear(), q * 3 + 3, 0);
      return { from: fmt(from), to: fmt(to) };
    }
    case "this_year": {
      return {
        from: `${today.getFullYear()}-01-01`,
        to:   `${today.getFullYear()}-12-31`,
      };
    }
    default:
      return { from: fmt(new Date(Date.now() - 30 * 86400_000)), to: fmt(today) };
  }
}

export function ExportPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignId, setCampaignId] = useState(""); // "" = all campaigns
  const [groupBy, setGroupBy] = useState<"campaign" | "all">("campaign");
  const [dateFrom, setDateFrom] = useState(getPresetRange("this_month").from);
  const [dateTo,   setDateTo]   = useState(getPresetRange("this_month").to);
  const [preset, setPreset] = useState("this_month");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getCampaignsLite()
      .then(setCampaigns)
      .catch((err) => {
        console.error("[Export] getCampaigns failed", err);
        toast.error(err?.message || "Impossible de charger les campagnes");
      });
  }, []);

  function applyPreset(p: string) {
    setPreset(p);
    if (p !== "custom") {
      const { from, to } = getPresetRange(p);
      setDateFrom(from);
      setDateTo(to);
    }
  }

  async function doExport() {
    setBusy(true);
    const tId = toast.loading("Génération du fichier Excel...");
    try {
      const blob = await exportReports(campaignId || null, dateFrom, dateTo, groupBy);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const label = campaignId
        ? campaigns.find(c => c.id === campaignId)?.name || campaignId
        : "toutes_campagnes";
      const ext = blob.type.includes("ms-excel") || blob.type.includes("xml") ? "xls" : "xlsx";
      const datePart = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : "";
      a.download = `reporting_${label.replace(/\s+/g, "_")}${datePart}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Export terminé !", { id: tId });
    } catch (err: any) {
      toast.error("Échec de l'export : " + err.message, { id: tId });
    } finally {
      setBusy(false);
    }
  }

  const PRESETS = [
    { value: "this_week",    label: "Cette semaine" },
    { value: "last_week",    label: "Semaine dernière" },
    { value: "this_month",   label: "Ce mois" },
    { value: "last_month",   label: "Mois dernier" },
    { value: "this_quarter", label: "Ce trimestre" },
    { value: "this_year",    label: "Cette année" },
    { value: "custom",       label: "Personnalisé" },
  ];

  return (
    <div style={{ maxWidth: 680, margin: "0 auto" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
          <div>
            <h1>Export Excel</h1>
            <p className="muted">Générez des classeurs Excel détaillés par campagne ou période</p>
          </div>
          <div style={{ background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }}>
            <Download color="var(--primary)" />
          </div>
        </div>

        <div style={{ display: "grid", gap: "20px" }}>

          {/* ── Période ── */}
          <div className="field">
            <label className="label">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Période
            </label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => applyPreset(p.value)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: "1px solid",
                    borderColor: preset === p.value ? "var(--primary)" : "#cbd5e1",
                    background: preset === p.value ? "var(--primary)" : "transparent",
                    color: preset === p.value ? "#fff" : "var(--text-muted)",
                    fontSize: 13,
                    cursor: "pointer",
                    fontWeight: preset === p.value ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="label" style={{ fontSize: 12 }}>Du</label>
                <input
                  type="date"
                  className="input"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPreset("custom"); }}
                />
              </div>
              <div>
                <label className="label" style={{ fontSize: 12 }}>Au</label>
                <input
                  type="date"
                  className="input"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPreset("custom"); }}
                />
              </div>
            </div>
          </div>

          {/* ── Campagne ── */}
          <div className="field">
            <label className="label" htmlFor="export-campaign">
              <Target size={14} style={{ marginRight: 6 }} />
              Campagne
            </label>
            <select
              id="export-campaign"
              className="select"
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
            >
              <option value="">Toutes les campagnes</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* ── Organisation (visible uniquement si toutes les campagnes) ── */}
          {!campaignId && (
            <div className="field">
              <label className="label">Organisation du classeur</label>
              <div style={{ display: "flex", gap: 12 }}>
                {[
                  { value: "campaign", label: "Une feuille par campagne + résumé" },
                  { value: "all",      label: "Toutes les données en une feuille" },
                ].map(opt => (
                  <label
                    key={opt.value}
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      border: "1px solid",
                      borderColor: groupBy === opt.value ? "var(--primary)" : "#e2e8f0",
                      borderRadius: 8,
                      cursor: "pointer",
                      fontSize: 13,
                      background: groupBy === opt.value ? "rgba(37,99,235,0.06)" : "transparent",
                      fontWeight: groupBy === opt.value ? 600 : 400,
                      transition: "all 0.15s",
                    }}
                  >
                    <input
                      type="radio"
                      name="groupBy"
                      value={opt.value}
                      checked={groupBy === opt.value}
                      onChange={() => setGroupBy(opt.value as "campaign" | "all")}
                      style={{ accentColor: "var(--primary)" }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── Bouton export ── */}
          <button
            className="btn btn-primary"
            style={{ height: "48px", fontSize: 15, marginTop: 4 }}
            disabled={busy || !dateFrom || !dateTo}
            onClick={doExport}
          >
            {busy ? (
              <>Génération en cours...</>
            ) : (
              <>
                <Download size={18} />
                Télécharger le fichier Excel
              </>
            )}
          </button>

          {!campaignId && groupBy === "campaign" && (
            <p className="muted" style={{ fontSize: 12, marginTop: -12 }}>
              Le classeur contiendra une feuille de résumé + une feuille par campagne active sur la période.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function getRoleLabel(role: string) {
  switch (role) {
    case "TELECONSEILLER": return "Téléconseiller";
    case "SUPERVISEUR": return "Superviseur";
    case "ADMIN": return "Administrateur";
    case "COACH_QUALITE": return "Coach Qualité";
    default: return role;
  }
}

function getRoleBadgeClass(role: string) {
  switch (role) {
    case "ADMIN": return "badge-rejected";
    case "COACH_QUALITE": return "badge-submitted";
    case "SUPERVISEUR": return "badge-validated";
    default: return "badge-draft";
  }
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
    <div className="card table-card">
      <h2 style={{ marginBottom: "20px" }}>{title}</h2>
      <div className="table-scroll">
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
            width: "220px", 
            margin: "0 auto 16px"
          }}>
            <img src="/logo.png" alt="2C Conseil" style={{ maxWidth: '100%', height: 'auto' }} />
          </div>
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
              } catch (err: any) {
                setError(err.message || "Email ou mot de passe incorrect");
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

// ============================================================
// Reporting Campagnes — Tableau récapitulatif pour la direction
// ============================================================

interface CampaignSummary {
  campaignId: string;
  campaignName: string;
  reportCount: number;
  incomingTotal: number;
  outgoingTotal: number;
  handled: number;
  missed: number;
  rdvTotal: number;
  smsTotal: number;
  conversionRate: string;
}

export function ReportingCampagnesPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<CampaignSummary[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo);
  const [dateTo, setDateTo] = useState(today);

  useEffect(() => {
    getCampaignsLite()
      .then(setCampaigns)
      .catch((err) => console.error("[ReportingCampagnes] getCampaigns failed", err));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      // Admin/Coach/Superviseur see all reports except rejected
      const filters: any = { excludeStatus: 'REJECTED' };
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const reports = await getReports(filters);

      // Group by campaign
      const byCampaign: Record<string, CampaignSummary> = {};
      reports.forEach((r) => {
        const cid = r.campaign?.id || 'unknown';
        const cname = r.campaign?.name || 'Inconnue';
        if (!byCampaign[cid]) {
          byCampaign[cid] = {
            campaignId: cid,
            campaignName: cname,
            reportCount: 0,
            incomingTotal: 0,
            outgoingTotal: 0,
            handled: 0,
            missed: 0,
            rdvTotal: 0,
            smsTotal: 0,
            conversionRate: '0.0',
          };
        }
        byCampaign[cid].reportCount++;
        byCampaign[cid].incomingTotal += Number(r.incomingTotal) || 0;
        byCampaign[cid].outgoingTotal += Number(r.outgoingTotal) || 0;
        byCampaign[cid].handled += Number(r.handled) || 0;
        byCampaign[cid].missed += Number(r.missed) || 0;
        byCampaign[cid].rdvTotal += Number(r.rdvTotal) || 0;
        byCampaign[cid].smsTotal += Number(r.smsTotal) || 0;
      });

      // Compute conversion rates
      const result = Object.values(byCampaign).map((c) => ({
        ...c,
        conversionRate: c.handled > 0 ? ((c.rdvTotal / c.handled) * 100).toFixed(1) : '0.0',
      }));

      // Sort by report count desc
      result.sort((a, b) => b.reportCount - a.reportCount);
      setSummaries(result);
    } catch (err: any) {
      console.error("[ReportingCampagnes] load failed", err);
      toast.error(err?.message || "Impossible de charger les données");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const handleExportCSV = () => {
    const headers = [
      "Campagne", "Reçus", "Émis", "Traités",
      "Manqués", "RDV", "SMS"
    ];
    const rows = summaries.map((s) => [
      s.campaignName,
      s.incomingTotal,
      s.outgoingTotal,
      s.handled,
      s.missed,
      s.rdvTotal,
      s.smsTotal,
    ]);
    const csv = [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const datePart = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : "";
    a.download = `reporting_campagnes${datePart}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  };

  const totals = useMemo(() => {
    return summaries.reduce(
      (acc, s) => ({
        reportCount: acc.reportCount + s.reportCount,
        incomingTotal: acc.incomingTotal + s.incomingTotal,
        outgoingTotal: acc.outgoingTotal + s.outgoingTotal,
        handled: acc.handled + s.handled,
        missed: acc.missed + s.missed,
        rdvTotal: acc.rdvTotal + s.rdvTotal,
        smsTotal: acc.smsTotal + s.smsTotal,
      }),
      { reportCount: 0, incomingTotal: 0, outgoingTotal: 0, handled: 0, missed: 0, rdvTotal: 0, smsTotal: 0 }
    );
  }, [summaries]);

  const totalConversion = totals.handled > 0 ? ((totals.rdvTotal / totals.handled) * 100).toFixed(1) : '0.0';

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reporting Campagnes</h1>
          <p className="muted">Tableau récapitulatif par campagne pour la direction</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "24px" }}>
        <div className="responsive-filters">
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Du
            </label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label className="label">
              <Calendar size={14} style={{ marginRight: 6 }} />
              Au
            </label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={load} disabled={loading}>
            <Search size={18} />
            {loading ? "Chargement..." : "Actualiser"}
          </button>
          <button className="btn btn-secondary" onClick={handleExportCSV} disabled={summaries.length === 0}>
            <Download size={18} />
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          Chargement...
        </div>
      ) : summaries.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px" }}>
          <p className="muted">Aucune donnée disponible pour la période sélectionnée.</p>
        </div>
      ) : (
        <div className="card" style={{ overflowX: "auto", padding: 0 }}>
          <table style={{ margin: 0, minWidth: "900px" }}>
            <thead>
              <tr>
                <th>Campagne</th>
                <th style={{ textAlign: "right" }}>Reçus</th>
                <th style={{ textAlign: "right" }}>Émis</th>
                <th style={{ textAlign: "right" }}>Traités</th>
                <th style={{ textAlign: "right" }}>Manqués</th>
                <th style={{ textAlign: "right" }}>RDV</th>
                <th style={{ textAlign: "right" }}>SMS</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.campaignId}>
                  <td style={{ fontWeight: 600 }}>{s.campaignName}</td>
                  <td style={{ textAlign: "right" }}>{s.incomingTotal.toLocaleString('fr-FR')}</td>
                  <td style={{ textAlign: "right" }}>{s.outgoingTotal.toLocaleString('fr-FR')}</td>
                  <td style={{ textAlign: "right" }}>{s.handled.toLocaleString('fr-FR')}</td>
                  <td style={{ textAlign: "right", color: s.missed > 0 ? 'var(--danger)' : undefined }}>
                    {s.missed.toLocaleString('fr-FR')}
                  </td>
                  <td style={{ textAlign: "right", color: 'var(--success)' }}>
                    {s.rdvTotal.toLocaleString('fr-FR')}
                  </td>
                  <td style={{ textAlign: "right" }}>{s.smsTotal.toLocaleString('fr-FR')}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid var(--border)", background: "#f8fafc" }}>
                <td style={{ fontWeight: 700 }}>TOTAL</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{totals.incomingTotal.toLocaleString('fr-FR')}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{totals.outgoingTotal.toLocaleString('fr-FR')}</td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{totals.handled.toLocaleString('fr-FR')}</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: totals.missed > 0 ? 'var(--danger)' : undefined }}>
                  {totals.missed.toLocaleString('fr-FR')}
                </td>
                <td style={{ textAlign: "right", fontWeight: 700, color: 'var(--success)' }}>
                  {totals.rdvTotal.toLocaleString('fr-FR')}
                </td>
                <td style={{ textAlign: "right", fontWeight: 700 }}>{totals.smsTotal.toLocaleString('fr-FR')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
