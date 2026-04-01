import { useState, useMemo, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useProjects } from "@/contexts/ProjectsContext";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import type { Quote } from "@/types/quote";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { printViaIframe } from "@/lib/printUtils";
import {
  Plus, LayoutList, Receipt, TrendingUp,
  MessageSquare, ChevronRight,
  Loader2, ListTodo, Sparkles,
  FileDown, Pencil, Trash2, Search, CheckCircle2, Circle, Target, Sun, X, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  listObjectives, createObjective, updateObjective, deleteObjective,
} from "@/api/objectives";
import { listCosts, type PersonalCostItem } from "@/api/personalCosts";
import { FREQUENCY_DAYS } from "@/types/personalCost";
import { Calendar, Wallet } from "lucide-react";
import type { ObjectiveItem } from "@/api/objectives";
import {
  listSubtasks, createSubtask, updateSubtask, deleteSubtask, batchCompleteSubtasks,
} from "@/api/todoSubtasks";
import type { SubtaskItem } from "@/api/todoSubtasks";
import { ObjectiveRow } from "@/components/todos/ObjectiveRow";
import { CategorySection } from "@/components/todos/CategorySection";
// DailyFocus replaced with inline focus bar
import { ALL_CATEGORIES, sortObjectives, getCategoryColor } from "@/lib/objectiveCategories";
import { QuickActionFAB } from "@/components/QuickActionFAB";
import { RecentActivity } from "@/components/RecentActivity";
import { CalendarWidget } from "@/components/calendar/CalendarWidget";
import { FunnelStatusWidget } from "@/components/funnel/FunnelStatusWidget";
import { IntakeManager } from "@/components/IntakeManager";
import { AnalyticsWidget } from "@/components/AnalyticsWidget";
import { EmailQueue } from "@/components/EmailQueue";
import { useClients } from "@/contexts/ClientsContext";
import { Users, Mail } from "lucide-react";

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

const INVOICE_STATUS: Record<string, { label: string; cls: string }> = {
  draft:         { label: "Draft",      cls: "text-muted-foreground border-border" },
  "to-validate": { label: "To review",  cls: "text-primary border-primary/40 bg-primary/5" },
  validated:     { label: "Validated",  cls: "text-palette-sage border-palette-sage/40 bg-palette-sage/5" },
  paid:          { label: "Paid",       cls: "text-palette-sage border-palette-sage/50 bg-palette-sage/10" },
  "on-hold":     { label: "On Hold",    cls: "text-palette-amber border-palette-amber/40 bg-palette-amber/5" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCHF(value: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF",
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function KojimaSpace() {
  const navigate   = useNavigate();
  const { projects, loading: projectsLoading, createProject } = useProjects();
  const { quotes, updateQuote, deleteQuote } = useQuotes();
  const { clients, getClient } = useClients();
  const clientName = (p: { clientId?: string; client: string }) => (p.clientId ? getClient(p.clientId)?.name : null) || p.client;

  // Calendar — now using Google Calendar API via CalendarWidget component

  // Invoice list
  const [invoiceFilter,  setInvoiceFilter]  = useState<"all" | "quote" | "invoice">("all");
  const [invoiceSearch,  setInvoiceSearch]  = useState("");
  const [deleteConfirm,  setDeleteConfirm]  = useState<string | null>(null);

  // Unified objectives
  const [todos, setTodos] = useState<ObjectiveItem[]>([]);
  const [subtasksMap, setSubtasksMap] = useState<Record<string, SubtaskItem[]>>({});
  const [todosLoading, setTodosLoading] = useState(true);
  const [newTodo, setNewTodo] = useState("");
  const [newIsObj, setNewIsObj] = useState(false);
  const [newCat, setNewCat] = useState("Kojima-Solutions");
  const [todoDeleteId, setTodoDeleteId] = useState<string | null>(null);

  // Personal costs due soon
  const [personalCosts, setPersonalCosts] = useState<PersonalCostItem[]>([]);

  useEffect(() => {
    Promise.all([
      listObjectives(),
      listSubtasks(),
    ]).then(([items, subs]) => {
      setTodos(items);
      const map: Record<string, SubtaskItem[]> = {};
      for (const s of subs) (map[s.parentId] ??= []).push(s);
      setSubtasksMap(map);
    }).catch(() => {}).finally(() => setTodosLoading(false));

    listCosts().then(setPersonalCosts).catch(() => {});
  }, []);

  async function addTodo() {
    if (!newTodo.trim()) return;
    const text = newTodo.trim();
    const isObjective = newIsObj;
    setNewTodo(""); setNewIsObj(false);
    try {
      const item = await createObjective({ text, category: newCat, isObjective });
      setTodos(prev => [...prev, item]);
    } catch {
      setTodos(prev => [...prev, {
        id: crypto.randomUUID(), text, completed: false, category: newCat,
        isObjective, order: todos.length, createdAt: new Date().toISOString(),
        priority: "medium", status: "not_started",
      }]);
    }
  }

  async function toggleTodo(id: string) {
    const todo = todos.find(t => t.id === id)!;
    const willComplete = !todo.completed;
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: willComplete } : t));
    try { await updateObjective(id, { completed: willComplete }); } catch {}
    if (willComplete && todo.isObjective) {
      const subs = subtasksMap[id] || [];
      if (subs.some(s => !s.completed)) {
        setSubtasksMap(prev => ({ ...prev, [id]: subs.map(s => ({ ...s, completed: true })) }));
        batchCompleteSubtasks(id, subs).catch(() => {});
      }
    }
  }

  async function swapObjectiveOrder(idA: string, idB: string) {
    const a = todos.find(t => t.id === idA);
    const b = todos.find(t => t.id === idB);
    if (!a || !b) return;
    setTodos(prev => prev.map(t => t.id === idA ? { ...t, order: b.order } : t.id === idB ? { ...t, order: a.order } : t));
    try { await updateObjective(idA, { order: b.order }); await updateObjective(idB, { order: a.order }); } catch {}
  }

  async function deleteTodo(id: string) {
    setTodos(prev => prev.filter(t => t.id !== id));
    setTodoDeleteId(null);
    try { await deleteObjective(id); } catch {}
  }

  // Subtask handlers
  async function handleSubtaskAdd(parentId: string, text: string, dueDate?: string) {
    try {
      const sub = await createSubtask({ parentId, text, dueDate });
      setSubtasksMap(prev => ({ ...prev, [parentId]: [...(prev[parentId] || []), sub] }));
    } catch {}
  }
  async function handleSubtaskToggle(parentId: string, subId: string) {
    const subs = subtasksMap[parentId] || [];
    const sub = subs.find(s => s.id === subId);
    if (!sub) return;
    setSubtasksMap(prev => ({ ...prev, [parentId]: subs.map(s => s.id === subId ? { ...s, completed: !s.completed } : s) }));
    try { await updateSubtask(subId, { completed: !sub.completed }); } catch {}
  }
  async function handleSubtaskDelete(parentId: string, subId: string) {
    setSubtasksMap(prev => ({ ...prev, [parentId]: (prev[parentId] || []).filter(s => s.id !== subId) }));
    try { await deleteSubtask(subId); } catch {}
  }
  async function handleSubtaskUpdate(parentId: string, subId: string, data: any) {
    setSubtasksMap(prev => ({ ...prev, [parentId]: (prev[parentId] || []).map(s => s.id === subId ? { ...s, ...data } : s) }));
    try { await updateSubtask(subId, data); } catch {}
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const activeProjects = useMemo(
    () => projects.filter(p => p.status === "in-progress").length,
    [projects]
  );
  const pendingResponses = useMemo(
    () => projects.reduce((sum, p) =>
      sum + p.tasks.flatMap(t => t.feedbackRequests || []).filter(r => r.resolved && r.response).length, 0),
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
  const filteredQuotes = useMemo(() => {
    let sorted = [...quotes].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (invoiceFilter === "quote")   sorted = sorted.filter(q => q.docType !== "invoice");
    if (invoiceFilter === "invoice") sorted = sorted.filter(q => q.docType === "invoice");
    if (invoiceSearch.trim()) {
      const q = invoiceSearch.toLowerCase();
      sorted = sorted.filter(item =>
        (item.quoteNumber || "").toLowerCase().includes(q) ||
        (item.clientName || "").toLowerCase().includes(q) ||
        (item.projectTitle || "").toLowerCase().includes(q)
      );
    }
    return sorted;
  }, [quotes, invoiceFilter, invoiceSearch]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleNewProject() {
    const p = createProject();
    navigate(`/project/${p.id}/brief`);
  }

  function handleStatusChange(q: Quote, newStatus: string) {
    updateQuote(q.id, { ...q, invoiceStatus: newStatus as Quote["invoiceStatus"] });
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
              Admin workspace
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
                <span className="hidden sm:inline">All </span>Projects
              </Button>
              <Button
                onClick={handleNewProject}
                className="bg-accent text-accent-foreground hover:bg-accent/90 font-body text-sm gap-1.5"
              >
                <Plus size={15} />
                <span className="hidden sm:inline">New </span>Project
              </Button>
              <Button
                onClick={() => navigate("/quotes/new")}
                className="bg-accent/70 text-accent-foreground hover:bg-accent/60 font-body text-sm gap-1.5"
              >
                <Plus size={15} />
                <span className="hidden sm:inline">New </span>Quote
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* ── Stats row ───────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <StatCard
            icon={<LayoutList size={19} className="text-primary" />}
            label="Active Projects"
            value={activeProjects}
            bg="bg-primary/10"
            onClick={() => navigate("/projects")}
          />
          <StatCard
            icon={<MessageSquare size={19} className="text-palette-amber" />}
            label="Client Responses"
            value={pendingResponses}
            bg="bg-palette-amber/10"
            pulse={pendingResponses > 0}
            onClick={() => navigate("/projects")}
          />
          <StatCard
            icon={<Receipt size={19} className="text-accent" />}
            label="To Review"
            value={invoicesToReview}
            bg="bg-accent/10"
            pulse={invoicesToReview > 0}
            onClick={() => navigate("/quotes")}
          />
          <StatCard
            icon={<TrendingUp size={19} className="text-palette-sage" />}
            label="Revenue (paid)"
            value={formatCHF(totalRevenue)}
            bg="bg-palette-sage/10"
            wide
            onClick={() => navigate("/quotes")}
          />
          <StatCard
            icon={<AlertTriangle size={19} className="text-destructive" />}
            label="En retard"
            value={overdueInvoices}
            bg="bg-destructive/10"
            pulse={overdueInvoices > 0}
            onClick={() => navigate("/accounting")}
          />
          <StatCard
            icon={<Receipt size={19} className="text-primary" />}
            label="À recevoir"
            value={formatCHF(outstandingTotal)}
            bg="bg-primary/10"
            wide
            onClick={() => navigate("/accounting")}
          />
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
                  Latest Projects
                </h2>
                <Link
                  to="/projects"
                  className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  View all <ChevronRight size={11} />
                </Link>
              </div>

              {projectsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground font-body mb-3">No projects yet.</p>
                  <Button onClick={handleNewProject} size="sm" className="gap-1.5">
                    <Plus size={13} /> New Project
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentProjects.map(project => {
                    const completedTasks = project.tasks.filter(t => t.completed).length;
                    const totalTasks     = project.tasks.length;
                    const progress       = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
                    const responses      = project.tasks.flatMap(t => t.feedbackRequests || []).filter(r => r.resolved && r.response).length;
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
                                {completedTasks}/{totalTasks} tasks
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

            {/* Invoices & Quotes manager */}
            <section className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Invoices & Quotes
                </h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
                    <Input
                      value={invoiceSearch}
                      onChange={e => setInvoiceSearch(e.target.value)}
                      placeholder="Search…"
                      className="h-7 text-xs pl-7 w-32 bg-secondary border-border"
                    />
                  </div>
                  <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5">
                    {(["all", "quote", "invoice"] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setInvoiceFilter(f)}
                        className={cn(
                          "text-[11px] font-body px-2.5 py-1 rounded-md transition-all",
                          invoiceFilter === f
                            ? "bg-card text-foreground shadow-sm font-semibold"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {f === "all" ? "All" : f === "quote" ? "Devis" : "Factures"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {filteredQuotes.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted-foreground font-body mb-3">No documents yet.</p>
                  <Button onClick={() => navigate("/quotes/new")} size="sm" variant="outline" className="gap-1.5">
                    <Plus size={13} /> New Quote
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-body">
                    <thead>
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Document</th>
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Client</th>
                        <th className="text-right px-4 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Amount</th>
                        <th className="text-left px-4 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Status</th>
                        <th className="text-right px-4 py-2.5 text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredQuotes.map(q => {
                        const isInv = q.docType === "invoice";
                        const st    = q.invoiceStatus ? INVOICE_STATUS[q.invoiceStatus] : null;

                        return (
                          <tr key={q.id} className="hover:bg-secondary/20 transition-colors">
                            {/* Doc */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <Badge
                                  variant="outline"
                                  className={cn("text-[9px] px-1.5 py-0 font-mono", isInv
                                    ? "border-accent/40 text-accent"
                                    : "border-primary/40 text-primary")}
                                >
                                  {isInv ? "FAC" : "DEV"}
                                </Badge>
                                <span className="text-muted-foreground font-mono text-[11px]">{q.quoteNumber || "-"}</span>
                              </div>
                              {q.projectTitle && (
                                <div className="text-[10px] text-muted-foreground/60 break-words">{q.projectTitle}</div>
                              )}
                            </td>
                            {/* Client */}
                            <td className="px-4 py-3 text-foreground">{q.clientName || "-"}</td>
                            {/* Amount */}
                            <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                              {formatCHF(totalQuote(q))}
                            </td>
                            {/* Status dropdown */}
                            <td className="px-4 py-3">
                              <select
                                value={q.invoiceStatus || ""}
                                onChange={e => handleStatusChange(q, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className={cn(
                                  "text-[10px] border rounded-full px-2 py-0.5 bg-transparent cursor-pointer outline-none font-body transition-colors",
                                  st ? st.cls : "text-muted-foreground border-border"
                                )}
                              >
                                <option value="">- no status -</option>
                                <option value="draft">Draft</option>
                                <option value="to-validate">To review</option>
                                <option value="validated">Validated</option>
                                <option value="paid">Paid</option>
                                <option value="on-hold">On Hold</option>
                              </select>
                            </td>
                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-0.5">
                                <button
                                  onClick={() => navigate(`/quotes/${q.id}`)}
                                  className="p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all"
                                  title="Edit"
                                >
                                  <Pencil size={12} />
                                </button>
                                <button
                                  onClick={() => printViaIframe(`/quotes/${q.id}/print`)}
                                  className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-all"
                                  title="Download PDF"
                                >
                                  <FileDown size={12} />
                                </button>
                                {deleteConfirm === q.id ? (
                                  <div className="flex items-center gap-1 ml-1">
                                    <button
                                      onClick={() => { deleteQuote(q.id); setDeleteConfirm(null); }}
                                      className="px-2 py-0.5 rounded text-[10px] bg-destructive text-white font-semibold"
                                    >
                                      Delete
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm(null)}
                                      className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setDeleteConfirm(q.id)}
                                    className="p-1.5 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all"
                                    title="Delete"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* ──── Right column (2 / 5) ─────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Email Queue */}
            <EmailQueue />

            {/* Analytics */}
            <AnalyticsWidget />

            {/* Intakes */}
            <IntakeManager />

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

            {/* Clients summary */}
            <section className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-primary" />
                  <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Clients
                  </h2>
                </div>
                <Link
                  to="/clients"
                  className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  Gérer <ChevronRight size={11} />
                </Link>
              </div>
              {clients.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground font-body">Aucun client.</p>
                </div>
              ) : (
                <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
                  {clients.slice(0, 10).map(client => (
                    <div
                      key={client.id}
                      className="flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/30 transition-colors"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-body font-medium text-foreground truncate">{client.name}</p>
                        {client.organization && (
                          <p className="text-[10px] text-muted-foreground font-body truncate">{client.organization}</p>
                        )}
                      </div>
                      {client.email && (
                        <a
                          href={`mailto:${client.email}`}
                          onClick={e => e.stopPropagation()}
                          className="p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-all shrink-0"
                          title={client.email}
                        >
                          <Mail size={12} />
                        </a>
                      )}
                    </div>
                  ))}
                  {clients.length > 10 && (
                    <div className="text-center py-2">
                      <Link to="/clients" className="text-xs font-body text-primary hover:underline">
                        +{clients.length - 10} autres clients
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Funnel Status */}
            <FunnelStatusWidget />

            {/* Google Calendar — API-powered widget */}
            <CalendarWidget />

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
            {todos.length > 0 && (
              <span className="text-xs font-mono font-semibold text-muted-foreground">
                {todos.filter(t => t.completed).length}/{todos.length}
              </span>
            )}
          </div>
          <div className="p-5">
            {/* Focus du jour — expanded with items by theme */}
            {(() => {
              const allSubs = Object.values(subtasksMap).flat();
              const flagged = allSubs.filter((s: any) => s.flaggedToday);
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

              return orderedCats.map(cat => {
                const catTodos = todos.filter(t => t.category === cat);
                const sorted = sortObjectives(catTodos, today);
                const active = sorted.filter(t => !t.completed);
                const done = sorted.filter(t => t.completed);

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
                          onTitleSave={async (title) => { if (title) { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, text: title } : t)); try { await updateObjective(todo.id, { text: title }); } catch {} } }}
                          onCategoryChange={async (c) => { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, category: c } : t)); try { await updateObjective(todo.id, { category: c }); } catch {} }}
                          onDescriptionSave={async (desc) => { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, description: desc || null } : t)); try { await updateObjective(todo.id, { description: desc || undefined }); } catch {} }}
                          onSmartSave={async (field, value) => { if (field === "timebound") { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, dueDate: value || undefined } : t)); try { await updateObjective(todo.id, { dueDate: value || undefined }); } catch {} } else { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, [field]: value || null } : t)); try { await updateObjective(todo.id, { [field]: value || undefined } as any); } catch {} } }}
                          onPriorityChange={async (p) => { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, priority: p } : t)); try { await updateObjective(todo.id, { priority: p }); } catch {} }}
                          onStatusChange={async (s) => { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, status: s } : t)); try { await updateObjective(todo.id, { status: s }); } catch {} }}
                          onSubtaskToggle={subId => handleSubtaskToggle(todo.id, subId)}
                          onSubtaskAdd={(text, due) => handleSubtaskAdd(todo.id, text, due)}
                          onSubtaskDelete={subId => handleSubtaskDelete(todo.id, subId)}
                          onSubtaskUpdate={(subId, data) => handleSubtaskUpdate(todo.id, subId, data)}
                          onMoveUp={idx > 0 ? () => swapObjectiveOrder(todo.id, active[idx - 1].id) : undefined}
                          onMoveDown={idx < active.length - 1 ? () => swapObjectiveOrder(todo.id, active[idx + 1].id) : undefined}
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
                          onTitleSave={async (title) => { if (title) { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, text: title } : t)); try { await updateObjective(todo.id, { text: title }); } catch {} } }}
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
                            onDescriptionSave={async (desc) => { setTodos(prev => prev.map(x => x.id === t.id ? { ...x, description: desc || null } : x)); try { await updateObjective(t.id, { description: desc || undefined }); } catch {} }}
                            onSmartSave={() => {}}
                            onPriorityChange={() => {}}
                            onStatusChange={() => {}}
                            onSubtaskToggle={subId => handleSubtaskToggle(t.id, subId)}
                            onSubtaskAdd={(text, due) => handleSubtaskAdd(t.id, text, due)}
                            onSubtaskDelete={subId => handleSubtaskDelete(t.id, subId)}
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
                placeholder="Nouvel objectif..."
                value={newTodo}
                onChange={e => setNewTodo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTodo())}
                className="text-xs h-8"
              />
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

function StatCard({
  icon, label, value, bg, pulse, wide, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  bg: string;
  pulse?: boolean;
  wide?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-2xl p-5 relative overflow-hidden transition-all",
        pulse && "border-palette-amber/40",
        onClick && "cursor-pointer hover:shadow-card-hover hover:border-primary/20"
      )}
    >
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mb-3", bg)}>
        {icon}
      </div>
      <div className={cn("font-display font-bold text-foreground leading-tight", wide ? "text-xl" : "text-2xl")}>
        {value}
      </div>
      <p className="text-[11px] font-body text-muted-foreground mt-0.5">{label}</p>
      {pulse && (
        <div className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-palette-amber animate-pulse" />
      )}
    </div>
  );
}
