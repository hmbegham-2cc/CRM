import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  BarChart3,
  BookOpen,
  ClipboardList,
  Headphones,
  Plus,
  Printer,
  Save,
  Calendar,
  Filter,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Target,
  Trash2,
  UserCircle,
} from "lucide-react";
import type { Campaign, QualityEvaluation, QualityReferentialConfig } from "@crc/types";
import { Spinner, LoadingState } from "./components/Spinner";
import { useAuth } from "./auth";
import {
  deleteQualityEvaluation,
  getCampaignsLite,
  getQualityEvaluation,
  getQualityEvaluations,
  getQualityReferential,
  getUsersLite,
  saveQualityEvaluation,
  saveQualityReferential,
} from "./db";
import { ConfirmModal } from "./components/ConfirmModal";
import { useAsync } from "./hooks/useAsync";
import {
  QUALITY_CHANNELS,
  computeQualityResult,
  domainGroups,
  domainScore,
  emptyQualityScores,
  getDefaultReferential,
  rubricLabel,
  scoreOptions,
} from "./lib/quality-scoring";
import { QUALITY_GUIDE } from "./lib/quality-guide";
import { QualityPrintGrille, printQualityGrille } from "./lib/quality-print";
import { fmtDate, fmtPercent, statusBadge } from "./lib/quality-utils";
import "./quality-page.css";

type Tab = "guide" | "referentiel" | "dashboard" | "liste" | "nouvelle" | "detail";

type PersonLite = { id: string; name: string | null; email: string };

function displayName(p: { name: string | null; email: string }) {
  return p.name?.trim() || p.email;
}

function initials(p: { name: string | null; email: string }) {
  const n = p.name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  return p.email.slice(0, 2).toUpperCase();
}

export function QualitePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("liste");
  const [evaluations, setEvaluations] = useState<QualityEvaluation[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [agents, setAgents] = useState<PersonLite[]>([]);
  const [evaluators, setEvaluators] = useState<PersonLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, run] = useAsync();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<QualityEvaluation | null>(null);
  const [detailEvaluator, setDetailEvaluator] = useState<PersonLite | null>(null);

  const [filterAgent, setFilterAgent] = useState("");
  const [filterCampaign, setFilterCampaign] = useState("");
  const [filterEvaluator, setFilterEvaluator] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formExternalCallId, setFormExternalCallId] = useState("");
  const [formAgentId, setFormAgentId] = useState("");
  const [formCampaignId, setFormCampaignId] = useState("");
  const [formChannel, setFormChannel] = useState<string>(QUALITY_CHANNELS[0]);
  const [formScores, setFormScores] = useState(emptyQualityScores());
  const [formComments, setFormComments] = useState<Record<string, string>>({});
  const [formPositive, setFormPositive] = useState("");
  const [formActionPlan, setFormActionPlan] = useState("");
  const [formDebriefDate, setFormDebriefDate] = useState("");
  const [formDebriefConclusion, setFormDebriefConclusion] = useState("");

  const [referential, setReferential] = useState<QualityReferentialConfig>(getDefaultReferential());
  const [refDraft, setRefDraft] = useState<QualityReferentialConfig>(getDefaultReferential());
  const printRef = useRef<HTMLDivElement>(null);

  const computed = useMemo(() => computeQualityResult(formScores, referential), [formScores, referential]);

  const coachDisplay = user ? displayName(user) : "—";
  const evaluatorForDisplay = detailEvaluator ?? (user ? { id: user.id, name: user.name, email: user.email } : null);
  const evaluatorLabel = evaluatorForDisplay ? displayName(evaluatorForDisplay) : "—";

  const loadMeta = () => {
    getCampaignsLite().then(setCampaigns).catch(console.error);
    getUsersLite()
      .then((rows) => {
        setAgents(rows.filter((u) => u.role === "TELECONSEILLER" || u.role === "SUPERVISEUR"));
        setEvaluators(rows.filter((u) => u.role === "COACH_QUALITE" || u.role === "ADMIN"));
      })
      .catch(console.error);
  };

  const loadEvaluations = async () => {
    setLoading(true);
    try {
      const data = await getQualityEvaluations({
        ...(filterAgent ? { agentUserId: filterAgent } : {}),
        ...(filterCampaign ? { campaignId: filterCampaign } : {}),
        ...(filterEvaluator ? { evaluatorUserId: filterEvaluator } : {}),
        ...(filterFrom ? { dateFrom: filterFrom } : {}),
        ...(filterTo ? { dateTo: filterTo } : {}),
      });
      setEvaluations(data);
    } catch (err: any) {
      toast.error(err?.message || "Impossible de charger les écoutes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadEvaluations(); }, [filterAgent, filterCampaign, filterEvaluator, filterFrom, filterTo]);

  useEffect(() => {
    getQualityReferential()
      .then((cfg) => {
        const next = cfg || getDefaultReferential();
        setReferential(next);
        setRefDraft(structuredClone(next));
      })
      .catch(() => {
        const fallback = getDefaultReferential();
        setReferential(fallback);
        setRefDraft(structuredClone(fallback));
      });
  }, []);

  const resetForm = () => {
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormExternalCallId("");
    setFormAgentId("");
    setFormCampaignId("");
    setFormChannel(QUALITY_CHANNELS[0]);
    setFormScores(emptyQualityScores(referential));
    setFormComments({});
    setFormPositive("");
    setFormActionPlan("");
    setFormDebriefDate("");
    setFormDebriefConclusion("");
    setSelectedId(null);
    setDetailEvaluator(null);
  };

  const startNewEvaluation = () => {
    resetForm();
    setTab("nouvelle");
  };

  const openDetail = async (id: string) => {
    try {
      const ev = await getQualityEvaluation(id);
      setSelectedId(id);
      setDetailEvaluator({ id: ev.evaluator.id, name: ev.evaluator.name, email: ev.evaluator.email });
      setFormDate(ev.evaluatedAt.slice(0, 10));
      setFormExternalCallId(ev.externalCallId || "");
      setFormAgentId(ev.agent.id);
      setFormCampaignId(ev.campaign?.id || "");
      setFormChannel(ev.channel);
      setFormScores({ ...emptyQualityScores(referential), ...ev.scores });
      setFormComments(ev.comments || {});
      setFormPositive(ev.positivePoints || "");
      setFormActionPlan(ev.actionPlan || "");
      setFormDebriefDate(ev.debriefDate?.slice(0, 10) || "");
      setFormDebriefConclusion(ev.debriefConclusion || "");
      setTab("detail");
    } catch (err: any) {
      toast.error(err?.message || "Écoute introuvable");
    }
  };

  const handleSave = () =>
    run(async () => {
      if (!user?.id) throw new Error("Non authentifié");
      if (!formAgentId) throw new Error("Sélectionnez un conseiller");
      const result = computeQualityResult(formScores, referential);
      await saveQualityEvaluation({
        id: selectedId || undefined,
        evaluatedAt: formDate,
        agentUserId: formAgentId,
        evaluatorUserId: user.id,
        campaignId: formCampaignId || null,
        externalCallId: formExternalCallId.trim() || null,
        channel: formChannel,
        scores: formScores,
        totalPoints: result.totalPoints,
        finalScore: result.finalScore,
        finalPercent: result.finalPercent,
        mention: result.mention,
        status: result.status,
        improvementAreas: result.improvementAreas,
        coachingPriority: result.coachingPriority,
        immediateAction: result.immediateAction,
        conform: result.conform,
        positivePoints: formPositive || null,
        actionPlan: formActionPlan || null,
        comments: formComments,
        debriefDate: formDebriefDate || null,
        debriefConclusion: formDebriefConclusion || null,
      });
      toast.success(selectedId ? "Écoute mise à jour" : "Écoute enregistrée");
      resetForm();
      setTab("liste");
      loadEvaluations();
    }).catch((err: any) => toast.error(err?.message || "Enregistrement impossible"));

  const kpis = useMemo(() => {
    const n = evaluations.length;
    if (!n) return { count: 0, avg: 0, avgPercent: 0, conformeRate: 0, coaching: 0, immediate: 0 };
    const avg = evaluations.reduce((s, e) => s + e.finalScore, 0) / n;
    const avgPct = evaluations.reduce((s, e) => s + (e.finalPercent ?? fmtPercent(e.finalScore)), 0) / n;
    const conforme = evaluations.filter((e) => e.conform).length;
    return {
      count: n,
      avg: Math.round(avg * 10) / 10,
      avgPercent: Math.round(avgPct * 10) / 10,
      conformeRate: Math.round((conforme / n) * 100),
      coaching: evaluations.filter((e) => e.coachingPriority).length,
      immediate: evaluations.filter((e) => e.immediateAction).length,
    };
  }, [evaluations]);

  const agentStats = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; sum: number; sumPct: number; conform: number; coaching: number; immediate: number }
    >();
    for (const ev of evaluations) {
      const id = ev.agent.id;
      const name = displayName(ev.agent);
      const cur = map.get(id) || { name, count: 0, sum: 0, sumPct: 0, conform: 0, coaching: 0, immediate: 0 };
      cur.count += 1;
      cur.sum += ev.finalScore;
      cur.sumPct += ev.finalPercent ?? fmtPercent(ev.finalScore);
      if (ev.conform) cur.conform += 1;
      if (ev.coachingPriority) cur.coaching += 1;
      if (ev.immediateAction) cur.immediate += 1;
      map.set(id, cur);
    }
    return Array.from(map.entries())
      .map(([id, s]) => ({
        id,
        name: s.name,
        count: s.count,
        avgScore: Math.round((s.sum / s.count) * 10) / 10,
        avgPercent: Math.round((s.sumPct / s.count) * 10) / 10,
        conformRate: Math.round((s.conform / s.count) * 100),
        coaching: s.coaching,
        immediate: s.immediate,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }, [evaluations]);

  const domainStats = useMemo(() => {
    return domainGroups(referential).map(({ domain, criteria }) => {
      const max = criteria.reduce((s, c) => s + c.maxPoints, 0);
      let sum = 0;
      let count = 0;
      for (const ev of evaluations) {
        for (const c of criteria) {
          const v = ev.scores[c.id];
          if (typeof v === "number") sum += v;
        }
        count += 1;
      }
      const avg = count ? Math.round((sum / count) * 10) / 10 : 0;
      return { domain, avg, max, percent: max ? Math.round((avg / max) * 1000) / 10 : 0 };
    });
  }, [evaluations, referential]);

  const primaryTabs: { id: Tab; label: string; icon: typeof Plus; cta?: boolean }[] = [
    { id: "nouvelle", label: "Nouvelle écoute", icon: Plus, cta: true },
    { id: "liste", label: "Historique", icon: ClipboardList },
    { id: "dashboard", label: "Pilotage", icon: BarChart3 },
  ];

  const secondaryTabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "guide", label: "Guide", icon: BookOpen },
    { id: "referentiel", label: "Référentiel", icon: Settings },
  ];

  const selectedAgent = agents.find((a) => a.id === formAgentId);
  const selectedCampaign = campaigns.find((c) => c.id === formCampaignId);

  const handlePrint = () => {
    if (!printRef.current) return;
    printQualityGrille(printRef.current);
  };

  const handleSaveReferential = () =>
    run(async () => {
      if (!user?.id) throw new Error("Non authentifié");
      const saved = await saveQualityReferential(refDraft, user.id);
      setReferential(structuredClone(saved));
      setRefDraft(structuredClone(saved));
      toast.success("Référentiel enregistré");
    }).catch((err: any) => toast.error(err?.message || "Enregistrement impossible"));

  const thresholdFields: { key: keyof QualityReferentialConfig["thresholds"]; label: string }[] = [
    { key: "plafondMinusOne", label: "Plafond si -1" },
    { key: "plafondBlocking", label: "Plafond si bloquant < 2" },
    { key: "conformeMin", label: "Seuil conforme (min /20)" },
    { key: "coachingMax", label: "Seuil coaching (max /20)" },
    { key: "mentionExcellent", label: "Mention Excellent (min)" },
    { key: "mentionTresSatisfaisant", label: "Mention Très satisfaisant (min)" },
    { key: "mentionSatisfaisant", label: "Mention Satisfaisant (min)" },
    { key: "mentionAmeliorer", label: "Mention À améliorer (min)" },
  ];

  const showForm = tab === "nouvelle" || tab === "detail";
  const isActiveTab = (id: Tab) => tab === id || (id === "liste" && tab === "detail");

  const hasActiveFilters = !!(filterAgent || filterCampaign || filterEvaluator || filterFrom || filterTo);

  const resetFilters = () => {
    setFilterAgent("");
    setFilterCampaign("");
    setFilterEvaluator("");
    setFilterFrom("");
    setFilterTo("");
  };

  const filtersBlock = (
    <div className="quality-filters-card card">
      <div className="quality-filters-head">
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>Filtrer les écoutes</h3>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Affinez l&apos;historique et le pilotage par période, conseiller ou coach.
          </p>
        </div>
        {hasActiveFilters && (
          <button type="button" className="btn btn-secondary" onClick={resetFilters}>
            <RotateCcw size={16} />
            Réinitialiser
          </button>
        )}
      </div>

      <div className="quality-filters-body">
        <div className="quality-filters-row">
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-agent">
              <UserCircle size={14} />
              Conseiller
            </label>
            <select
              id="q-filter-agent"
              className="select"
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
            >
              <option value="">Tous les conseillers</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{displayName(a)}</option>
              ))}
            </select>
          </div>
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-campaign">
              <Target size={14} />
              Campagne
            </label>
            <select
              id="q-filter-campaign"
              className="select"
              value={filterCampaign}
              onChange={(e) => setFilterCampaign(e.target.value)}
            >
              <option value="">Toutes les campagnes</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-evaluator">
              <ShieldCheck size={14} />
              Coach qualité
            </label>
            <select
              id="q-filter-evaluator"
              className="select"
              value={filterEvaluator}
              onChange={(e) => setFilterEvaluator(e.target.value)}
            >
              <option value="">Tous les coaches</option>
              {evaluators.map((e) => (
                <option key={e.id} value={e.id}>{displayName(e)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="quality-filters-row quality-filters-row-dates">
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-from">
              <Calendar size={14} />
              Du
            </label>
            <input
              id="q-filter-from"
              type="date"
              className="input"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
            />
          </div>
          <div className="field quality-filter-field">
            <label className="label" htmlFor="q-filter-to">
              <Calendar size={14} />
              Au
            </label>
            <input
              id="q-filter-to"
              type="date"
              className="input"
              value={filterTo}
              min={filterFrom || undefined}
              onChange={(e) => setFilterTo(e.target.value)}
            />
          </div>
          <div className="quality-filters-actions">
            <button type="button" className="btn btn-primary" onClick={loadEvaluations} disabled={loading}>
              {loading ? <Spinner size={16} /> : <Search size={16} />}
              {loading ? "Chargement..." : "Appliquer"}
            </button>
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="quality-filters-active">
          <Filter size={14} />
          <span>Filtres actifs</span>
          {filterAgent && (() => {
            const a = agents.find((x) => x.id === filterAgent);
            return a ? (
              <span className="quality-filter-tag">Conseiller : {displayName(a)}</span>
            ) : null;
          })()}
          {filterCampaign && (
            <span className="quality-filter-tag">
              Campagne : {campaigns.find((c) => c.id === filterCampaign)?.name}
            </span>
          )}
          {filterEvaluator && (() => {
            const e = evaluators.find((x) => x.id === filterEvaluator);
            return e ? (
              <span className="quality-filter-tag">Coach : {displayName(e)}</span>
            ) : null;
          })()}
          {(filterFrom || filterTo) && (
            <span className="quality-filter-tag">
              Période : {filterFrom ? fmtDate(filterFrom) : "…"} → {filterTo ? fmtDate(filterTo) : "…"}
            </span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="quality-page">
      <div className="quality-hero">
        <div>
          <h1>Contrôle qualité</h1>
          <p className="muted">
            Écoutez dans Ubicentrex, saisissez la grille ici — votre nom est enregistré comme évaluateur.
          </p>
          <div className="quality-evaluator-chip">
            <UserCircle size={18} />
            <span>
              {tab === "nouvelle" ? (
                <>Vous évaluez en tant que <strong>{coachDisplay}</strong></>
              ) : (
                <>Connecté : <strong>{coachDisplay}</strong></>
              )}
            </span>
          </div>
        </div>
        <div className="quality-hero-icon">
          <ShieldCheck size={32} color="#fff" />
        </div>
      </div>

      <nav className="quality-nav">
        <div>
          <p className="quality-nav-label">Actions</p>
          <div className="quality-nav-primary">
            {primaryTabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`quality-tab ${t.cta ? "cta" : ""} ${isActiveTab(t.id) ? "active" : ""}`}
                  onClick={() => {
                    if (t.id === "nouvelle") startNewEvaluation();
                    else {
                      setSelectedId(null);
                      setDetailEvaluator(null);
                      setTab(t.id);
                    }
                  }}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <p className="quality-nav-label">Configuration</p>
          <div className="quality-nav-secondary">
            {secondaryTabs.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  type="button"
                  className={`quality-tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedId(null);
                    setDetailEvaluator(null);
                    setTab(t.id);
                  }}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {tab === "guide" && (
        <div style={{ display: "grid", gap: 20, maxWidth: 820 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}>{QUALITY_GUIDE.title}</h2>
            <p className="muted" style={{ lineHeight: 1.6 }}>{QUALITY_GUIDE.intro}</p>
          </div>
          <div className="card">
            <h3>Parcours recommandé</h3>
            <ol style={{ margin: "12px 0 0", paddingLeft: 20, display: "grid", gap: 14 }}>
              {QUALITY_GUIDE.parcours.map((p) => (
                <li key={p.step} style={{ lineHeight: 1.55 }}>
                  <strong>{p.step}. {p.app}</strong>
                  <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>({p.excel})</span>
                  <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{p.description}</div>
                </li>
              ))}
            </ol>
          </div>
          <button type="button" className="btn btn-primary" onClick={startNewEvaluation}>
            <Plus size={18} />
            Commencer une écoute
          </button>
        </div>
      )}

      {tab === "referentiel" && (
        <div style={{ display: "grid", gap: 20 }}>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Seuils & plafonds</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 16 }}>
              {thresholdFields.map(({ key, label }) => (
                <div key={key} className="field" style={{ marginBottom: 0 }}>
                  <label className="label">{label}</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    max={20}
                    step={0.5}
                    value={refDraft.thresholds[key]}
                    onChange={(e) =>
                      setRefDraft((prev) => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, [key]: Number(e.target.value) },
                      }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
          {domainGroups(refDraft).map(({ domain, criteria }) => (
            <div key={domain} className="card">
              <h3>{domain}</h3>
              <div style={{ display: "grid", gap: 16, marginTop: 12 }}>
                {criteria.map((criterion) => (
                  <div key={criterion.id} style={{ borderBottom: "1px solid var(--border)", paddingBottom: 14 }}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>{criterion.name}</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {scoreOptions(criterion).map((score) => (
                        <div key={score} className="field" style={{ marginBottom: 0 }}>
                          <label className="label" style={{ fontSize: 12 }}>Barème {score}</label>
                          <textarea
                            className="input"
                            rows={2}
                            value={criterion.rubrics?.[String(score)] || ""}
                            onChange={(e) =>
                              setRefDraft((prev) => ({
                                ...prev,
                                criteria: prev.criteria.map((c) =>
                                  c.id === criterion.id
                                    ? { ...c, rubrics: { ...c.rubrics, [String(score)]: e.target.value } }
                                    : c,
                                ),
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={handleSaveReferential}>
              <Save size={18} />
              Enregistrer le référentiel
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setRefDraft(getDefaultReferential());
                toast.message("Référentiel par défaut rechargé (non enregistré)");
              }}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      )}

      {(tab === "dashboard" || tab === "liste") && filtersBlock}

      {tab === "dashboard" && (
        <>
          <div className="quality-kpi-grid">
            {[
              { label: "Écoutes", value: kpis.count },
              { label: "Moyenne /20", value: kpis.avg },
              { label: "Moyenne %", value: `${kpis.avgPercent}%` },
              { label: "Conformité", value: `${kpis.conformeRate}%` },
              { label: "Coaching", value: kpis.coaching },
              { label: "Action imm.", value: kpis.immediate },
            ].map((k) => (
              <div key={k.label} className="quality-kpi">
                <div className="quality-kpi-label">{k.label}</div>
                <div className="quality-kpi-value">{k.value}</div>
              </div>
            ))}
          </div>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Par conseiller</h3>
            {agentStats.length === 0 ? (
              <p className="muted">Aucune écoute sur la période.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ margin: 0, minWidth: 720 }}>
                  <thead>
                    <tr>
                      <th>Conseiller</th>
                      <th style={{ textAlign: "right" }}>Écoutes</th>
                      <th style={{ textAlign: "right" }}>Moy. /20</th>
                      <th style={{ textAlign: "right" }}>Moy. %</th>
                      <th style={{ textAlign: "right" }}>Conformité</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.map((a) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.name}</td>
                        <td style={{ textAlign: "right" }}>{a.count}</td>
                        <td style={{ textAlign: "right", fontWeight: 600 }}>{a.avgScore}</td>
                        <td style={{ textAlign: "right" }}>{a.avgPercent}%</td>
                        <td style={{ textAlign: "right" }}>{a.conformRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Par domaine</h3>
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Domaine</th>
                  <th style={{ textAlign: "right" }}>Moyenne</th>
                  <th style={{ textAlign: "right" }}>%</th>
                </tr>
              </thead>
              <tbody>
                {domainStats.map((d) => (
                  <tr key={d.domain}>
                    <td>{d.domain}</td>
                    <td style={{ textAlign: "right", fontWeight: 600 }}>{d.avg}/{d.max}</td>
                    <td style={{ textAlign: "right" }}>{d.percent}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === "liste" && (
        <div>
          {loading ? (
            <div className="quality-empty"><LoadingState label="Chargement..." compact /></div>
          ) : evaluations.length === 0 ? (
            <div className="card quality-empty">
              <p>Aucune écoute sur la période.</p>
              <button type="button" className="btn btn-primary" style={{ marginTop: 16 }} onClick={startNewEvaluation}>
                <Plus size={18} />
                Première écoute
              </button>
            </div>
          ) : (
            <div className="quality-list-grid">
              {evaluations.map((ev) => (
                <article key={ev.id} className="quality-list-card">
                  <div className="quality-list-card-header">
                    <div>
                      <div className="quality-list-card-agent">{displayName(ev.agent)}</div>
                      <div className="quality-list-card-date">{fmtDate(ev.evaluatedAt.slice(0, 10))} · {ev.channel}</div>
                    </div>
                    {statusBadge(ev.status)}
                  </div>
                  {ev.externalCallId && (
                    <div className="quality-call-id muted">ID Ubicentrex : {ev.externalCallId}</div>
                  )}
                  <div className="quality-list-metrics">
                    <div className="quality-list-metric">
                      <span className="muted">Note</span>
                      <strong>{ev.finalScore}/20</strong>
                    </div>
                    <div className="quality-list-metric">
                      <span className="muted">%</span>
                      <strong>{ev.finalPercent ?? fmtPercent(ev.finalScore)}%</strong>
                    </div>
                    <div className="quality-list-metric">
                      <span className="muted">Mention</span>
                      <strong style={{ fontSize: 14 }}>{ev.mention}</strong>
                    </div>
                  </div>
                  <div className="quality-list-footer">
                    <span className="quality-list-evaluator">
                      <UserCircle size={14} />
                      Évalué par <strong>{displayName(ev.evaluator)}</strong>
                    </span>
                    <button type="button" className="btn btn-secondary" style={{ padding: "6px 12px", fontSize: 13 }} onClick={() => openDetail(ev.id)}>
                      Ouvrir
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginBottom: 16 }}
            onClick={() => { resetForm(); setTab("liste"); }}
          >
            <ArrowLeft size={16} />
            Retour à l&apos;historique
          </button>

          <div className="quality-form-layout">
            <aside className="quality-form-sidebar">
              <div className="quality-meta-card">
                <h3>
                  <span className="quality-step-badge">1</span>
                  Identification
                </h3>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">ID appel Ubicentrex</label>
                  <input
                    type="text"
                    className="input quality-call-id"
                    value={formExternalCallId}
                    onChange={(e) => setFormExternalCallId(e.target.value)}
                    placeholder="Référence enregistrement"
                  />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">Date *</label>
                  <input type="date" className="input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">Conseiller *</label>
                  <select className="select" value={formAgentId} onChange={(e) => setFormAgentId(e.target.value)}>
                    <option value="">— Choisir —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{displayName(a)}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 12 }}>
                  <label className="label">Campagne</label>
                  <select className="select" value={formCampaignId} onChange={(e) => setFormCampaignId(e.target.value)}>
                    <option value="">— Optionnel —</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label className="label">Canal</label>
                  <select className="select" value={formChannel} onChange={(e) => setFormChannel(e.target.value)}>
                    {QUALITY_CHANNELS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="quality-meta-card">
                <h3>
                  <span className="quality-step-badge">2</span>
                  Résultat
                </h3>
                <div className="quality-score-panel">
                  <div className="quality-score-box">
                    <div className="label">Brut</div>
                    <div className="value">{computed.totalPoints}/20</div>
                  </div>
                  <div className={`quality-score-box highlight ${computed.immediateAction ? "alert" : ""}`}>
                    <div className="label">Final</div>
                    <div className="value">{computed.finalScore}/20</div>
                    <div className="sub">{computed.finalPercent}%</div>
                  </div>
                  <div className="quality-score-box" style={{ gridColumn: "1 / -1" }}>
                    <div className="label">Mention</div>
                    <div className="value" style={{ fontSize: "1rem" }}>{computed.mention}</div>
                  </div>
                  <div className="quality-score-box" style={{ gridColumn: "1 / -1" }}>
                    <div className="label">Statut</div>
                    <div style={{ marginTop: 6 }}>{statusBadge(computed.status)}</div>
                  </div>
                </div>
                {(computed.hasMinusOne || computed.blockingFail) && (
                  <div className="quality-alert">
                    {computed.hasMinusOne && "Plafond -1 (max 8/20). "}
                    {computed.blockingFail && "Plafond bloquant (max 12/20)."}
                  </div>
                )}
              </div>

              <div className="quality-form-actions">
                <button type="button" className="btn btn-primary" disabled={busy || !formAgentId} onClick={handleSave}>
                  {busy ? <Spinner size={18} /> : <Save size={18} />}
                  {busy ? "..." : "Enregistrer"}
                </button>
                {tab === "detail" && (
                  <button type="button" className="btn btn-secondary" onClick={handlePrint}>
                    <Printer size={16} />
                    Imprimer
                  </button>
                )}
                {selectedId && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => {
                      const ev = evaluations.find((e) => e.id === selectedId);
                      if (ev) setToDelete(ev);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </aside>

            <main>
              <div className="card">
                <div className="quality-evaluator-banner">
                  {evaluatorForDisplay && (
                    <div className="avatar">{initials(evaluatorForDisplay)}</div>
                  )}
                  <div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                      {tab === "detail" ? "Écoute réalisée par" : "Cette écoute sera enregistrée au nom de"}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{evaluatorLabel}</div>
                    {tab === "nouvelle" && user && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        Votre nom apparaîtra dans l&apos;historique et sur la grille imprimée.
                      </div>
                    )}
                  </div>
                  {tab === "detail" && (
                    <button type="button" className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={handlePrint}>
                      <Printer size={16} />
                      Imprimer
                    </button>
                  )}
                </div>

                <p className="quality-section-title">
                  <span className="quality-step-badge">3</span> Grille de critères
                </p>

                {domainGroups(referential).map(({ domain, criteria }) => {
                  const ds = domainScore(formScores, criteria);
                  return (
                    <div key={domain} style={{ marginBottom: 28 }}>
                      <div className="quality-domain-header">
                        <h3>{domain}</h3>
                        <span className="quality-domain-pill">{ds.points}/{ds.max} pts · {ds.percent}%</span>
                      </div>
                      {criteria.map((criterion) => (
                        <div key={criterion.id} className="quality-criterion">
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ fontWeight: 600 }}>
                              {criterion.name}
                              {criterion.blocking && (
                                <span className="badge" style={{ marginLeft: 8, background: "rgba(239,68,68,0.12)", color: "#b91c1c", fontSize: 10 }}>
                                  BLOQUANT
                                </span>
                              )}
                            </div>
                            <span className="muted" style={{ fontSize: 12 }}>Max {criterion.maxPoints}</span>
                          </div>
                          <p className="muted" style={{ fontSize: 12, margin: "6px 0 0" }}>{criterion.expected}</p>
                          <div className="quality-score-btns">
                            {scoreOptions(criterion).map((score) => (
                              <button
                                key={score}
                                type="button"
                                title={rubricLabel(criterion, score)}
                                className={`quality-score-btn ${score === -1 ? "minus" : ""} ${formScores[criterion.id] === score ? "selected" : ""}`}
                                onClick={() => setFormScores((prev) => ({ ...prev, [criterion.id]: score }))}
                              >
                                {score}
                              </button>
                            ))}
                          </div>
                          {rubricLabel(criterion, formScores[criterion.id]) && (
                            <p className="muted" style={{ fontSize: 12, fontStyle: "italic", marginBottom: 8 }}>
                              {rubricLabel(criterion, formScores[criterion.id])}
                            </p>
                          )}
                          <div className="field" style={{ marginBottom: 0 }}>
                            <label className="label" style={{ fontSize: 12 }}>Commentaire</label>
                            <textarea
                              className="input"
                              rows={2}
                              value={formComments[criterion.id] || ""}
                              onChange={(e) => setFormComments((prev) => ({ ...prev, [criterion.id]: e.target.value }))}
                              placeholder="Verbatim ou observation..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>

              {computed.improvementAreas && (
                <div className="card">
                  <h3 style={{ marginTop: 0 }}>Axes d&apos;amélioration</h3>
                  <p className="muted" style={{ margin: 0, fontSize: 14 }}>{computed.improvementAreas}</p>
                </div>
              )}

              <div className="card">
                <p className="quality-section-title">
                  <span className="quality-step-badge">4</span> Débrief
                </p>
                <div style={{ display: "grid", gap: 14 }}>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Points forts</label>
                    <textarea className="input" rows={2} value={formPositive} onChange={(e) => setFormPositive(e.target.value)} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Plan d&apos;action</label>
                    <textarea className="input" rows={2} value={formActionPlan} onChange={(e) => setFormActionPlan(e.target.value)} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Date débrief</label>
                    <input type="date" className="input" value={formDebriefDate} onChange={(e) => setFormDebriefDate(e.target.value)} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label className="label">Conclusion</label>
                    <textarea className="input" rows={2} value={formDebriefConclusion} onChange={(e) => setFormDebriefConclusion(e.target.value)} />
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      )}

      {showForm && (
        <div ref={printRef} style={{ position: "absolute", left: -9999, top: 0 }}>
          <QualityPrintGrille
            config={referential}
            evaluatedAt={formDate}
            agentName={selectedAgent ? displayName(selectedAgent) : "—"}
            evaluatorName={evaluatorLabel}
            campaignName={selectedCampaign?.name || ""}
            channel={formChannel}
            externalCallId={formExternalCallId.trim() || null}
            scores={formScores}
            comments={formComments}
            computed={computed}
            evaluationId={selectedId || undefined}
          />
        </div>
      )}

      <ConfirmModal
        open={!!toDelete}
        title="Supprimer cette écoute ?"
        message={toDelete ? `${fmtDate(toDelete.evaluatedAt.slice(0, 10))} — ${displayName(toDelete.agent)}` : ""}
        confirmLabel="Supprimer"
        variant="danger"
        onCancel={() => setToDelete(null)}
        onConfirm={() =>
          run(async () => {
            if (!toDelete) return;
            await deleteQualityEvaluation(toDelete.id);
            toast.success("Écoute supprimée");
            setToDelete(null);
            if (selectedId === toDelete.id) { resetForm(); setTab("liste"); }
            loadEvaluations();
          }).catch((err: any) => toast.error(err?.message || "Suppression impossible"))
        }
      />
    </div>
  );
}
