import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState, useRef } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { request } from "./api";
import { useAuth } from "./auth";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Plus, Save, Send, Calendar, Target, PhoneIncoming, PhoneOutgoing, CheckSquare, PhoneMissed, ClipboardCheck, MessageSquare, Filter, TrendingUp, Settings, Users, Download, AlertCircle, LayoutDashboard, FileEdit, CheckCircle, UserPlus, ShieldCheck, Search, BarChart3, History as HistoryIcon, Bell, Info, CheckCircle2, XCircle, Trash2, Check } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from "recharts";
export function HomePage() {
    return (_jsxs("div", { className: "card", style: { textAlign: "center", padding: "48px 24px" }, children: [_jsx("div", { style: { background: "rgba(37, 99, 235, 0.1)", width: "64px", height: "64px", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }, children: _jsx(LayoutDashboard, { size: 32, color: "var(--primary)" }) }), _jsx("h1", { children: "Bienvenue sur CRC Reporting" }), _jsx("p", { className: "muted", style: { maxWidth: "500px", margin: "0 auto" }, children: "Plateforme de reporting pour le t\u00E9l\u00E9secr\u00E9tariat. Suivez vos indicateurs et g\u00E9rez vos campagnes en temps r\u00E9el." })] }));
}
export function RapportPage() {
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [campaignId, setCampaignId] = useState("");
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [state, setState] = useState({ incomingTotal: 0, outgoingTotal: 0, handled: 0, missed: 0, rdvTotal: 0, smsTotal: 0, observations: "" });
    useEffect(() => {
        setState(prev => ({
            ...prev,
            handled: (Number(prev.incomingTotal) || 0) + (Number(prev.outgoingTotal) || 0)
        }));
    }, [state.incomingTotal, state.outgoingTotal]);
    const [message, setMessage] = useState("");
    const [reportId, setReportId] = useState(null);
    useEffect(() => {
        request("/campaigns").then((all) => {
            // Même si SUPERVISEUR voit toutes les campagnes, la saisie doit rester limitée
            // aux campagnes où il est membre actif.
            if (user?.role === "SUPERVISEUR") {
                setCampaigns(all.filter((c) => (c.members || []).some((m) => m.user?.id === user.id)));
            }
            else {
                setCampaigns(all);
            }
        });
    }, [user]);
    async function save(submit = false) {
        setMessage("");
        try {
            const report = await request("/reports", "POST", { date, campaignId, ...state });
            setReportId(report.id);
            if (submit) {
                await request(`/reports/${report.id}`, "PATCH", { action: "submit" });
                toast.success("Rapport soumis avec succès !");
            }
            else {
                toast.info("Brouillon enregistré.");
            }
            setMessage(submit ? "Rapport soumis avec succès." : "Brouillon enregistré.");
        }
        catch (err) {
            const errorMsg = err.message || "Impossible d'enregistrer le rapport";
            toast.error(errorMsg);
            setMessage("Erreur : " + errorMsg);
        }
    }
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsx("h2", { children: "Mon rapport" }), _jsx("p", { className: "muted", style: { marginTop: 4 }, children: "Renseignez vos indicateurs journaliers. Saisissez directement les chiffres dans les champs." })] }), _jsx("div", { style: { background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }, children: _jsx(FileEdit, { color: "var(--primary)" }) })] }), _jsxs("div", { style: {
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: 16,
                }, children: [_jsxs("div", { className: "field", style: { minWidth: 0 }, children: [_jsxs("label", { className: "label", htmlFor: "reportDate", children: [_jsx(Calendar, { size: 14, style: { marginRight: 6 } }), "Date du rapport"] }), _jsx("input", { id: "reportDate", className: "input", type: "date", value: date, onChange: (e) => setDate(e.target.value) })] }), _jsxs("div", { className: "field", style: { minWidth: 0 }, children: [_jsxs("label", { className: "label", htmlFor: "reportCampaign", children: [_jsx(Target, { size: 14, style: { marginRight: 6 } }), "Campagne"] }), _jsxs("select", { id: "reportCampaign", className: "select", value: campaignId, onChange: (e) => setCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "S\u00E9lectionner une campagne" }), campaigns.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] })] }), _jsx("p", { className: "muted", style: { marginTop: 24, marginBottom: 16, fontSize: 13, fontWeight: 600, borderTop: "1px solid var(--border)", paddingTop: "24px" }, children: "Indicateurs journaliers" }), _jsx("div", { style: {
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 16,
                }, children: [
                    { id: "incomingTotal", label: "Appels reçus", icon: PhoneIncoming, key: "incomingTotal" },
                    { id: "outgoingTotal", label: "Appels émis", icon: PhoneOutgoing, key: "outgoingTotal" },
                    { id: "handled", label: "Appels traités (Auto)", icon: CheckSquare, key: "handled", disabled: true },
                    { id: "missed", label: "Appels manqués", icon: PhoneMissed, key: "missed" },
                    { id: "rdvTotal", label: "Nombre de RDV", icon: ClipboardCheck, key: "rdvTotal" },
                    { id: "smsTotal", label: "Nombre de SMS", icon: MessageSquare, key: "smsTotal" },
                ].map((item) => (_jsxs("div", { className: "field", style: { minWidth: 0 }, children: [_jsxs("label", { className: "label", htmlFor: item.id, children: [_jsx(item.icon, { size: 14, style: { marginRight: 6 } }), item.label] }), _jsx("input", { id: item.id, className: "input", type: "text", inputMode: "numeric", pattern: "[0-9]*", disabled: item.disabled, style: item.disabled ? { background: '#f8fafc', cursor: 'not-allowed', fontWeight: 700, color: 'var(--primary)' } : {}, value: state[item.key], onChange: (e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setState((p) => ({ ...p, [item.key]: val === '' ? 0 : parseInt(val) }));
                            }, placeholder: "0" })] }, item.id))) }), _jsxs("div", { style: { marginTop: 24 }, className: "field", children: [_jsxs("label", { className: "label", htmlFor: "reportObservations", children: [_jsx(MessageSquare, { size: 14, style: { marginRight: 6 } }), "Observations"] }), _jsx("textarea", { id: "reportObservations", className: "textarea", rows: 4, placeholder: "Commentaires, contexte, anomalies...", value: state.observations, onChange: (e) => setState((p) => ({ ...p, observations: e.target.value })) })] }), _jsxs("div", { className: "row", style: { marginTop: 24, borderTop: "1px solid var(--border)", paddingTop: "24px" }, children: [_jsxs("button", { className: "btn btn-secondary", disabled: !campaignId, onClick: () => save(false), children: [_jsx(Save, { size: 18 }), "Enregistrer brouillon"] }), _jsxs("button", { className: "btn btn-primary", disabled: !campaignId, onClick: () => save(true), children: [_jsx(Send, { size: 18 }), "Soumettre le rapport"] }), reportId && (_jsxs("div", { style: { marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }, className: "muted", children: [_jsx(AlertCircle, { size: 14 }), _jsxs("span", { children: ["ID Rapport: ", reportId.slice(0, 8), "..."] })] }))] }), message && (_jsxs("div", { style: {
                    marginTop: 16,
                    padding: "12px 16px",
                    borderRadius: "8px",
                    background: message.includes("Erreur") ? "rgba(239, 68, 68, 0.1)" : "rgba(16, 185, 129, 0.1)",
                    color: message.includes("Erreur") ? "var(--danger)" : "var(--success)",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 8
                }, children: [message.includes("Erreur") ? _jsx(AlertCircle, { size: 18 }) : _jsx(CheckCircle, { size: 18 }), message] }))] }));
}
export function MesSaisiesPage() {
    const { user } = useAuth();
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const qp = new URLSearchParams({ ...(user?.id ? { userId: user.id } : {}) });
        request(`/reports?${qp.toString()}`)
            .then(setReports)
            .finally(() => setLoading(false));
    }, [user?.id]);
    return (_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsx("h1", { children: "Mes saisies" }), _jsx("p", { className: "muted", children: "Historique de vos rapports d'activit\u00E9" })] }), _jsx("div", { style: { background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }, children: _jsx(HistoryIcon, { color: "var(--primary)" }) })] }), loading ? (_jsx("div", { className: "card", style: { textAlign: "center", padding: "48px" }, children: _jsx("div", { className: "muted", children: "Chargement de vos rapports..." }) })) : (_jsx(ReportsTable, { title: "Historique", reports: reports }))] }));
}
export function ValidationPage() {
    const [reports, setReports] = useState([]);
    const [campaignId, setCampaignId] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(false);
    useEffect(() => { request("/campaigns").then(setCampaigns); }, []);
    useEffect(() => {
        setLoading(true);
        const qp = new URLSearchParams({
            status: "SUBMITTED",
            ...(campaignId ? { campaignId } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {})
        });
        request(`/reports?${qp.toString()}`)
            .then(setReports)
            .finally(() => setLoading(false));
    }, [campaignId, dateFrom, dateTo]);
    const [rejectReasons, setRejectReasons] = useState({});
    async function act(id, action) {
        const body = { action };
        if (action === "reject" && rejectReasons[id]) {
            body.reason = rejectReasons[id];
        }
        await request(`/reports/${id}`, "PATCH", body);
        setReports((prev) => prev.filter((r) => r.id !== id));
        setRejectReasons((prev) => { const next = { ...prev }; delete next[id]; return next; });
    }
    return (_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsx("h1", { children: "Validation" }), _jsx("p", { className: "muted", children: "Rapports en attente de v\u00E9rification" })] }), _jsx("div", { style: { background: "rgba(16, 185, 129, 0.1)", padding: "12px", borderRadius: "12px" }, children: _jsx(CheckCircle, { color: "var(--success)" }) })] }), _jsx("div", { className: "card", children: _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }, children: [_jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsxs("label", { className: "label", htmlFor: "validation-campaign", children: [_jsx(Filter, { size: 14, style: { marginRight: 6 } }), "Campagne"] }), _jsxs("select", { id: "validation-campaign", className: "select", value: campaignId, onChange: (e) => setCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "Toutes les campagnes" }), campaigns.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsxs("label", { className: "label", htmlFor: "val-date-from", children: [_jsx(Calendar, { size: 14, style: { marginRight: 6 } }), "Du"] }), _jsx("input", { id: "val-date-from", type: "date", className: "input", value: dateFrom, onChange: (e) => setDateFrom(e.target.value) })] }), _jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsxs("label", { className: "label", htmlFor: "val-date-to", children: [_jsx(Calendar, { size: 14, style: { marginRight: 6 } }), "Au"] }), _jsx("input", { id: "val-date-to", type: "date", className: "input", value: dateTo, onChange: (e) => setDateTo(e.target.value) })] })] }) }), loading ? (_jsx("div", { className: "card", style: { textAlign: "center", padding: "48px" }, children: _jsx("div", { className: "muted", children: "Recherche des rapports en attente..." }) })) : reports.length === 0 ? (_jsxs("div", { className: "card", style: { textAlign: "center", padding: "48px" }, children: [_jsx("div", { style: { marginBottom: "16px", color: "var(--success)" }, children: _jsx(CheckCircle, { size: 48 }) }), _jsx("h3", { children: "Tout est \u00E0 jour !" }), _jsx("p", { className: "muted", children: "Aucun rapport en attente de validation pour le moment." })] })) : (_jsx("div", { style: { display: "grid", gap: "16px" }, children: reports.map((r) => (_jsxs("div", { className: "card", style: { margin: 0 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" }, children: [_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }, children: [_jsx("div", { style: { width: "32px", height: "32px", borderRadius: "50%", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "12px", color: "var(--primary)" }, children: ((r.user?.name || r.user?.email || "U")).charAt(0).toUpperCase() }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 700 }, children: r.user.name ?? r.user.email }), _jsx("div", { className: "muted", style: { fontSize: "12px" }, children: new Date(r.date).toLocaleDateString("fr-FR") })] })] }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [_jsx(Target, { size: 14, className: "muted" }), _jsx("span", { style: { fontWeight: 600 }, children: r.campaign.name })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", width: "100%", marginTop: "16px", padding: "12px", background: "#f8fafc", borderRadius: "12px" }, children: [_jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { className: "muted", style: { fontSize: "10px", fontWeight: 700 }, children: "RE\u00C7US" }), _jsx("div", { style: { fontWeight: 800, color: "var(--primary)" }, children: r.incomingTotal })] }), _jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { className: "muted", style: { fontSize: "10px", fontWeight: 700 }, children: "\u00C9MIS" }), _jsx("div", { style: { fontWeight: 800, color: "var(--primary)" }, children: r.outgoingTotal })] }), _jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { className: "muted", style: { fontSize: "10px", fontWeight: 700 }, children: "TRAIT\u00C9S" }), _jsx("div", { style: { fontWeight: 800, color: "var(--success)" }, children: r.handled })] }), _jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { className: "muted", style: { fontSize: "10px", fontWeight: 700 }, children: "MANQU\u00C9S" }), _jsx("div", { style: { fontWeight: 800, color: "var(--danger)" }, children: r.missed })] }), _jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { className: "muted", style: { fontSize: "10px", fontWeight: 700 }, children: "RDV" }), _jsx("div", { style: { fontWeight: 800, color: "var(--accent)" }, children: r.rdvTotal })] }), _jsxs("div", { style: { textAlign: "center" }, children: [_jsx("div", { className: "muted", style: { fontSize: "10px", fontWeight: 700 }, children: "SMS" }), _jsx("div", { style: { fontWeight: 800, color: "var(--secondary)" }, children: r.smsTotal })] })] })] }), r.observations && (_jsxs("div", { style: { marginTop: "16px", padding: "12px", background: "#f8fafc", borderRadius: "8px", fontSize: "13px" }, children: [_jsx("div", { style: { fontWeight: 600, fontSize: "11px", color: "var(--text-muted)", marginBottom: "4px" }, children: "OBSERVATIONS :" }), r.observations] })), _jsxs("div", { style: { marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }, children: [_jsxs("div", { className: "field", style: { marginBottom: "12px" }, children: [_jsx("label", { className: "label", style: { fontSize: "12px", color: "var(--danger)" }, children: "Raison du rejet (optionnel)" }), _jsx("input", { className: "input", placeholder: "Expliquez pourquoi ce rapport est rejet\u00E9...", value: rejectReasons[r.id] || "", onChange: (e) => setRejectReasons((prev) => ({ ...prev, [r.id]: e.target.value })), style: { fontSize: "13px" } })] }), _jsxs("div", { style: { display: "flex", gap: "12px" }, children: [_jsxs("button", { className: "btn btn-primary", onClick: () => act(r.id, "validate"), style: { background: "var(--success)" }, children: [_jsx(CheckSquare, { size: 18 }), "Valider le rapport"] }), _jsxs("button", { className: "btn btn-danger", onClick: () => act(r.id, "reject"), children: [_jsx(AlertCircle, { size: 18 }), "Rejeter"] })] })] })] }, r.id))) }))] }));
}
export function DashboardPage() {
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState(user?.role === 'TELECONSEILLER' ? 'PERSONAL' : 'TEAM');
    const [campaigns, setCampaigns] = useState([]);
    const [users, setUsers] = useState([]);
    const [campaignId, setCampaignId] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [pendingCampaignId, setPendingCampaignId] = useState("");
    const [pendingDateFrom, setPendingDateFrom] = useState("");
    const [pendingDateTo, setPendingDateTo] = useState("");
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const dashboardRef = useRef(null);
    useEffect(() => {
        // On ne charge que les campagnes auxquelles l'utilisateur a accès
        request("/campaigns").then(setCampaigns);
        if (user?.role === 'ADMIN' || user?.role === 'SUPERVISEUR') {
            request("/users").then(setUsers).catch(() => setUsers([]));
        }
    }, [user]);
    const loadData = (cid, from, to, mode) => {
        setLoading(true);
        const qp = new URLSearchParams({
            ...(cid ? { campaignId: cid } : {}),
            ...(from ? { dateFrom: from } : {}),
            ...(to ? { dateTo: to } : {}),
            ...(mode === 'PERSONAL' ? { userId: user?.id } : {}),
            ...(mode === 'TEAM' ? { status: 'VALIDATED' } : {})
        });
        request(`/reports?${qp.toString()}`)
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
        if (!dashboardRef.current)
            return;
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
        }
        catch (err) {
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
        const daily = {};
        reports.forEach((r) => {
            const d = new Date(r.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
            if (!daily[d])
                daily[d] = { date: d, recus: 0, traites: 0, rdv: 0, emis: 0, manques: 0 };
            daily[d].recus += (Number(r.incomingTotal) || 0);
            daily[d].emis += (Number(r.outgoingTotal) || 0);
            daily[d].traites += (Number(r.handled) || 0);
            daily[d].rdv += (Number(r.rdvTotal) || 0);
            daily[d].manques += (Number(r.missed) || 0);
        });
        return Object.values(daily).sort((a, b) => {
            const dateA = a.date.split('/').reverse().join('');
            const dateB = b.date.split('/').reverse().join('');
            return dateA.localeCompare(dateB);
        });
    }, [reports]);
    const rdvChartData = useMemo(() => {
        return chartData.map((d) => ({
            date: d.date,
            rdv: d.rdv,
            conversion: d.traites > 0 ? ((d.rdv / d.traites) * 100).toFixed(1) : 0
        }));
    }, [chartData]);
    return (_jsxs("div", { ref: dashboardRef, style: { padding: "4px" }, children: [_jsxs("div", { className: "card", children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }, children: [_jsx("h2", { style: { margin: 0 }, children: viewMode === 'PERSONAL' ? 'Mon Dashboard Personnel' : 'Tableau de bord Équipe' }), (user?.role === 'SUPERVISEUR' || user?.role === 'ADMIN') && (_jsxs("div", { style: { display: "flex", background: "#f1f5f9", padding: "4px", borderRadius: "8px", gap: "4px" }, children: [_jsx("button", { onClick: () => { setViewMode('TEAM'); loadData(pendingCampaignId, pendingDateFrom, pendingDateTo, 'TEAM'); }, className: `btn ${viewMode === 'TEAM' ? 'btn-primary' : ''}`, style: { padding: "6px 12px", fontSize: "12px", height: "auto" }, children: "Vue \u00C9quipe" }), _jsx("button", { onClick: () => { setViewMode('PERSONAL'); loadData(pendingCampaignId, pendingDateFrom, pendingDateTo, 'PERSONAL'); }, className: `btn ${viewMode === 'PERSONAL' ? 'btn-primary' : ''}`, style: { padding: "6px 12px", fontSize: "12px", height: "auto" }, children: "Ma Performance" })] }))] }), _jsx("p", { className: "muted", style: { margin: 0 }, children: viewMode === 'PERSONAL'
                                            ? 'Suivi de vos performances et indicateurs personnels'
                                            : 'Statistiques consolidées par campagne' })] }), _jsxs("div", { style: { display: "flex", gap: "12px" }, children: [_jsxs("button", { className: "btn btn-secondary", onClick: handleExportPDF, title: "T\u00E9l\u00E9charger en PDF", children: [_jsx(Download, { size: 18 }), "PDF"] }), _jsx("div", { style: { background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }, children: _jsx(TrendingUp, { color: "var(--primary)" }) })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "flex-end" }, children: [_jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsxs("label", { className: "label", htmlFor: "dashboard-campaign", children: [_jsx(Filter, { size: 14, style: { marginRight: 6 } }), "Campagne"] }), _jsxs("select", { id: "dashboard-campaign", className: "select", value: pendingCampaignId, onChange: (e) => setPendingCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "Toutes les campagnes" }), campaigns.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsxs("label", { className: "label", htmlFor: "date-from", children: [_jsx(Calendar, { size: 14, style: { marginRight: 6 } }), "Du"] }), _jsx("input", { id: "date-from", type: "date", className: "input", value: pendingDateFrom, onChange: (e) => setPendingDateFrom(e.target.value) })] }), _jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsxs("label", { className: "label", htmlFor: "date-to", children: [_jsx(Calendar, { size: 14, style: { marginRight: 6 } }), "Au"] }), _jsx("input", { id: "date-to", type: "date", className: "input", value: pendingDateTo, onChange: (e) => setPendingDateTo(e.target.value) })] }), _jsxs("button", { className: "btn btn-primary", onClick: handleApplyFilters, style: { height: "42px" }, children: [_jsx(Search, { size: 18 }), "Appliquer les filtres"] })] })] }), _jsxs("div", { className: "grid4", style: { marginBottom: "24px" }, children: [_jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-label", children: "Appels re\u00E7us" }), _jsx("div", { className: "stat-value", children: stats.incoming }), _jsx("div", { style: { fontSize: "12px", color: "var(--primary)" }, children: "Entrants" })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-label", children: "Appels \u00E9mis" }), _jsx("div", { className: "stat-value", style: { color: "var(--primary)" }, children: stats.outgoing }), _jsx("div", { style: { fontSize: "12px", color: "var(--text-muted)" }, children: "Sortants" })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-label", children: "Taux de Conversion" }), _jsxs("div", { className: "stat-value", style: { color: "var(--accent)" }, children: [conversionRate, "%"] }), _jsxs("div", { style: { fontSize: "12px", color: "var(--text-muted)" }, children: [stats.rdv, " rendez-vous"] })] }), _jsxs("div", { className: "stat-card", children: [_jsx("div", { className: "stat-label", children: "Qualit\u00E9 (Manqu\u00E9s)" }), _jsxs("div", { className: "stat-value", style: { color: stats.missed > 0 ? "var(--danger)" : "var(--success)" }, children: [stats.incoming > 0 ? (stats.missed / stats.incoming * 100).toFixed(1) : 0, "%"] }), _jsxs("div", { style: { fontSize: "12px", color: "var(--text-muted)" }, children: [stats.missed, " manqu\u00E9s"] })] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "24px" }, children: [_jsxs("div", { className: "card", style: { margin: 0 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }, children: [_jsx(BarChart3, { size: 20, color: "var(--primary)" }), _jsx("h3", { style: { margin: 0 }, children: "R\u00E9partition des appels" })] }), _jsx("div", { style: { width: "100%", height: "300px" }, children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: chartData, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#e2e8f0" }), _jsx(XAxis, { dataKey: "date", stroke: "#64748b", fontSize: 10, tickLine: false, axisLine: false }), _jsx(YAxis, { stroke: "#64748b", fontSize: 10, tickLine: false, axisLine: false }), _jsx(Tooltip, { contentStyle: { borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' } }), _jsx(Legend, { verticalAlign: "top", height: 36, iconType: "circle", wrapperStyle: { fontSize: '12px' } }), _jsx(Bar, { dataKey: "recus", name: "Re\u00E7us", fill: "var(--primary)", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "emis", name: "\u00C9mis", fill: "var(--accent)", radius: [4, 4, 0, 0] }), _jsx(Bar, { dataKey: "manques", name: "Manqu\u00E9s", fill: "var(--danger)", radius: [4, 4, 0, 0] })] }) }) })] }), _jsxs("div", { className: "card", style: { margin: 0 }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }, children: [_jsx(ClipboardCheck, { size: 20, color: "var(--success)" }), _jsx("h3", { style: { margin: 0 }, children: "Performance Rendez-vous" })] }), _jsx("div", { style: { width: "100%", height: "300px" }, children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(AreaChart, { data: rdvChartData, children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "colorRdv", x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "5%", stopColor: "var(--success)", stopOpacity: 0.2 }), _jsx("stop", { offset: "95%", stopColor: "var(--success)", stopOpacity: 0 })] }) }), _jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#e2e8f0" }), _jsx(XAxis, { dataKey: "date", stroke: "#64748b", fontSize: 10, tickLine: false, axisLine: false }), _jsx(YAxis, { stroke: "#64748b", fontSize: 10, tickLine: false, axisLine: false }), _jsx(Tooltip, { contentStyle: { borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' } }), _jsx(Legend, { verticalAlign: "top", height: 36, iconType: "circle", wrapperStyle: { fontSize: '12px' } }), _jsx(Area, { type: "monotone", dataKey: "rdv", name: "RDV Fix\u00E9s", stroke: "var(--success)", fillOpacity: 1, fill: "url(#colorRdv)", strokeWidth: 3 })] }) }) })] })] }), _jsxs("div", { className: "card", style: { padding: 0, overflowX: "auto" }, children: [_jsx("div", { style: { padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }, children: _jsx("h3", { style: { margin: 0, fontSize: "16px" }, children: viewMode === 'PERSONAL' ? 'Mes campagnes actives' : 'Membres de l\'équipe' }) }), _jsxs("table", { style: { margin: 0 }, children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: viewMode === 'PERSONAL' ? 'Campagne' : 'Utilisateur' }), _jsx("th", { children: "R\u00F4le" }), _jsx("th", { children: viewMode === 'PERSONAL' ? 'Statut' : 'Campagnes assignées' })] }) }), _jsx("tbody", { children: viewMode === 'PERSONAL' ? (campaigns.map((c) => (_jsxs("tr", { children: [_jsx("td", { children: _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx("div", { style: { width: "32px", height: "32px", borderRadius: "8px", background: "rgba(37, 99, 235, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }, children: _jsx(Target, { size: 16, color: "var(--primary)" }) }), _jsx("span", { style: { fontWeight: 600 }, children: c.name })] }) }), _jsx("td", { children: _jsx("span", { className: "badge badge-validated", children: "Actif" }) }), _jsx("td", { children: _jsx("span", { className: "muted", style: { fontSize: "12px" }, children: "Assign\u00E9" }) })] }, c.id)))) : (users.map((u) => (_jsxs("tr", { children: [_jsx("td", { children: _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx("div", { style: {
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
                                                        }, children: (u.name || u.email).charAt(0).toUpperCase() }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600, fontSize: "14px" }, children: u.name ?? "Sans nom" }), _jsx("div", { className: "muted", style: { fontSize: "12px" }, children: u.email })] })] }) }), _jsx("td", { children: _jsx("span", { className: `badge ${u.role === "SUPERVISEUR" ? "badge-validated" : "badge-draft"}`, style: { fontSize: "11px" }, children: u.role }) }), _jsx("td", { children: _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px" }, children: u.campaignMemberships.map((c) => (_jsx("span", { className: "badge", style: { fontSize: "10px", background: "#f1f5f9", color: "#475569" }, children: c.campaign.name }, c.campaign.name))) }) })] }, u.id)))) })] })] })] }));
}
export function AllReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(false);
    const [campaigns, setCampaigns] = useState([]);
    const [campaignId, setCampaignId] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    useEffect(() => {
        request("/campaigns").then(setCampaigns);
        load();
    }, []);
    const load = () => {
        setLoading(true);
        const qp = new URLSearchParams({
            ...(campaignId ? { campaignId } : {}),
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {})
        });
        request(`/reports?${qp.toString()}`)
            .then(setReports)
            .finally(() => setLoading(false));
    };
    return (_jsxs("div", { children: [_jsx("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: _jsxs("div", { children: [_jsx("h1", { children: "Tous les rapports" }), _jsx("p", { className: "muted", children: "Vue d\u00E9taill\u00E9e de tous les rapports saisis" })] }) }), _jsx("div", { className: "card", style: { marginBottom: "24px" }, children: _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "flex-end" }, children: [_jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsx("label", { className: "label", children: "Campagne" }), _jsxs("select", { className: "select", value: campaignId, onChange: (e) => setCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "Toutes les campagnes" }), campaigns.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsx("label", { className: "label", children: "Du" }), _jsx("input", { type: "date", className: "input", value: dateFrom, onChange: (e) => setDateFrom(e.target.value) })] }), _jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsx("label", { className: "label", children: "Au" }), _jsx("input", { type: "date", className: "input", value: dateTo, onChange: (e) => setDateTo(e.target.value) })] }), _jsxs("button", { className: "btn btn-primary", onClick: load, children: [_jsx(Search, { size: 18 }), "Filtrer"] })] }) }), loading ? (_jsx("div", { className: "card", style: { textAlign: "center", padding: "48px" }, children: "Chargement..." })) : (_jsx(ReportsTable, { title: "Liste des rapports", reports: reports }))] }));
}
export function CampagnesPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const load = () => {
        setLoading(true);
        request("/campaigns")
            .then(setCampaigns)
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);
    return (_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsx("h1", { children: "Campagnes" }), _jsx("p", { className: "muted", children: "Gestion des campagnes de t\u00E9l\u00E9secr\u00E9tariat" })] }), _jsx("div", { style: { background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }, children: _jsx(Settings, { color: "var(--primary)" }) })] }), _jsxs("div", { className: "card", children: [_jsx("h3", { children: "Cr\u00E9er une nouvelle campagne" }), _jsxs("div", { className: "row", style: { alignItems: "flex-end", marginTop: "16px" }, children: [_jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsx("label", { className: "label", htmlFor: "campaign-name", children: "Nom de la campagne" }), _jsx("input", { id: "campaign-name", className: "input", value: name, onChange: (e) => setName(e.target.value), placeholder: "Ex: AXA Pr\u00E9voyance" })] }), _jsxs("button", { className: "btn btn-primary", onClick: async () => { await request("/campaigns", "POST", { name }); setName(""); load(); }, children: [_jsx(Plus, { size: 18 }), "Cr\u00E9er"] })] })] }), loading ? (_jsx("div", { className: "muted", style: { textAlign: "center", padding: "24px" }, children: "Chargement..." })) : (_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }, children: campaigns.map((c) => (_jsxs("div", { className: "card", style: { margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }, children: [_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }, children: [_jsx("span", { className: `badge ${c.active ? "badge-validated" : "badge-draft"}`, children: c.active ? "Active" : "Inactive" }), _jsxs("div", { className: "muted", style: { fontSize: "12px" }, children: [c.members.length, " membres"] })] }), _jsx("h3", { style: { marginBottom: "8px" }, children: c.name }), _jsx("div", { className: "muted", style: { fontSize: "12px", marginTop: "8px", lineHeight: 1.4 }, children: c.members?.length ? c.members.map((m) => (m.user?.name || m.user?.email)).join(", ") : "Aucun membre" })] }), _jsxs("div", { className: "row", style: { marginTop: "20px", borderTop: "1px solid var(--border)", paddingTop: "16px" }, children: [_jsx("button", { className: "btn btn-secondary", style: { flex: 1, fontSize: "13px" }, onClick: async () => {
                                        const nextName = prompt("Nouveau nom de campagne", c.name);
                                        if (!nextName)
                                            return;
                                        await request(`/campaigns/${c.id}`, "PUT", { name: nextName });
                                        load();
                                    }, children: "Modifier" }), _jsx("button", { className: "btn btn-secondary", style: { flex: 1, fontSize: "13px" }, onClick: () => navigate(`/equipes?campaignId=${c.id}`), children: "Voir l'\u00E9quipe" }), _jsx("button", { className: "btn btn-secondary", style: { flex: 1, fontSize: "13px" }, onClick: async () => { await request(`/campaigns/${c.id}`, "PUT", { active: !c.active }); load(); }, children: c.active ? "Désactiver" : "Activer" }), _jsx("button", { className: "btn btn-danger", style: { flex: 1, fontSize: "13px" }, onClick: async () => { if (confirm("Supprimer cette campagne ?")) {
                                        await request(`/campaigns/${c.id}`, "DELETE");
                                        load();
                                    } }, children: "Supprimer" })] })] }, c.id))) }))] }));
}
export function EquipesPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [users, setUsers] = useState([]);
    const [campaignId, setCampaignId] = useState("");
    const [selected, setSelected] = useState([]);
    const [saving, setSaving] = useState(false);
    const [searchParams] = useSearchParams();
    useEffect(() => {
        request("/campaigns").then(setCampaigns);
        request("/users").then(setUsers).catch(() => setUsers([]));
    }, []);
    useEffect(() => {
        const qpCampaignId = searchParams.get("campaignId");
        if (qpCampaignId)
            setCampaignId(qpCampaignId);
    }, [searchParams]);
    useEffect(() => {
        const c = campaigns.find((x) => x.id === campaignId);
        setSelected(c ? c.members.map((m) => m.user.id) : []);
    }, [campaignId, campaigns]);
    return (_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsx("h1", { children: "\u00C9quipes" }), _jsx("p", { className: "muted", children: "Assignation des conseillers aux campagnes" })] }), _jsx("div", { style: { background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }, children: _jsx(Users, { color: "var(--primary)" }) })] }), _jsxs("div", { className: "card", children: [_jsxs("div", { className: "field", children: [_jsx("label", { className: "label", htmlFor: "equipes-campaign", children: "S\u00E9lectionner une campagne" }), _jsxs("select", { id: "equipes-campaign", className: "select", value: campaignId, onChange: (e) => setCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "S\u00E9lectionner une campagne" }), campaigns.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), campaignId && (_jsxs("div", { style: { marginTop: "24px" }, children: [_jsx("label", { className: "label", style: { marginBottom: "16px", color: "var(--primary)", fontWeight: 700 }, children: "MEMBRES DE LA CAMPAGNE" }), _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "16px" }, children: users.map((u) => {
                                    const isSelected = selected.includes(u.id);
                                    return (_jsxs("div", { style: {
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "16px",
                                            border: "1px solid var(--border)",
                                            borderRadius: "12px",
                                            background: isSelected ? "rgba(37, 99, 235, 0.02)" : "transparent",
                                            borderColor: isSelected ? "var(--primary)" : "var(--border)",
                                            transition: "all 0.2s"
                                        }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx("input", { type: "checkbox", style: { width: "18px", height: "18px" }, checked: isSelected, onChange: () => setSelected((prev) => prev.includes(u.id) ? prev.filter((id) => id !== u.id) : [...prev, u.id]) }), _jsxs("div", { children: [_jsx("div", { style: { fontWeight: 600, fontSize: "14px" }, children: u.name ?? u.email }), _jsx("div", { className: "muted", style: { fontSize: "12px" }, children: u.email })] })] }), isSelected && (_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "8px", padding: "4px 12px", background: "#f1f5f9", borderRadius: "20px" }, children: [_jsx(ShieldCheck, { size: 14, color: u.role === 'SUPERVISEUR' ? "var(--success)" : "#94a3b8" }), _jsxs("select", { className: "select", style: { padding: "2px 4px", fontSize: "11px", height: "auto", width: "auto", border: "none", background: "transparent", fontWeight: 600 }, value: u.role, onChange: async (e) => {
                                                            const tId = toast.loading("Mise à jour...");
                                                            try {
                                                                await request("/users", "PATCH", { userId: u.id, role: e.target.value });
                                                                toast.success("Rôle mis à jour", { id: tId });
                                                                request("/users").then(setUsers);
                                                            }
                                                            catch (err) {
                                                                toast.error("Erreur", { id: tId });
                                                            }
                                                        }, children: [_jsx("option", { value: "TELECONSEILLER", children: "Conseiller" }), _jsx("option", { value: "SUPERVISEUR", children: "Superviseur" })] })] }))] }, u.id));
                                }) }), _jsx("div", { style: { marginTop: "24px", borderTop: "1px solid var(--border)", paddingTop: "24px" }, children: _jsx("button", { className: "btn btn-primary", disabled: saving || !campaignId, onClick: async () => {
                                        setSaving(true);
                                        try {
                                            await request("/teams", "POST", { campaignId, userIds: selected });
                                            toast.success("Équipe mise à jour avec succès");
                                        }
                                        finally {
                                            setSaving(false);
                                        }
                                    }, children: saving ? "Enregistrement..." : "Enregistrer l'équipe" }) })] }))] })] }));
}
export function UtilisateursPage() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteData, setInviteData] = useState({ email: "", name: "", role: "TELECONSEILLER" });
    const [inviteMsg, setInviteMsg] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const load = () => {
        setLoading(true);
        request("/users")
            .then(setUsers)
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);
    const filteredUsers = useMemo(() => {
        return users.filter(u => (u.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [users, searchTerm]);
    const handleInvite = async (e) => {
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
        }
        catch (err) {
            const errorMsg = err.message || "Impossible d'inviter";
            toast.error(errorMsg, { id: tId });
            setInviteMsg("Erreur : " + errorMsg);
        }
    };
    return (_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsx("h1", { children: "Utilisateurs" }), _jsx("p", { className: "muted", children: "G\u00E9rez vos \u00E9quipes et invitez de nouveaux collaborateurs" })] }), _jsxs("button", { className: "btn btn-primary", onClick: () => setShowInvite(!showInvite), children: [showInvite ? _jsx(Plus, { size: 18, style: { transform: 'rotate(45deg)' } }) : _jsx(UserPlus, { size: 18 }), showInvite ? "Annuler" : "Nouvel utilisateur"] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: showInvite ? "1fr 350px" : "1fr", gap: "24px", alignItems: "start" }, children: [_jsxs("div", { style: { display: "grid", gap: "20px" }, children: [_jsx("div", { className: "card", style: { marginBottom: 0, padding: "12px 20px" }, children: _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx(Search, { size: 18, className: "muted" }), _jsx("input", { type: "text", placeholder: "Rechercher un utilisateur (nom, email...)", style: { border: "none", outline: "none", width: "100%", fontSize: "15px", background: "transparent" }, value: searchTerm, onChange: (e) => setSearchTerm(e.target.value) })] }) }), loading ? (_jsx("div", { className: "card", style: { textAlign: "center", padding: "48px" }, children: _jsx("div", { className: "muted", children: "Chargement des utilisateurs..." }) })) : (_jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }, children: filteredUsers.map((u) => (_jsxs("div", { className: "card user-card", style: { margin: 0, padding: "20px", position: "relative" }, children: [_jsxs("div", { style: { display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }, children: [_jsx("div", { style: {
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
                                                    }, children: (u.name || u.email).charAt(0).toUpperCase() }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontWeight: 700, fontSize: "16px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: u.name ?? "Sans nom" }), _jsx("div", { className: "muted", style: { fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }, children: u.email })] })] }), _jsxs("div", { style: { display: "grid", gap: "12px" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [_jsx("span", { className: "muted", style: { fontSize: "12px", fontWeight: 600 }, children: "R\u00D4LE" }), _jsxs("select", { className: "select", style: { padding: "4px 8px", fontSize: "12px", width: "auto", height: "auto" }, value: u.role, onChange: async (e) => {
                                                                const tId = toast.loading("Mise à jour du rôle...");
                                                                try {
                                                                    await request("/users", "PATCH", { userId: u.id, role: e.target.value });
                                                                    toast.success("Rôle mis à jour", { id: tId });
                                                                    load();
                                                                }
                                                                catch (err) {
                                                                    toast.error("Erreur", { id: tId });
                                                                }
                                                            }, children: [_jsx("option", { value: "TELECONSEILLER", children: "T\u00E9l\u00E9conseiller" }), _jsx("option", { value: "SUPERVISEUR", children: "Superviseur" }), _jsx("option", { value: "ADMIN", children: "Administrateur" })] })] }), _jsxs("div", { style: { borderTop: "1px solid #f1f5f9", paddingTop: "12px" }, children: [_jsx("div", { className: "muted", style: { fontSize: "11px", fontWeight: 700, marginBottom: "8px", letterSpacing: "0.05em" }, children: "CAMPAGNES ACTIVES" }), _jsx("div", { style: { display: "flex", flexWrap: "wrap", gap: "6px" }, children: u.campaignMemberships.length > 0 ? (u.campaignMemberships.map((c) => (_jsx("span", { className: "badge badge-validated", style: { fontSize: "10px", padding: "2px 8px" }, children: c.campaign.name }, c.campaign.name)))) : (_jsx("span", { className: "muted", style: { fontSize: "11px", fontStyle: "italic" }, children: "Aucune campagne" })) })] })] })] }, u.id))) }))] }), showInvite && (_jsxs("div", { className: "card", style: { margin: 0, position: "sticky", top: "24px", border: "1px solid var(--primary)", boxShadow: "0 10px 25px rgba(37, 99, 235, 0.1)" }, children: [_jsxs("h3", { style: { display: "flex", alignItems: "center", gap: "10px" }, children: [_jsx(UserPlus, { size: 20, color: "var(--primary)" }), "Inviter un membre"] }), _jsxs("form", { onSubmit: handleInvite, style: { marginTop: "20px", display: "grid", gap: "16px" }, children: [_jsxs("div", { className: "field", children: [_jsx("label", { className: "label", children: "Nom complet" }), _jsx("input", { className: "input", placeholder: "Ex: Jean Dupont", value: inviteData.name, onChange: e => setInviteData({ ...inviteData, name: e.target.value }), required: true })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "label", children: "Email professionnel" }), _jsx("input", { className: "input", type: "email", placeholder: "nom@2cconseil.com", value: inviteData.email, onChange: e => setInviteData({ ...inviteData, email: e.target.value }), required: true })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "label", children: "R\u00F4le assign\u00E9" }), _jsxs("select", { className: "select", value: inviteData.role, onChange: e => setInviteData({ ...inviteData, role: e.target.value }), children: [_jsx("option", { value: "TELECONSEILLER", children: "T\u00E9l\u00E9conseiller" }), _jsx("option", { value: "SUPERVISEUR", children: "Superviseur" }), _jsx("option", { value: "ADMIN", children: "Administrateur" })] })] }), _jsx("button", { type: "submit", className: "btn btn-primary", style: { marginTop: "8px", height: "44px" }, children: "Envoyer l'invitation" })] })] }))] })] }));
}
export function SetupPasswordPage() {
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const token = params.get("token");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    if (!token)
        return _jsx(Navigate, { to: "/login" });
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirm)
            return setMsg("Les mots de passe ne correspondent pas");
        setLoading(true);
        try {
            await request("/auth/setup-password", "POST", { token, password });
            setMsg("Succès ! Redirection vers la connexion...");
            setTimeout(() => navigate("/login"), 2000);
        }
        catch (err) {
            setMsg("Erreur : " + (err.message || "Impossible de configurer le mot de passe"));
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--background)" }, children: _jsxs("div", { className: "card", style: { maxWidth: 400, width: "100%" }, children: [_jsx("h2", { children: "Configurer votre compte" }), _jsx("p", { className: "muted", children: "Veuillez choisir votre mot de passe pour finaliser votre inscription." }), _jsxs("form", { onSubmit: handleSubmit, style: { marginTop: "24px", display: "grid", gap: "16px" }, children: [_jsxs("div", { className: "field", children: [_jsx("label", { className: "label", children: "Nouveau mot de passe" }), _jsx("input", { className: "input", type: "password", value: password, onChange: e => setPassword(e.target.value), required: true, minLength: 8 })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "label", children: "Confirmer le mot de passe" }), _jsx("input", { className: "input", type: "password", value: confirm, onChange: e => setConfirm(e.target.value), required: true })] }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: loading, children: loading ? "Chargement..." : "Enregistrer et continuer" }), msg && _jsx("p", { className: "muted", style: { color: msg.includes("Erreur") ? "var(--danger)" : "var(--success)" }, children: msg })] })] }) }));
}
export function NotificationsPage() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const load = () => {
        setLoading(true);
        request("/notifications")
            .then(setNotifications)
            .finally(() => setLoading(false));
    };
    useEffect(() => { load(); }, []);
    const markAsRead = async (id) => {
        await request(`/notifications/${id}/read`, "PATCH");
        setNotifications((prev) => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };
    const markAllRead = async () => {
        await request("/notifications/read-all", "PATCH");
        setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
        toast.success("Toutes les notifications marquées comme lues");
    };
    const deleteNotification = async (id) => {
        await request(`/notifications/${id}`, "DELETE");
        setNotifications((prev) => prev.filter(n => n.id !== id));
        toast.success("Notification supprimée");
    };
    const clearAll = async () => {
        await request("/notifications", "DELETE");
        setNotifications([]);
        toast.success("Toutes les notifications ont été effacées");
    };
    const getTypeIcon = (type) => {
        switch (type) {
            case "success": return _jsx(CheckCircle2, { size: 20, color: "var(--success)" });
            case "warning": return _jsx(AlertCircle, { size: 20, color: "var(--accent)" });
            case "error": return _jsx(XCircle, { size: 20, color: "var(--danger)" });
            default: return _jsx(Info, { size: 20, color: "var(--primary)" });
        }
    };
    const getTypeBg = (type) => {
        switch (type) {
            case "success": return "rgba(16, 185, 129, 0.1)";
            case "warning": return "rgba(245, 158, 11, 0.1)";
            case "error": return "rgba(239, 68, 68, 0.1)";
            default: return "rgba(37, 99, 235, 0.1)";
        }
    };
    const getTypeBorder = (type, read) => {
        if (read)
            return "1px solid var(--border)";
        switch (type) {
            case "success": return "4px solid var(--success)";
            case "warning": return "4px solid var(--accent)";
            case "error": return "4px solid var(--danger)";
            default: return "4px solid var(--primary)";
        }
    };
    return (_jsxs("div", { children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsx("h1", { children: "Notifications" }), _jsx("p", { className: "muted", children: "Suivez les mises \u00E0 jour et les alertes syst\u00E8me" })] }), _jsxs("div", { style: { display: "flex", gap: "12px" }, children: [notifications.some(n => !n.read) && (_jsxs("button", { className: "btn btn-secondary", onClick: markAllRead, children: [_jsx(Check, { size: 16 }), "Tout marquer comme lu"] })), _jsxs("button", { className: "btn btn-secondary", onClick: clearAll, disabled: notifications.length === 0, children: [_jsx(Trash2, { size: 16 }), "Tout effacer"] }), _jsx("div", { style: { background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }, children: _jsx(Bell, { color: "var(--primary)" }) })] })] }), loading ? (_jsx("div", { className: "card", style: { textAlign: "center", padding: "48px" }, children: _jsx("div", { className: "muted", children: "Chargement des notifications..." }) })) : (_jsx("div", { className: "grid1", style: { gap: "16px" }, children: notifications.length > 0 ? (notifications.map((n) => (_jsx("div", { className: "card", style: {
                        margin: 0,
                        borderLeft: getTypeBorder(n.type, n.read),
                        opacity: n.read ? 0.7 : 1,
                        transition: "all 0.2s"
                    }, children: _jsxs("div", { style: { display: "flex", gap: "16px", alignItems: "flex-start" }, children: [_jsx("div", { style: {
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "10px",
                                    background: getTypeBg(n.type),
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    flexShrink: 0
                                }, children: getTypeIcon(n.type) }), _jsxs("div", { style: { flex: 1 }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "4px" }, children: [_jsx("h3", { style: { fontSize: "16px", margin: 0 }, children: n.title }), _jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [_jsx("span", { className: "muted", style: { fontSize: "12px" }, children: new Date(n.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) }), _jsxs("div", { style: { display: "flex", gap: "4px" }, children: [!n.read && (_jsx("button", { onClick: () => markAsRead(n.id), className: "btn-icon", title: "Marquer comme lu", style: { padding: "4px", color: "var(--success)" }, children: _jsx(Check, { size: 16 }) })), _jsx("button", { onClick: () => deleteNotification(n.id), className: "btn-icon", title: "Supprimer", style: { padding: "4px", color: "var(--danger)" }, children: _jsx(Trash2, { size: 16 }) })] })] })] }), _jsx("p", { style: { margin: 0, color: "#475569", lineHeight: "1.5", fontSize: "14px" }, children: n.message })] })] }) }, n.id)))) : (_jsxs("div", { className: "card", style: { textAlign: "center", padding: "48px" }, children: [_jsx("div", { className: "muted", style: { marginBottom: "16px" }, children: _jsx(Bell, { size: 48, style: { opacity: 0.2 } }) }), _jsx("h3", { children: "Aucune notification" }), _jsx("p", { className: "muted", children: "Vous \u00EAtes \u00E0 jour !" })] })) }))] }));
}
export function ForgotPasswordPage() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await request("/auth/forgot-password", "POST", { email });
            setSent(true);
        }
        catch {
            setSent(true); // Même en cas d'erreur, on montre le même message pour ne pas révéler les emails
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsx("div", { style: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", padding: "20px" }, children: _jsxs("div", { style: { maxWidth: 400, width: "100%" }, className: "card", children: [_jsxs("div", { style: { textAlign: "center", marginBottom: "32px" }, children: [_jsx("div", { style: { width: "56px", height: "56px", background: "rgba(37, 99, 235, 0.1)", borderRadius: "14px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }, children: _jsx(TrendingUp, { size: 30, color: "var(--primary)" }) }), _jsx("h2", { style: { marginBottom: "8px" }, children: "Mot de passe oubli\u00E9" }), _jsx("p", { className: "muted", children: "Entrez votre email pour recevoir un lien de r\u00E9initialisation" })] }), sent ? (_jsxs("div", { style: { textAlign: "center", padding: "20px 0" }, children: [_jsx(CheckCircle, { size: 48, color: "var(--success)", style: { marginBottom: "16px" } }), _jsx("p", { style: { fontWeight: 600, marginBottom: "8px" }, children: "Email envoy\u00E9 !" }), _jsx("p", { className: "muted", style: { fontSize: "14px" }, children: "Si cet email existe dans notre syst\u00E8me, vous recevrez un lien de r\u00E9initialisation." }), _jsx("button", { className: "btn btn-primary", style: { marginTop: "24px" }, onClick: () => navigate("/login"), children: "Retour \u00E0 la connexion" })] })) : (_jsxs("form", { onSubmit: handleSubmit, style: { display: "grid", gap: "20px" }, children: [_jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsx("label", { className: "label", children: "Email professionnel" }), _jsx("input", { className: "input", type: "email", placeholder: "votre.email@2cconseil.com", value: email, onChange: (e) => setEmail(e.target.value), required: true })] }), _jsx("button", { type: "submit", className: "btn btn-primary", style: { height: "48px" }, disabled: loading, children: loading ? "Envoi en cours..." : "Envoyer le lien" })] }))] }) }));
}
export function ChangePasswordPage() {
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const handleSubmit = async (e) => {
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
        }
        catch (err) {
            const errorMsg = err.message || "Erreur lors du changement de mot de passe";
            setMsg(errorMsg);
            toast.error(errorMsg);
        }
        finally {
            setLoading(false);
        }
    };
    return (_jsxs("div", { className: "card", style: { maxWidth: 500, margin: "0 auto" }, children: [_jsx("h2", { children: "Changer mon mot de passe" }), _jsx("p", { className: "muted", style: { marginTop: 4 }, children: "Modifiez votre mot de passe pour s\u00E9curiser votre compte" }), _jsxs("form", { onSubmit: handleSubmit, style: { marginTop: "24px", display: "grid", gap: "16px" }, children: [_jsxs("div", { className: "field", children: [_jsx("label", { className: "label", children: "Mot de passe actuel" }), _jsx("input", { className: "input", type: "password", value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), required: true })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "label", children: "Nouveau mot de passe" }), _jsx("input", { className: "input", type: "password", value: newPassword, onChange: (e) => setNewPassword(e.target.value), required: true, minLength: 8 })] }), _jsxs("div", { className: "field", children: [_jsx("label", { className: "label", children: "Confirmer le nouveau mot de passe" }), _jsx("input", { className: "input", type: "password", value: confirm, onChange: (e) => setConfirm(e.target.value), required: true })] }), _jsx("button", { type: "submit", className: "btn btn-primary", disabled: loading, children: loading ? "Enregistrement..." : "Changer le mot de passe" }), msg && _jsx("p", { style: { color: msg.includes("Erreur") || msg.includes("correspondent") || msg.includes("incorrect") ? "var(--danger)" : "var(--success)", fontWeight: 600, fontSize: "14px" }, children: msg })] })] }));
}
export function ExportPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [campaignId, setCampaignId] = useState("");
    const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
    const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
    useEffect(() => { request("/campaigns").then(setCampaigns); }, []);
    async function doExport() {
        const qp = new URLSearchParams({
            campaignId,
            ...(dateFrom ? { dateFrom } : {}),
            ...(dateTo ? { dateTo } : {})
        });
        const tId = toast.loading("Génération du fichier Excel...");
        try {
            const blob = await request(`/export?${qp.toString()}`, "GET", undefined, true);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `reporting_${campaignId}_${Date.now()}.xlsx`;
            a.click();
            toast.success("Export terminé !", { id: tId });
        }
        catch (err) {
            toast.error("Échec de l'export : " + err.message, { id: tId });
        }
    }
    return (_jsxs("div", { className: "card", children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }, children: [_jsxs("div", { children: [_jsx("h1", { children: "Export Excel" }), _jsx("p", { className: "muted", children: "G\u00E9n\u00E9rez des rapports d\u00E9taill\u00E9s au format Excel" })] }), _jsx("div", { style: { background: "rgba(37, 99, 235, 0.1)", padding: "12px", borderRadius: "12px" }, children: _jsx(Download, { color: "var(--primary)" }) })] }), _jsxs("div", { style: { display: "grid", gap: "20px" }, children: [_jsxs("div", { className: "field", children: [_jsxs("label", { className: "label", htmlFor: "export-campaign", children: [_jsx(Target, { size: 14, style: { marginRight: 6 } }), "S\u00E9lectionner la campagne"] }), _jsxs("select", { id: "export-campaign", className: "select", value: campaignId, onChange: (e) => setCampaignId(e.target.value), children: [_jsx("option", { value: "", children: "S\u00E9lectionner une campagne" }), campaigns.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] })] }), _jsxs("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }, children: [_jsxs("div", { className: "field", children: [_jsxs("label", { className: "label", htmlFor: "exp-date-from", children: [_jsx(Calendar, { size: 14, style: { marginRight: 6 } }), "Date de d\u00E9but"] }), _jsx("input", { id: "exp-date-from", type: "date", className: "input", value: dateFrom, onChange: (e) => setDateFrom(e.target.value) })] }), _jsxs("div", { className: "field", children: [_jsxs("label", { className: "label", htmlFor: "exp-date-to", children: [_jsx(Calendar, { size: 14, style: { marginRight: 6 } }), "Date de fin"] }), _jsx("input", { id: "exp-date-to", type: "date", className: "input", value: dateTo, onChange: (e) => setDateTo(e.target.value) })] })] }), _jsxs("button", { className: "btn btn-primary", style: { height: "48px" }, disabled: !campaignId, onClick: doExport, children: [_jsx(Download, { size: 18 }), "G\u00E9n\u00E9rer le fichier Excel"] })] })] }));
}
function getStatusBadgeClass(status) {
    switch (status) {
        case "DRAFT": return "badge-draft";
        case "SUBMITTED": return "badge-submitted";
        case "VALIDATED": return "badge-validated";
        case "REJECTED": return "badge-rejected";
        default: return "";
    }
}
function ReportsTable({ title, reports }) {
    return (_jsxs("div", { className: "card", style: { overflowX: "auto" }, children: [_jsx("h2", { style: { marginBottom: "20px" }, children: title }), _jsxs("table", { children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { children: "Date" }), _jsx("th", { children: "Campagne" }), _jsx("th", { children: "Conseiller" }), _jsx("th", { children: "Re\u00E7us" }), _jsx("th", { children: "\u00C9mis" }), _jsx("th", { children: "Trait\u00E9s" }), _jsx("th", { children: "Manqu\u00E9s" }), _jsx("th", { children: "RDV" }), _jsx("th", { children: "SMS" }), _jsx("th", { children: "Statut" })] }) }), _jsx("tbody", { children: reports.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 10, style: { textAlign: "center", padding: "40px", color: "var(--text-muted)" }, children: "Aucun rapport trouv\u00E9" }) })) : (reports.map((r) => (_jsxs("tr", { children: [_jsx("td", { style: { fontWeight: 600 }, children: new Date(r.date).toLocaleDateString("fr-FR") }), _jsx("td", { children: r.campaign.name }), _jsx("td", { children: r.user.name ?? r.user.email }), _jsx("td", { children: r.incomingTotal }), _jsx("td", { children: r.outgoingTotal }), _jsx("td", { children: r.handled }), _jsx("td", { style: { color: r.missed > 0 ? "var(--danger)" : "inherit" }, children: r.missed }), _jsx("td", { children: r.rdvTotal }), _jsx("td", { children: r.smsTotal }), _jsx("td", { children: _jsx("span", { className: `badge ${getStatusBadgeClass(r.status)}`, children: r.status }) })] }, r.id)))) })] })] }));
}
export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    return (_jsx("div", { style: {
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
            padding: "20px"
        }, children: _jsxs("div", { style: { maxWidth: 400, width: "100%" }, className: "card", children: [_jsxs("div", { style: { textAlign: "center", marginBottom: "32px" }, children: [_jsx("div", { style: {
                                width: "56px",
                                height: "56px",
                                background: "rgba(37, 99, 235, 0.1)",
                                borderRadius: "14px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                margin: "0 auto 16px"
                            }, children: _jsx(TrendingUp, { size: 30, color: "var(--primary)" }) }), _jsx("h2", { style: { marginBottom: "8px" }, children: "CRC Reporting" }), _jsx("p", { className: "muted", children: "Connectez-vous pour acc\u00E9der au portail" })] }), error && (_jsxs("div", { style: {
                        marginBottom: "20px",
                        padding: "12px",
                        borderRadius: "8px",
                        background: "rgba(239, 68, 68, 0.1)",
                        color: "var(--danger)",
                        fontSize: "14px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px"
                    }, children: [_jsx(AlertCircle, { size: 16 }), error] })), _jsxs("div", { style: { display: "grid", gap: "20px" }, children: [_jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsx("label", { className: "label", htmlFor: "login-email", children: "Email professionnel" }), _jsx("input", { id: "login-email", className: "input", placeholder: "votre.email@2cconseil.com", value: email, onChange: (e) => setEmail(e.target.value) })] }), _jsxs("div", { className: "field", style: { marginBottom: 0 }, children: [_jsx("label", { className: "label", htmlFor: "login-password", children: "Mot de passe" }), _jsx("input", { id: "login-password", className: "input", type: "password", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", value: password, onChange: (e) => setPassword(e.target.value) })] }), _jsx("button", { className: "btn btn-primary", style: { marginTop: 8, height: "48px" }, disabled: loading, onClick: async () => {
                                if (!email || !password) {
                                    setError("Veuillez remplir tous les champs");
                                    return;
                                }
                                setLoading(true);
                                setError("");
                                try {
                                    await login(email, password);
                                }
                                catch {
                                    setError("Email ou mot de passe incorrect");
                                }
                                finally {
                                    setLoading(false);
                                }
                            }, children: loading ? "Connexion..." : "Se connecter" })] }), _jsx("div", { style: { marginTop: "12px", textAlign: "center" }, children: _jsx("button", { type: "button", className: "muted", style: { background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "var(--primary)" }, onClick: () => navigate("/forgot-password"), children: "Mot de passe oubli\u00E9 ?" }) }), _jsxs("div", { style: { marginTop: "12px", textAlign: "center", fontSize: "12px" }, className: "muted", children: ["Seuls les domaines ", _jsx("strong", { children: "@2cconseil.com" }), " sont autoris\u00E9s"] })] }) }));
}
