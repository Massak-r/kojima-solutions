import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import type { Quote } from "@/types/quote";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Plus, LayoutList, Receipt, TrendingUp,
  MessageSquare, ChevronRight,
  Loader2, ListTodo, Sparkles,
  Trash2, CheckCircle2, Circle, Target, Sun, X, AlertTriangle, Hourglass,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import type { UnifiedObjective, ObjectiveSource } from "@/api/objectiveSource";
import {
  useObjectives, useCreateObjective, useUpdateObjective, useDeleteObjective,
} from "@/hooks/useObjectives";
import {
  useAllSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useBatchCompleteSubtasks,
} from "@/hooks/useSubtasks";
import { listCosts, type PersonalCostItem } from "@/api/personalCosts";
import { FREQUENCY_DAYS } from "@/types/personalCost";
import { Calendar, Wallet } from "lucide-react";
import type { SubtaskItem } from "@/api/todoSubtasks";
import { ObjectiveRow } from "@/components/todos/ObjectiveRow";
import { CategorySection } from "@/components/todos/CategorySection";
// DailyFocus replaced with inline focus bar
import { ALL_CATEGORIES, sortObjectives, getCategoryColor } from "@/lib/objectiveCategories";
import { QuickActionFAB } from "@/components/QuickActionFAB";
import { RecentActivity } from "@/components/RecentActivity";
import { CalendarWidget } from "@/components/calendar/CalendarWidget";
import { IntakeManager } from "@/components/IntakeManager";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { EmailQueue } from "@/components/EmailQueue";
import { ObjectiveHealthCard } from "@/components/objective/ObjectiveHealthCard";
import { useClients } from "@/contexts/ClientsContext";

// ── Completed section toggle (replaces <details>) ────────────────────────────
function CompletedToggle({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-2 border-t border-border/20 mt-2">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 py-1.5 text-xs font-body text-muted-foreground hover:text-foreground transition-colors"
      >
        <CheckCircle2 size={13} className="text-emerald-500" />
        <span>{count} terminé{count > 1 ? "s" : ""}</span>
        <ChevronRight size={12} className={cn("transition-transform duration-200", open && "rotate-90")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-1.5 mt-1">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Status config maps ────────────────────────────────────────────────────────

const PROJECT_STATUS = {
  draft:        { label: "Draft",    cls: "bg-muted text-muted-foreground border-border" },
  "in-progress":{ label: "Active",   cls: "bg-primary/15 text-primary border-primary/30" },
  completed:    { label: "Done",     cls: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
  "on-hold":    { label: "On Hold",  cls: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
} as const;

const PAYMENT_STATUS = {
  unpaid:  { label: "Unpaid",  cls: "bg-destructive/10 text-destructive border-destructive/30" },
  partial: { label: "Partial", cls: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
  paid:    { label: "Paid",    cls: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCHF(value: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF",
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'");
}

// Active objectives untouched longer than this get a muted/stale treatment on /space.
// Uses updated_at (refreshed on every field edit) so fresh edits reset the clock.
const OBJECTIVE_STALE_DAYS = 30;
function objectiveDaysSinceUpdate(o: { updatedAt?: string | null; createdAt: string }): number {
  const raw = o.updatedAt ?? o.createdAt;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KojimaSpace() {
  const navigate   = useNavigate();
  const { projects, loading: projectsLoading, createProject } = useProjects();
  const { quotes } = useQuotes();
  const { getClient } = useClients();
  const clientName = (p: { clientId?: string; client: string }) => (p.clientId ? getClient(p.clientId)?.name : null) || p.client;

  // Calendar — now using Google Calendar API via CalendarWidget component

  // Invoice list

  // Unified objectives (admin + personal) via react-query
  const { data: todos = [], isLoading: objLoading } = useObjectives();
  const { data: allSubtasks = [], isLoading: subLoading } = useAllSubtasks();
  const todosLoading = objLoading || subLoading;
  const createObjectiveMut = useCreateObjective();
  const updateObjectiveMut = useUpdateObjective();
  const deleteObjectiveMut = useDeleteObjective();
  const createSubtaskMut = useCreateSubtask();
  const updateSubtaskMut = useUpdateSubtask();
  const deleteSubtaskMut = useDeleteSubtask();
  const batchCompleteMut = useBatchCompleteSubtasks();

  const subtasksMap = useMemo(() => {
    const map: Record<string, SubtaskItem[]> = {};
    for (const s of allSubtasks) (map[s.parentId] ??= []).push(s);
    return map;
  }, [allSubtasks]);

  const [newTodo, setNewTodo] = useState("");
  const [newIsObj, setNewIsObj] = useState(true);
  const [newCat, setNewCat] = useState("Kojima-Solutions");
  const [todoDeleteId, setTodoDeleteId] = useState<string | null>(null);

  // Personal costs due soon
  const [personalCosts, setPersonalCosts] = useState<PersonalCostItem[]>([]);

  // Category visibility filter (persisted)
  const [hiddenCats, setHiddenCats] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('space-hidden-cats');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch { return new Set(); }
  });
  useEffect(() => {
    localStorage.setItem('space-hidden-cats', JSON.stringify([...hiddenCats]));
  }, [hiddenCats]);
  const toggleCat = useCallback((cat: string) => {
    setHiddenCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // Compact/expanded view toggle (persisted)
  const [compactView, setCompactView] = useState<boolean>(() => {
    try { return localStorage.getItem('space-compact-view') === '1'; } catch { return false; }
  });
  useEffect(() => {
    localStorage.setItem('space-compact-view', compactView ? '1' : '0');
  }, [compactView]);

  const sourceOf = useCallback(
    (id: string): ObjectiveSource => todos.find(t => t.id === id)?.source ?? 'admin',
    [todos],
  );

  useEffect(() => {
    listCosts().then(setPersonalCosts).catch(() => {});
  }, []);

  function addTodo() {
    if (!newTodo.trim()) return;
    const text = newTodo.trim();
    const isObjective = newIsObj;
    setNewTodo(""); setNewIsObj(false);
    createObjectiveMut.mutate({ source: 'admin', data: { text, category: newCat, isObjective } });
  }

  function toggleTodo(id: string) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const willComplete = !todo.completed;
    updateObjectiveMut.mutate({ source: todo.source, id, patch: { completed: willComplete } });
    if (willComplete && todo.isObjective) {
      const subs = subtasksMap[id] || [];
      if (subs.some(s => !s.completed)) {
        batchCompleteMut.mutate({ parentId: id, subtasks: subs });
      }
    }
  }

  function swapObjectiveOrder(idA: string, idB: string) {
    const a = todos.find(t => t.id === idA);
    const b = todos.find(t => t.id === idB);
    if (!a || !b) return;
    updateObjectiveMut.mutate({ source: a.source, id: idA, patch: { order: b.order } });
    updateObjectiveMut.mutate({ source: b.source, id: idB, patch: { order: a.order } });
  }

  function deleteTodo(id: string) {
    const src = sourceOf(id);
    setTodoDeleteId(null);
    deleteObjectiveMut.mutate({ source: src, id });
  }

  // Subtask handlers
  function handleSubtaskAdd(parentId: string, text: string, dueDate?: string) {
    createSubtaskMut.mutate({ parentId, text, dueDate, source: sourceOf(parentId) });
  }
  function handleSubtaskToggle(parentId: string, subId: string) {
    const subs = subtasksMap[parentId] || [];
    const sub = subs.find(s => s.id === subId);
    if (!sub) return;
    updateSubtaskMut.mutate({ id: subId, patch: { completed: !sub.completed } });
  }
  function handleSubtaskDelete(_parentId: string, subId: string) {
    deleteSubtaskMut.mutate(subId);
  }
  function handleSubtaskUpdate(_parentId: string, subId: string, data: Partial<SubtaskItem>) {
    updateSubtaskMut.mutate({ id: subId, patch: data });
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === "in-progress").length,
    [projects]
  );
  const pendingResponses = useMemo(
    () => projects.reduce((sum, p) =>
      sum + (p.tasks || []).flatMap(t => t.feedbackRequests || []).filter(r => r.resolved && r.response).length, 0),
    [projects]
  );
  const invoicesToReview = useMemo(
    () => quotes.filter(q => q.invoiceStatus === "to-validate").length,
    [quotes]
  );
  const totalRevenue = useMemo(
    () => quotes.filter(q => q.invoiceStatus === "paid").reduce((sum, q) => sum + totalQuote(q), 0),
    [quotes]
  );
  const overdueInvoices = useMemo(
    () => quotes.filter(q => {
      if (q.invoiceStatus !== "validated") return false;
      const validity = q.validityDate ? new Date(q.validityDate) : null;
      if (!validity) return false;
      return validity.getTime() < Date.now();
    }).length,
    [quotes]
  );
  const outstandingTotal = useMemo(
    () => quotes.filter(q => q.invoiceStatus === "validated").reduce((sum, q) => sum + totalQuote(q), 0),
    [quotes]
  );
  const recentProjects = useMemo(
    () => [...projects]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
    [projects]
  );

  // Projects with deadlines in the next 14 days
  const upcomingDeadlines = useMemo(() => {
    const now = Date.now();
    const in14d = now + 14 * 86400000;
    return projects
      .filter(p => p.status === "in-progress" && p.endDate)
      .filter(p => {
        const end = new Date(p.endDate!).getTime();
        return end >= now && end <= in14d;
      })
      .sort((a, b) => new Date(a.endDate!).getTime() - new Date(b.endDate!).getTime())
      .slice(0, 5);
  }, [projects]);

  // Personal costs due within 7 days
  const costsDueSoon = useMemo(() => {
    const now = Date.now();
    return personalCosts
      .map(cost => {
        const freqDays = FREQUENCY_DAYS[cost.frequency] ?? 30;
        const lastPaid = cost.lastPaid ? new Date(cost.lastPaid).getTime() : new Date(cost.createdAt).getTime();
        const nextDue = lastPaid + freqDays * 86400000;
        const daysUntil = Math.ceil((nextDue - now) / 86400000);
        return { ...cost, daysUntil };
      })
      .filter(c => c.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);
  }, [personalCosts]);
  const unpaidInvoices = useMemo(
    () => quotes
      .filter(q => q.invoiceStatus && q.invoiceStatus !== "paid" && q.invoiceStatus !== "draft" && q.invoiceStatus !== "on-hold")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8),
    [quotes]
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleNewProject() {
    const p = createProject();
    navigate(`/project/${p.id}/brief`);
  }


  // ── Date greeting ──────────────────────────────────────────────────────────

  const today = new Date().toLocaleDateString("fr-CH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <header className="bg-primary text-primary-foreground py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-accent" />
            <span className="font-body text-xs font-semibold tracking-widest uppercase text-primary-foreground/50">
              Espace de travail
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">
                Kojima<span className="text-accent">.</span>Space
              </h1>
              <p className="font-body text-primary-foreground/55 mt-1 text-sm capitalize">{today}</p>
            </div>
            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2">
              <Button
                onClick={() => navigate("/projects")}
                variant="outline"
                className="bg-transparent border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 font-body text-sm gap-2"
              >
                <LayoutList size={14} />
                <span className="hidden sm:inline">Tous les </span>Projets
              </Button>
              <Button
                onClick={handleNewProject}
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-sm gap-1.5"
              >
                <Plus size={15} />
                <span className="hidden sm:inline">Nouveau </span>Projet
              </Button>
              <Button
                onClick={() => navigate("/quotes/new")}
                className="bg-accent/70 text-accent-foreground hover:bg-accent/60 font-body text-sm gap-1.5"
              >
                <Plus size={15} />
                <span className="hidden sm:inline">Nouveau </span>Devis
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">

        {/* ── Compact stats bar ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-2"
        >
          <MiniStat icon={<LayoutList size={13} className="text-primary" />} label="Projets" value={activeProjects} onClick={() => navigate("/projects")} />
          <MiniStat icon={<MessageSquare size={13} className="text-palette-amber" />} label="Réponses" value={pendingResponses} pulse={pendingResponses > 0} onClick={() => navigate("/projects")} />
          <MiniStat icon={<Receipt size={13} className="text-accent" />} label="À valider" value={invoicesToReview} pulse={invoicesToReview > 0} onClick={() => navigate("/quotes")} />
          <MiniStat icon={<TrendingUp size={13} className="text-palette-sage" />} label="Revenu" value={formatCHF(totalRevenue)} onClick={() => navigate("/quotes")} />
          <MiniStat icon={<AlertTriangle size={13} className="text-destructive" />} label="En retard" value={overdueInvoices} pulse={overdueInvoices > 0} onClick={() => navigate("/accounting")} />
          <MiniStat icon={<Receipt size={13} className="text-primary" />} label="À recevoir" value={formatCHF(outstandingTotal)} onClick={() => navigate("/accounting")} />
        </motion.div>

        {/* ── Sprint health card ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
        >
          <ObjectiveHealthCard />
        </motion.div>

        {/* ── Main grid ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-1 lg:grid-cols-5 gap-6"
        >

          {/* ──── Left column (3 / 5) ──────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">

            {/* Latest Projects */}
            <section className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Derniers projets
                </h2>
                <Link
                  to="/projects"
                  className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  Voir tout <ChevronRight size={11} />
                </Link>
              </div>

              {projectsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground font-body mb-3">Aucun projet pour l'instant.</p>
                  <Button onClick={handleNewProject} size="sm" className="gap-1.5">
                    <Plus size={13} /> Nouveau projet
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentProjects.map(project => {
                    const tasks = project.tasks || [];
                    const completedTasks = tasks.filter(t => t.completed).length;
                    const totalTasks     = tasks.length;
                    const progress       = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                    const responses      = tasks.flatMap(t => t.feedbackRequests || []).filter(r => r.resolved && r.response).length;
                    const pSt  = PROJECT_STATUS[project.status] ?? PROJECT_STATUS.draft;
                    const pay  = PAYMENT_STATUS[project.paymentStatus] ?? PAYMENT_STATUS.unpaid;

                    return (
                      <div
                        key={project.id}
                        onClick={() => navigate(`/project/${project.id}/brief`)}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-secondary/30 cursor-pointer transition-colors group"
                      >
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="font-display text-sm font-semibold text-foreground break-words">
                              {project.title}
                            </span>
                            {responses > 0 && (
                              <span className="shrink-0 flex items-center gap-0.5 text-[9px] font-body font-semibold bg-palette-amber/15 text-palette-amber border border-palette-amber/30 rounded-full px-1.5 py-0.5">
                                <MessageSquare size={8} /> {responses}
                              </span>
                            )}
                          </div>
                          {clientName(project) && (
                            <p className="text-xs text-muted-foreground font-body">{clientName(project)}</p>
                          )}
                          {totalTasks > 0 && (
                            <div className="mt-1.5 flex items-center gap-2">
                              <div className="h-1 w-24 bg-border rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="text-[10px] text-muted-foreground font-body">
                                {completedTasks}/{totalTasks} tâches
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Badges */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${pay.cls}`}>{pay.label}</Badge>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${pSt.cls}`}>{pSt.label}</Badge>
                          <ChevronRight size={13} className="text-muted-foreground/30 group-hover:text-muted-foreground transition-colors ml-1" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Unpaid invoices only */}
            {unpaidInvoices.length > 0 && (
              <section className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Factures en attente
                    </h2>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700">
                      {unpaidInvoices.length}
                    </Badge>
                  </div>
                  <Link to="/quotes" className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
                    Tous les docs <ChevronRight size={11} />
                  </Link>
                </div>
                <div className="divide-y divide-border/30">
                  {unpaidInvoices.map(q => (
                    <div
                      key={q.id}
                      onClick={() => navigate(`/quotes/${q.id}`)}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/20 cursor-pointer transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-muted-foreground/60">{q.quoteNumber || "-"}</span>
                          <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0",
                            q.invoiceStatus === "validated" ? "border-amber-300 text-amber-600" : "border-primary/30 text-primary"
                          )}>
                            {q.invoiceStatus === "validated" ? "Validé" : q.invoiceStatus === "to-validate" ? "À valider" : q.invoiceStatus || "draft"}
                          </Badge>
                        </div>
                        <p className="text-sm font-body font-medium text-foreground/80 truncate">{q.clientName || q.projectTitle || "-"}</p>
                      </div>
                      <span className="text-sm font-body font-semibold text-foreground/80 tabular-nums shrink-0">
                        {formatCHF(totalQuote(q))}
                      </span>
                      <ChevronRight size={13} className="text-muted-foreground/20 shrink-0" />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Intakes */}
            <IntakeManager />

            {/* Analytics */}
            <AnalyticsWidget />

            {/* Google Calendar */}
            <CalendarWidget />

          </div>

          {/* ──── Right column (2 / 5) ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Email Queue */}
            <EmailQueue />

            {/* Upcoming deadlines */}
            {upcomingDeadlines.length > 0 && (
              <section className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                  <Calendar size={14} className="text-amber-500" />
                  <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Deadlines proches
                  </h2>
                </div>
                <div className="divide-y divide-border/30">
                  {upcomingDeadlines.map(p => {
                    const daysLeft = Math.ceil((new Date(p.endDate!).getTime() - Date.now()) / 86400000);
                    return (
                      <div
                        key={p.id}
                        onClick={() => navigate(`/project/${p.id}/brief`)}
                        className="flex items-center justify-between px-5 py-2.5 hover:bg-secondary/30 cursor-pointer transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-body font-medium text-foreground truncate">{p.title}</p>
                          {p.client && <p className="text-[10px] text-muted-foreground font-body">{p.client}</p>}
                        </div>
                        <span className={cn(
                          "text-xs font-mono font-semibold shrink-0 ml-2",
                          daysLeft <= 3 ? "text-red-600" : daysLeft <= 7 ? "text-amber-600" : "text-muted-foreground"
                        )}>
                          {daysLeft <= 0 ? "Aujourd'hui" : `${daysLeft}j`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Personal costs due soon */}
            {costsDueSoon.length > 0 && (
              <section className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
                  <Wallet size={14} className="text-red-500" />
                  <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Paiements à venir
                  </h2>
                </div>
                <div className="divide-y divide-border/30">
                  {costsDueSoon.map(cost => (
                    <div key={cost.id} className="flex items-center justify-between px-5 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-body font-medium text-foreground truncate">{cost.name}</p>
                        <p className="text-[10px] text-muted-foreground font-body font-mono">
                          CHF {cost.amount.toLocaleString("fr-CH")}
                        </p>
                      </div>
                      <span className={cn(
                        "text-xs font-mono font-semibold shrink-0 ml-2",
                        cost.daysUntil <= 0 ? "text-red-600" : cost.daysUntil <= 3 ? "text-amber-600" : "text-muted-foreground"
                      )}>
                        {cost.daysUntil <= 0 ? "Dû" : `${cost.daysUntil}j`}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Activity */}
            <RecentActivity />

          </div>
        </motion.div>

        {/* Quick Action FAB */}
        <QuickActionFAB />

        {/* ── Unified Objectives — full width, grouped by category ──────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-primary" />
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">Objectifs</h2>
            </div>
            <div className="flex items-center gap-2">
              {todos.length > 0 && (
                <span className="text-xs font-mono font-semibold text-muted-foreground">
                  {todos.filter(t => t.completed).length}/{todos.length}
                </span>
              )}
              <button
                onClick={() => setCompactView(v => !v)}
                className={cn(
                  "flex items-center gap-1 text-[10px] font-body px-2 py-0.5 rounded-full border transition-colors",
                  compactView
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/30 text-muted-foreground border-transparent hover:bg-muted/50",
                )}
                title={compactView ? "Passer en vue étendue" : "Passer en vue compacte"}
              >
                {compactView ? <LayoutList size={11} /> : <ListTodo size={11} />}
                {compactView ? "Compact" : "Étendu"}
              </button>
            </div>
          </div>
          {/* Category filter chips */}
          {(() => {
            const usedCats = [...new Set(todos.map(t => t.category).filter((c): c is string => !!c))];
            const orderedCats = [...ALL_CATEGORIES].filter(c => usedCats.includes(c));
            usedCats.forEach(c => { if (!orderedCats.includes(c as typeof ALL_CATEGORIES[number])) orderedCats.push(c as typeof ALL_CATEGORIES[number]); });
            if (orderedCats.length <= 1) return null;
            const anyHidden = orderedCats.some(c => hiddenCats.has(c));
            return (
              <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-body text-muted-foreground shrink-0 uppercase tracking-wider">Filtrer</span>
                {orderedCats.map(cat => {
                  const active = !hiddenCats.has(cat);
                  const colors = getCategoryColor(cat);
                  const count = todos.filter(t => t.category === cat && !t.completed).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCat(cat)}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-body font-medium whitespace-nowrap transition-all border",
                        active
                          ? cn(colors.bg, colors.text, "border-transparent")
                          : "bg-muted/30 text-muted-foreground/50 border-transparent line-through",
                      )}
                    >
                      {cat}{count > 0 && <span className="opacity-60 ml-0.5">·{count}</span>}
                    </button>
                  );
                })}
                {anyHidden && (
                  <button
                    onClick={() => setHiddenCats(new Set())}
                    className="text-[10px] font-body text-primary hover:underline ml-1 shrink-0"
                  >
                    Tout afficher
                  </button>
                )}
              </div>
            );
          })()}
          <div className="p-5">
            {/* Focus du jour — expanded with items by theme */}
            {(() => {
              const allSubs = Object.values(subtasksMap).flat();
              const flagged = allSubs.filter((s: any) => s.flaggedToday).filter(sub => {
                const parent = todos.find(t => t.id === sub.parentId);
                const cat = parent?.category || "Général";
                return !hiddenCats.has(cat);
              });
              if (flagged.length === 0) return null;
              const flagDone = flagged.filter(s => s.completed).length;

              // Group flagged subtasks by parent objective's category
              const grouped = new Map<string, SubtaskItem[]>();
              for (const sub of flagged) {
                const parent = todos.find(t => t.id === sub.parentId);
                const cat = parent?.category || "Général";
                if (!grouped.has(cat)) grouped.set(cat, []);
                grouped.get(cat)!.push(sub);
              }

              return (
                <div className="rounded-xl bg-amber-50/50 border border-amber-200/40 mb-4 overflow-hidden">
                  {/* Progress header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-200/30">
                    <Sun size={14} className="text-amber-500 shrink-0" />
                    <span className="text-xs font-display font-bold text-amber-800">Focus du jour</span>
                    <span className="text-xs font-mono text-amber-600 font-semibold">{flagDone}/{flagged.length}</span>
                    <div className="flex-1 h-1.5 bg-amber-200/40 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(flagDone / flagged.length) * 100}%` }} />
                    </div>
                  </div>
                  {/* Grouped items */}
                  <div className="px-3 py-2.5 space-y-3">
                    {Array.from(grouped.entries()).map(([cat, subs]) => {
                      const colors = getCategoryColor(cat);
                      return (
                        <div key={cat}>
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className={cn("w-1.5 h-1.5 rounded-full", colors.dot)} />
                            <span className={cn("text-[10px] font-display font-bold uppercase tracking-wider", colors.text)}>{cat}</span>
                          </div>
                          <div className="space-y-0.5">
                            {subs.map(sub => (
                              <div key={sub.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/60 group transition-colors">
                                <button
                                  onClick={() => handleSubtaskToggle(sub.parentId, sub.id)}
                                  className={cn("shrink-0 transition-colors", sub.completed ? "text-emerald-500" : "text-muted-foreground/40 hover:text-primary")}
                                >
                                  {sub.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                                </button>
                                <span className={cn("text-xs font-body flex-1", sub.completed && "line-through text-muted-foreground/50")}>
                                  {sub.text}
                                </span>
                                <button
                                  onClick={() => handleSubtaskUpdate(sub.parentId, sub.id, { flaggedToday: false })}
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground transition-opacity shrink-0"
                                  title="Retirer du focus"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Grouped by category */}
            {(() => {
              const today = new Date().toISOString().slice(0, 10);
              const dueSoon = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); })();
              const usedCats = [...new Set(todos.map(t => t.category))];
              // Order categories: ALL_CATEGORIES order, then any extra
              const orderedCats = [...ALL_CATEGORIES].filter(c => usedCats.includes(c));
              usedCats.forEach(c => { if (!orderedCats.includes(c)) orderedCats.push(c); });

              if (orderedCats.length === 0) {
                return <p className="text-sm text-muted-foreground font-body py-4 text-center">Aucun objectif.</p>;
              }

              const visibleCats = orderedCats.filter(c => !hiddenCats.has(c));
              if (visibleCats.length === 0) {
                return <p className="text-sm text-muted-foreground font-body py-4 text-center">Toutes les catégories sont masquées.</p>;
              }

              return visibleCats.map(cat => {
                const catTodos = todos.filter(t => t.category === cat);
                const sorted = sortObjectives(catTodos, today);
                const active = sorted.filter(t => !t.completed);
                const done = sorted.filter(t => t.completed);
                const catColors = getCategoryColor(cat);

                if (compactView) {
                  return (
                    <CategorySection
                      key={cat}
                      category={cat}
                      count={active.length}
                      completedCount={done.length}
                    >
                      <ul className="space-y-0.5">
                        {active.map(todo => {
                          const isOverdue = !!todo.dueDate && todo.dueDate < today;
                          const isDueSoon = !!todo.dueDate && !isOverdue && todo.dueDate <= dueSoon;
                          const subs = subtasksMap[todo.id] || [];
                          const subsTotal = subs.length;
                          const subsDone = subs.filter(s => s.completed).length;
                          const updateDays = objectiveDaysSinceUpdate(todo);
                          const isStale = updateDays >= OBJECTIVE_STALE_DAYS;
                          return (
                            <li key={todo.id}>
                              <div className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 group transition-colors",
                                isStale && "opacity-60",
                              )}>
                                <button
                                  onClick={() => toggleTodo(todo.id)}
                                  className="shrink-0 text-muted-foreground/40 hover:text-primary transition-colors"
                                  title="Marquer terminé"
                                >
                                  <Circle size={14} />
                                </button>
                                <div className={cn("w-1 h-1 rounded-full shrink-0", catColors.dot)} />
                                <button
                                  onClick={() => navigate(`/objective/${todo.source}/${todo.id}`, { state: { from: "/space" } })}
                                  className="flex-1 text-left truncate text-sm font-body text-foreground hover:text-primary transition-colors"
                                >
                                  {todo.text}
                                </button>
                                {todo.priority === "high" && (
                                  <span className="shrink-0 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/30">
                                    !
                                  </span>
                                )}
                                {(isOverdue || isDueSoon) && todo.dueDate && (
                                  <span
                                    className={cn(
                                      "shrink-0 text-[9px] font-body font-medium px-1.5 py-0.5 rounded-full border whitespace-nowrap",
                                      isOverdue
                                        ? "bg-destructive/10 text-destructive border-destructive/30"
                                        : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/30",
                                    )}
                                    title={`Échéance ${todo.dueDate}`}
                                  >
                                    {todo.dueDate.slice(5)}
                                  </span>
                                )}
                                {subsTotal > 0 && (
                                  <span className="shrink-0 text-[10px] font-mono tabular-nums text-muted-foreground/70">
                                    {subsDone}/{subsTotal}
                                  </span>
                                )}
                                {isStale && (
                                  <span
                                    className="inline-flex items-center gap-0.5 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400 shrink-0"
                                    title={`Pas modifié depuis ${updateDays} jours`}
                                  >
                                    <Hourglass size={9} />
                                    {updateDays}j
                                  </span>
                                )}
                                <ChevronRight size={13} className="shrink-0 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {done.length > 0 && (
                        <CompletedToggle count={done.length}>
                          <ul className="space-y-0.5">
                            {done.map(t => (
                              <li key={t.id} className="flex items-center gap-2 px-2 py-1 rounded-lg opacity-60">
                                <button
                                  onClick={() => toggleTodo(t.id)}
                                  className="shrink-0 text-emerald-500"
                                >
                                  <CheckCircle2 size={14} />
                                </button>
                                <div className={cn("w-1 h-1 rounded-full shrink-0", catColors.dot)} />
                                <span className="flex-1 truncate text-sm font-body line-through text-muted-foreground">
                                  {t.text}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </CompletedToggle>
                      )}
                    </CategorySection>
                  );
                }

                return (
                  <CategorySection
                    key={cat}
                    category={cat}
                    count={active.length}
                    completedCount={done.length}
                  >
                    {active.map((todo, idx) => {
                      const isOverdue = !!todo.dueDate && todo.dueDate < today;
                      const isDueSoon = !!todo.dueDate && !isOverdue && todo.dueDate <= dueSoon;
                      return todo.isObjective ? (
                        <ObjectiveRow
                          key={todo.id}
                          id={todo.id}
                          text={todo.text}
                          completed={todo.completed}
                          description={todo.description}
                          dueDate={todo.dueDate}
                          isOverdue={isOverdue}
                          isDueSoon={isDueSoon}
                          subtasks={subtasksMap[todo.id] || []}
                          priority={todo.priority || "medium"}
                          status={todo.status || "not_started"}
                          smartSpecific={todo.smartSpecific}
                          smartMeasurable={todo.smartMeasurable}
                          smartAchievable={todo.smartAchievable}
                          smartRelevant={todo.smartRelevant}
                          categoryBadge={todo.category}
                          parentCategory={cat}
                          categoryOptions={[...ALL_CATEGORIES]}
                          onToggle={() => toggleTodo(todo.id)}
                          onDelete={() => setTodoDeleteId(todo.id)}
                          onTitleSave={(title) => { if (title) updateObjectiveMut.mutate({ source: todo.source, id: todo.id, patch: { text: title } }); }}
                          onCategoryChange={(c) => updateObjectiveMut.mutate({ source: todo.source, id: todo.id, patch: { category: c } })}
                          onDescriptionSave={(desc) => updateObjectiveMut.mutate({ source: todo.source, id: todo.id, patch: { description: desc || null } })}
                          onSmartSave={(field, value) => {
                            if (field === "timebound") {
                              updateObjectiveMut.mutate({ source: todo.source, id: todo.id, patch: { dueDate: value || null } });
                            } else {
                              updateObjectiveMut.mutate({ source: todo.source, id: todo.id, patch: { [field]: value || null } as Partial<UnifiedObjective> });
                            }
                          }}
                          onPriorityChange={(p) => updateObjectiveMut.mutate({ source: todo.source, id: todo.id, patch: { priority: p } })}
                          onStatusChange={(s) => updateObjectiveMut.mutate({ source: todo.source, id: todo.id, patch: { status: s } })}
                          onSubtaskToggle={subId => handleSubtaskToggle(todo.id, subId)}
                          onSubtaskAdd={(text, due) => handleSubtaskAdd(todo.id, text, due)}
                          onSubtaskDelete={subId => handleSubtaskDelete(todo.id, subId)}
                          onSubtaskUpdate={(subId, data) => handleSubtaskUpdate(todo.id, subId, data)}
                          onMoveUp={idx > 0 ? () => swapObjectiveOrder(todo.id, active[idx - 1].id) : undefined}
                          onMoveDown={idx < active.length - 1 ? () => swapObjectiveOrder(todo.id, active[idx + 1].id) : undefined}
                          onOpenWorkspace={() => navigate(`/objective/${todo.source}/${todo.id}`, { state: { from: "/space" } })}
                          deleteConfirming={todoDeleteId === todo.id}
                          onDeleteConfirm={() => deleteTodo(todo.id)}
                          onDeleteCancel={() => setTodoDeleteId(null)}
                        />
                      ) : (
                        <ObjectiveRow
                          key={todo.id} id={todo.id} text={todo.text} completed={todo.completed}
                          dueDate={todo.dueDate} isOverdue={isOverdue} isDueSoon={isDueSoon}
                          subtasks={[]} priority={todo.priority || "medium"} status={todo.status || "not_started"}
                          isSimpleTodo
                          categoryBadge={todo.category} parentCategory={cat}
                          onToggle={() => toggleTodo(todo.id)}
                          onDelete={() => setTodoDeleteId(todo.id)}
                          onTitleSave={(title) => { if (title) updateObjectiveMut.mutate({ source: todo.source, id: todo.id, patch: { text: title } }); }}
                          onDescriptionSave={() => {}} onSmartSave={() => {}} onPriorityChange={() => {}} onStatusChange={() => {}}
                          onSubtaskToggle={() => {}} onSubtaskAdd={() => {}} onSubtaskDelete={() => {}}
                          deleteConfirming={todoDeleteId === todo.id} onDeleteConfirm={() => deleteTodo(todo.id)} onDeleteCancel={() => setTodoDeleteId(null)}
                        />
                      );
                    })}
                    {done.length > 0 && (
                      <CompletedToggle count={done.length}>
                        {done.map(t => t.isObjective ? (
                          <ObjectiveRow
                            key={t.id}
                            id={t.id}
                            text={t.text}
                            completed={true}
                            description={t.description}
                            dueDate={t.dueDate}
                            isOverdue={false}
                            isDueSoon={false}
                            subtasks={subtasksMap[t.id] || []}
                            priority={t.priority || "medium"}
                            status={t.status || "done"}
                            smartSpecific={t.smartSpecific}
                            smartMeasurable={t.smartMeasurable}
                            smartAchievable={t.smartAchievable}
                            smartRelevant={t.smartRelevant}
                            categoryBadge={t.category}
                            parentCategory={cat}
                            onToggle={() => toggleTodo(t.id)}
                            onDelete={() => deleteTodo(t.id)}
                            onDescriptionSave={(desc) => updateObjectiveMut.mutate({ source: t.source, id: t.id, patch: { description: desc || null } })}
                            onSmartSave={() => {}}
                            onPriorityChange={() => {}}
                            onStatusChange={() => {}}
                            onSubtaskToggle={subId => handleSubtaskToggle(t.id, subId)}
                            onSubtaskAdd={(text, due) => handleSubtaskAdd(t.id, text, due)}
                            onSubtaskDelete={subId => handleSubtaskDelete(t.id, subId)}
                            onOpenWorkspace={() => navigate(`/objective/${t.source}/${t.id}`, { state: { from: "/space" } })}
                            deleteConfirming={todoDeleteId === t.id}
                            onDeleteConfirm={() => deleteTodo(t.id)}
                            onDeleteCancel={() => setTodoDeleteId(null)}
                          />
                        ) : (
                          <ObjectiveRow
                            key={t.id} id={t.id} text={t.text} completed={true}
                            dueDate={t.dueDate} isOverdue={false} isDueSoon={false}
                            subtasks={[]} priority={t.priority || "medium"} status={t.status || "done"}
                            isSimpleTodo
                            categoryBadge={t.category} parentCategory={cat}
                            onToggle={() => toggleTodo(t.id)} onDelete={() => setTodoDeleteId(t.id)}
                            onDescriptionSave={() => {}} onSmartSave={() => {}} onPriorityChange={() => {}} onStatusChange={() => {}}
                            onSubtaskToggle={() => {}} onSubtaskAdd={() => {}} onSubtaskDelete={() => {}}
                            deleteConfirming={todoDeleteId === t.id} onDeleteConfirm={() => deleteTodo(t.id)} onDeleteCancel={() => setTodoDeleteId(null)}
                          />
                        ))}
                      </CompletedToggle>
                    )}
                  </CategorySection>
                );
              });
            })()}

            {/* Add form */}
            <div className="flex gap-1.5 pt-3 border-t border-border/30 mt-2">
              <Input
                id="new-objective-input"
                placeholder={newIsObj ? "Nouvel objectif..." : "Nouvelle tâche..."}
                value={newTodo}
                onChange={e => setNewTodo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTodo())}
                className="text-xs h-8"
              />
              <button
                onClick={() => setNewIsObj(o => !o)}
                title={newIsObj ? "Objectif SMART (cliquez pour basculer en tâche)" : "Tâche simple (cliquez pour basculer en objectif)"}
                className={cn(
                  "h-8 px-2 rounded-md border text-xs font-body flex items-center gap-1 shrink-0 transition-colors",
                  newIsObj
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary/50 text-muted-foreground border-border hover:border-primary/50",
                )}
              >
                <Target size={12} />
              </button>
              <select
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                className="text-[10px] h-8 px-1.5 rounded-md border border-border bg-secondary/50 text-foreground font-body shrink-0"
              >
                {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                onClick={addTodo}
                disabled={!newTodo.trim()}
                className="h-8 px-2.5 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        </motion.section>

      </main>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function MiniStat({
  icon, label, value, pulse, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  pulse?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary/60 transition-colors relative"
    >
      {icon}
      <span className="font-display text-sm font-bold text-foreground">{value}</span>
      <span className="text-[10px] font-body text-muted-foreground">{label}</span>
      {pulse && (
        <span className="w-1.5 h-1.5 rounded-full bg-palette-amber animate-pulse" />
      )}
    </button>
  );
}
