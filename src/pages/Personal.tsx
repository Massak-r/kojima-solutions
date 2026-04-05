import { useState, useEffect, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, Circle, Trash2, Plus, Pencil, ExternalLink, ChevronRight,
  Search, ChevronDown, ChevronUp, Music2, Loader2, Sun,
  ArrowUp, ArrowDown, Link2, X, Copy, Check, Zap, RefreshCw, Calendar,
  Upload, Video, Play, Target, ShoppingCart, Package, Wallet,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

import {
  listObjectives, createObjective,
  updateObjective, deleteObjective,
} from "@/api/objectives";
import type { ObjectiveItem, TodoRecurring } from "@/api/objectives";
import {
  listSubtasks, createSubtask, updateSubtask, deleteSubtask, batchCompleteSubtasks,
} from "@/api/todoSubtasks";
import type { SubtaskItem } from "@/api/todoSubtasks";
import { PERSONAL_CATEGORIES, sortObjectives } from "@/lib/objectiveCategories";
import { ObjectiveRow } from "@/components/todos/ObjectiveRow";
import { CategorySection } from "@/components/todos/CategorySection";
import { TresorerieTab } from "@/components/personal/TresorerieTab";
// DailyFocus replaced with inline focus bar

import {
  listConsumables, createConsumable, updateConsumable, deleteConsumable,
} from "@/api/consumables";
import type { ConsumableItem } from "@/api/consumables";
import {
  getNextDue, getDaysUntilConsumableDue, UNIT_LABELS, UNIT_DAYS,
  type ConsumableUnit,
} from "@/types/consumable";
import {
  listBundles, createBundle, updateBundle, deleteBundle,
} from "@/api/consumableBundles";
import type { ConsumableBundle } from "@/api/consumableBundles";

import {
  listCosts, createCost, updateCost, deleteCost,
} from "@/api/personalCosts";
import type { PersonalCostItem } from "@/api/personalCosts";

import {
  listMoves, createMove, updateMove, deleteMove,
} from "@/api/salsaMoves";
import type { SalsaMoveItem } from "@/api/salsaMoves";

import {
  listAccess, addAccess, removeAccess,
} from "@/api/salsaAccess";
import type { SalsaAccessItem } from "@/api/salsaAccess";

import { listProgress } from "@/api/classProgress";
import type { ClassProgressItem } from "@/api/classProgress";

import {
  FREQUENCY_MONTHLY_FACTOR, FREQUENCY_DAYS, FREQUENCY_LABELS,
  type CostFrequency,
} from "@/types/personalCost";
import {
  SALSA_TYPE_LABELS, SALSA_DEFAULT_TOPICS,
  type SalsaType, type SalsaStatus,
} from "@/types/salsaMove";
import { ClassColumn } from "@/components/salsa/ClassColumn";
import { StarRating } from "@/components/salsa/StarRating";
import { RhythmReference } from "@/components/salsa/RhythmReference";
import {
  listAllPlaylists, createPlaylist, updatePlaylist, deletePlaylist,
  type Playlist,
} from "@/api/playlists";
import {
  listVideos, uploadVideo, deleteVideo, getVideoUrl,
  type SalsaVideo,
} from "@/api/salsaVideos";
import { VideoPlayer } from "@/components/salsa/VideoPlayer";
import { ChoreographyEditor } from "@/components/salsa/ChoreographyEditor";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCHF(n: number) {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n).replace(/(?<=\d)[\s\u00A0\u202F](?=\d)/g, "'");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getDaysSince(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getDaysUntilDue(cost: PersonalCostItem): number | null {
  const daysSince = getDaysSince(cost.lastPaid);
  if (daysSince === null) return null;
  return FREQUENCY_DAYS[cost.frequency as CostFrequency] - daysSince;
}


// ── Personal Todos Tab ────────────────────────────────────────────────────────

const RECURRING_LABELS: Record<TodoRecurring, string> = {
  daily:   'Quotidien',
  weekly:  'Hebdomadaire',
  monthly: 'Mensuel',
};

function nextRecurringDate(dueDate: string | undefined, recurring: TodoRecurring): string {
  const base = dueDate ? new Date(dueDate) : new Date();
  if (recurring === 'daily')   base.setDate(base.getDate() + 1);
  if (recurring === 'weekly')  base.setDate(base.getDate() + 7);
  if (recurring === 'monthly') base.setMonth(base.getMonth() + 1);
  return base.toISOString().slice(0, 10);
}

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

function TodosTab() {
  const { toast } = useToast();
  const [todos,         setTodos]         = useState<ObjectiveItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("kojima-personal-todos") || "[]"); } catch { return []; }
  });
  const [newText,       setNewText]       = useState("");
  const [newDue,        setNewDue]        = useState("");
  const [newRecurring,  setNewRecurring]  = useState<TodoRecurring | "">("");
  const [newIsObj,      setNewIsObj]      = useState(false);
  const [deleteId,      setDeleteId]      = useState<string | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [completedOpen, setCompletedOpen] = useState(false);

  // Subtasks state
  const [subtasksMap, setSubtasksMap] = useState<Record<string, SubtaskItem[]>>({});

  useEffect(() => {
    Promise.all([
      listObjectives([...PERSONAL_CATEGORIES]),
      listSubtasks(),
    ]).then(([items, subs]) => {
      setTodos(items);
      setCompletedOpen(items.filter(t => t.completed).length <= 3);
      localStorage.setItem("kojima-personal-todos", JSON.stringify(items));
      // Group subtasks by parentId
      const map: Record<string, SubtaskItem[]> = {};
      for (const s of subs) {
        (map[s.parentId] ??= []).push(s);
      }
      setSubtasksMap(map);
      localStorage.setItem("kojima-personal-subtasks", JSON.stringify(subs));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function sync(updated: ObjectiveItem[]) {
    setTodos(updated);
    localStorage.setItem("kojima-personal-todos", JSON.stringify(updated));
  }

  async function addTodo() {
    const text = newText.trim();
    if (!text) return;
    const isObjective = newIsObj;
    setNewText(""); setNewDue(""); setNewRecurring(""); setNewIsObj(false);
    try {
      const item = await createObjective({
        text,
        category:    "Perso",
        dueDate:     newDue       || undefined,
        recurring:   newRecurring || undefined,
        isObjective,
      });
      sync([...todos, item]);
    } catch {
      const fake: ObjectiveItem = {
        id: crypto.randomUUID(), text, completed: false, category: "Perso", order: todos.length,
        dueDate: newDue || undefined, recurring: (newRecurring as TodoRecurring) || undefined,
        isObjective,
        priority: "medium", status: "not_started",
        createdAt: new Date().toISOString(),
      };
      sync([...todos, fake]);
    }
  }

  async function toggle(id: string) {
    const todo = todos.find(t => t.id === id)!;
    const willComplete = !todo.completed;
    const updated = todos.map(t => t.id === id ? { ...t, completed: willComplete } : t);
    sync(updated);
    try { await updateObjective(id, { completed: willComplete }); } catch {}

    // If completing an objective, auto-complete all subtasks
    if (willComplete && todo.isObjective) {
      const subs = subtasksMap[id] || [];
      const incomplete = subs.filter(s => !s.completed);
      if (incomplete.length > 0) {
        setSubtasksMap(prev => ({
          ...prev,
          [id]: subs.map(s => ({ ...s, completed: true })),
        }));
        batchCompleteSubtasks(id, subs).catch(() => {});
      }
    }

    // Spawn next occurrence for recurring todos
    if (willComplete && todo.recurring) {
      const nextDue = nextRecurringDate(todo.dueDate, todo.recurring);
      try {
        const next = await createObjective({ text: todo.text, category: todo.category || "Perso", dueDate: nextDue, recurring: todo.recurring });
        sync([...updated, next]);
      } catch {}
    }
  }

  async function remove(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    sync(todos.filter(t => t.id !== id));
    setSubtasksMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    setDeleteId(null);
    try { await deleteObjective(id); } catch {}
  }

  async function swapOrder(idA: string, idB: string) {
    const a = todos.find(t => t.id === idA);
    const b = todos.find(t => t.id === idB);
    if (!a || !b) return;
    setTodos(prev => prev.map(t => t.id === idA ? { ...t, order: b.order } : t.id === idB ? { ...t, order: a.order } : t));
    try { await updateObjective(idA, { order: b.order }); await updateObjective(idB, { order: a.order }); } catch {}
  }

  async function promote(id: string) {
    const updated = todos.map(t => t.id === id ? { ...t, isObjective: true } : t);
    sync(updated);
    try { await updateObjective(id, { isObjective: true }); } catch {}
  }

  async function saveDescription(id: string, desc: string) {
    const updated = todos.map(t => t.id === id ? { ...t, description: desc || null } : t);
    sync(updated);
    try { await updateObjective(id, { description: desc || undefined }); } catch {}
  }

  async function saveSmartField(id: string, field: string, value: string) {
    if (field === "timebound") {
      const updated = todos.map(t => t.id === id ? { ...t, dueDate: value || undefined } : t);
      sync(updated);
      try { await updateObjective(id, { dueDate: value || undefined }); } catch {}
      return;
    }
    const updated = todos.map(t => t.id === id ? { ...t, [field]: value || null } : t);
    sync(updated);
    try { await updateObjective(id, { [field]: value || undefined } as any); } catch {}
  }

  async function savePriority(id: string, priority: any) {
    const updated = todos.map(t => t.id === id ? { ...t, priority } : t);
    sync(updated);
    try { await updateObjective(id, { priority }); } catch {}
  }

  async function saveStatus(id: string, status: any) {
    const updated = todos.map(t => t.id === id ? { ...t, status } : t);
    sync(updated);
    try { await updateObjective(id, { status }); } catch {}
  }

  async function handleSubtaskToggle(parentId: string, subId: string) {
    const subs = subtasksMap[parentId] || [];
    const sub = subs.find(s => s.id === subId);
    if (!sub) return;
    const newCompleted = !sub.completed;
    setSubtasksMap(prev => ({
      ...prev,
      [parentId]: (prev[parentId] || []).map(s => s.id === subId ? { ...s, completed: newCompleted } : s),
    }));
    try { await updateSubtask(subId, { completed: newCompleted }); } catch {}
  }

  async function handleSubtaskAdd(parentId: string, text: string, dueDate?: string) {
    try {
      const sub = await createSubtask({ parentId, text, dueDate });
      setSubtasksMap(prev => ({
        ...prev,
        [parentId]: [...(prev[parentId] || []), sub],
      }));
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ajouter l'étape", variant: "destructive" });
    }
  }

  async function handleSubtaskDelete(parentId: string, subId: string) {
    setSubtasksMap(prev => ({
      ...prev,
      [parentId]: (prev[parentId] || []).filter(s => s.id !== subId),
    }));
    try { await deleteSubtask(subId); } catch {}
  }

  async function handleSubtaskUpdate(parentId: string, subId: string, data: any) {
    setSubtasksMap(prev => ({
      ...prev,
      [parentId]: (prev[parentId] || []).map(s => s.id === subId ? { ...s, ...data } : s),
    }));
    try { await updateSubtask(subId, data); } catch {}
  }

  const today     = todayStr();
  const pending   = todos.filter(t => !t.completed);
  const completed = todos.filter(t => t.completed);

  // Sort pending: overdue first, then by due date, then undated
  const sortedPending = [...pending].sort((a, b) => {
    const da = a.dueDate ?? '9999-99-99';
    const db = b.dueDate ?? '9999-99-99';
    return da.localeCompare(db);
  });

  const dueSoonDate = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); })();

  return (
    <div className="max-w-5xl mx-auto">
      {/* Add form */}
      <div className="flex gap-2 mb-2">
        <Input
          placeholder={newIsObj ? "Nouvel objectif…" : "Ajouter une tâche…"}
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTodo()}
          className="font-body"
        />
        <Button onClick={addTodo} size="icon" variant="outline"><Plus size={16} /></Button>
      </div>
      {/* Optional due date + recurring + objective toggle */}
      <div className="flex gap-2 mb-6 flex-wrap items-center">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar size={13} />
          <input
            type="date"
            value={newDue}
            onChange={e => setNewDue(e.target.value)}
            className="bg-transparent border border-border rounded-md px-2 py-1 text-xs font-body text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            title="Échéance (optionnel)"
          />
        </div>
        {!newIsObj && (
          <Select value={newRecurring || "none"} onValueChange={v => setNewRecurring(v === "none" ? "" : v as TodoRecurring)}>
            <SelectTrigger className="h-7 text-xs font-body w-full sm:w-40">
              <SelectValue placeholder="Récurrence…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Pas de récurrence</SelectItem>
              <SelectItem value="daily">Quotidien</SelectItem>
              <SelectItem value="weekly">Hebdomadaire</SelectItem>
              <SelectItem value="monthly">Mensuel</SelectItem>
            </SelectContent>
          </Select>
        )}
        <button
          onClick={() => { setNewIsObj(o => !o); if (!newIsObj) setNewRecurring(""); }}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors font-body",
            newIsObj
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-transparent text-muted-foreground border-border hover:border-primary/50",
          )}
          title="Créer comme objectif SMART"
        >
          <Target size={12} />
          Objectif
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && todos.length === 0 && (
        <p className="text-center text-muted-foreground text-sm py-8">Aucune tâche. Ajoutez-en une !</p>
      )}

      {/* Focus du jour — compact bar */}
      {(() => {
        const allSubs = Object.values(subtasksMap).flat();
        const flagged = allSubs.filter((s: any) => s.flaggedToday);
        if (flagged.length === 0) return null;
        const flagDone = flagged.filter(s => s.completed).length;
        return (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50/60 border border-amber-200/40 mb-2">
            <Sun size={14} className="text-amber-500 shrink-0" />
            <span className="text-xs font-display font-bold text-amber-800">Focus du jour</span>
            <span className="text-xs font-mono text-amber-600 font-semibold">{flagDone}/{flagged.length}</span>
            <div className="flex-1 h-1.5 bg-amber-200/40 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${(flagDone / flagged.length) * 100}%` }} />
            </div>
            {flagDone === flagged.length && flagged.length > 0 && (
              <button
                onClick={() => { flagged.forEach(s => handleSubtaskUpdate(s.parentId, s.id, { flaggedToday: false })); }}
                className="text-[10px] font-body text-amber-600 hover:text-amber-800 transition-colors"
              >
                Vider
              </button>
            )}
          </div>
        );
      })()}

      {/* Grouped by category */}
      {[...PERSONAL_CATEGORIES].filter(cat => todos.some(t => t.category === cat)).map(cat => {
        const catTodos = todos.filter(t => t.category === cat);
        const sorted = sortObjectives(catTodos, today);
        const active = sorted.filter(t => !t.completed);
        const catDone = sorted.filter(t => t.completed);

        return (
          <CategorySection key={cat} category={cat} count={active.length} completedCount={catDone.length}>
            {active.map((todo, idx) => {
              const isOverdue = !!todo.dueDate && todo.dueDate < today;
              const isDueSoon = !!todo.dueDate && !isOverdue && todo.dueDate <= dueSoonDate;
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
                  recurringLabel={todo.recurring ? RECURRING_LABELS[todo.recurring] : undefined}
                  categoryBadge={todo.category}
                  categoryOptions={[...PERSONAL_CATEGORIES]}
                  onToggle={() => toggle(todo.id)}
                  onDelete={() => remove(todo.id)}
                  onTitleSave={async (title) => { if (title) { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, text: title } : t)); try { await updateObjective(todo.id, { text: title }); } catch {} } }}
                  onCategoryChange={async (c) => { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, category: c } : t)); try { await updateObjective(todo.id, { category: c }); } catch {} }}
                  onDescriptionSave={desc => saveDescription(todo.id, desc)}
                  onSmartSave={(field, value) => saveSmartField(todo.id, field, value)}
                  onPriorityChange={p => savePriority(todo.id, p)}
                  onStatusChange={s => saveStatus(todo.id, s)}
                  onSubtaskToggle={subId => handleSubtaskToggle(todo.id, subId)}
                  onSubtaskAdd={(text, due) => handleSubtaskAdd(todo.id, text, due)}
                  onSubtaskDelete={subId => handleSubtaskDelete(todo.id, subId)}
                  onSubtaskUpdate={(subId, data) => handleSubtaskUpdate(todo.id, subId, data)}
                  onMoveUp={idx > 0 ? () => swapOrder(todo.id, active[idx - 1].id) : undefined}
                  onMoveDown={idx < active.length - 1 ? () => swapOrder(todo.id, active[idx + 1].id) : undefined}
                  deleteConfirming={deleteId === todo.id}
                  onDeleteConfirm={() => remove(todo.id)}
                  onDeleteCancel={() => setDeleteId(null)}
                />
              ) : (
                <ObjectiveRow
                  key={todo.id}
                  id={todo.id}
                  text={todo.text}
                  completed={todo.completed}
                  dueDate={todo.dueDate}
                  isOverdue={isOverdue}
                  isDueSoon={isDueSoon}
                  subtasks={[]}
                  priority={todo.priority || "medium"}
                  status={todo.status || "not_started"}
                  isSimpleTodo
                  recurringLabel={todo.recurring ? RECURRING_LABELS[todo.recurring] : undefined}
                  categoryBadge={todo.category}
                  onToggle={() => toggle(todo.id)}
                  onDelete={() => setDeleteId(todo.id)}
                  onTitleSave={async (title) => { if (title) { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, text: title } : t)); try { await updateObjective(todo.id, { text: title }); } catch {} } }}
                  onDescriptionSave={() => {}}
                  onSmartSave={() => {}}
                  onPriorityChange={p => savePriority(todo.id, p)}
                  onStatusChange={() => {}}
                  onSubtaskToggle={() => {}}
                  onSubtaskAdd={() => {}}
                  onSubtaskDelete={() => {}}
                  deleteConfirming={deleteId === todo.id}
                  onDeleteConfirm={() => remove(todo.id)}
                  onDeleteCancel={() => setDeleteId(null)}
                />
              );
            })}
            {catDone.length > 0 && (
              <CompletedToggle count={catDone.length}>
                {catDone.map(t => t.isObjective ? (
                  <ObjectiveRow
                    key={t.id} id={t.id} text={t.text} completed={true}
                    description={t.description} dueDate={t.dueDate} isOverdue={false} isDueSoon={false}
                    subtasks={subtasksMap[t.id] || []} priority={t.priority || "medium"} status={t.status || "done"}
                    smartSpecific={t.smartSpecific} smartMeasurable={t.smartMeasurable}
                    smartAchievable={t.smartAchievable} smartRelevant={t.smartRelevant}
                    categoryBadge={t.category}
                    onToggle={() => toggle(t.id)} onDelete={() => remove(t.id)}
                    onDescriptionSave={() => {}} onSmartSave={() => {}} onPriorityChange={() => {}} onStatusChange={() => {}}
                    onSubtaskToggle={subId => handleSubtaskToggle(t.id, subId)}
                    onSubtaskAdd={(text, due) => handleSubtaskAdd(t.id, text, due)}
                    onSubtaskDelete={subId => handleSubtaskDelete(t.id, subId)}
                    deleteConfirming={deleteId === t.id} onDeleteConfirm={() => remove(t.id)} onDeleteCancel={() => setDeleteId(null)}
                  />
                ) : (
                  <ObjectiveRow
                    key={t.id} id={t.id} text={t.text} completed={true}
                    dueDate={t.dueDate} isOverdue={false} isDueSoon={false}
                    subtasks={[]} priority={t.priority || "medium"} status={t.status || "done"}
                    isSimpleTodo
                    onToggle={() => toggle(t.id)} onDelete={() => setDeleteId(t.id)}
                    onDescriptionSave={() => {}} onSmartSave={() => {}} onPriorityChange={() => {}} onStatusChange={() => {}}
                    onSubtaskToggle={() => {}} onSubtaskAdd={() => {}} onSubtaskDelete={() => {}}
                    deleteConfirming={deleteId === t.id} onDeleteConfirm={() => remove(t.id)} onDeleteCancel={() => setDeleteId(null)}
                  />
                ))}
              </CompletedToggle>
            )}
          </CategorySection>
        );
      })}
      {todos.length === 0 && !loading && <p className="text-sm text-muted-foreground font-body py-4 text-center">Aucune tâche.</p>}
    </div>
  );
}

// ── Budget Tab ────────────────────────────────────────────────────────────────

const FREQUENCIES: CostFrequency[] = ["weekly", "monthly", "bimonthly", "quarterly", "biannual", "yearly"];

const CATEGORY_COLORS: Record<string, string> = {
  Logement: "#6366f1", Housing: "#6366f1",
  Assurance: "#f59e0b", Insurance: "#f59e0b",
  Abonnement: "#ec4899", Subscription: "#ec4899",
  Alimentation: "#22c55e", Food: "#22c55e",
  Transport: "#3b82f6",
  Animal: "#a855f7", Pet: "#a855f7",
  Ménage: "#14b8a6", Household: "#14b8a6",
  Santé: "#ef4444", Health: "#ef4444",
  Consommable: "#f97316",
};
const DEFAULT_CAT_COLOR = "#94a3b8";
function catColor(cat: string): string {
  if (!cat) return DEFAULT_CAT_COLOR;
  for (const [k, v] of Object.entries(CATEGORY_COLORS)) {
    if (cat.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return DEFAULT_CAT_COLOR;
}

const BUNDLE_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#14b8a6", "#ef4444"];

const PRESET_STORES = [
  { name: "Galaxus",  color: "#3b82f6" },
  { name: "Coop",     color: "#ef4444" },
  { name: "Migros",   color: "#f59e0b" },
  { name: "Manor",    color: "#a855f7" },
];

function BudgetTab() {
  // ── Recurring costs state ──
  const [costs,    setCosts]    = useState<PersonalCostItem[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [name,      setName]      = useState("");
  const [amount,    setAmount]    = useState("");
  const [frequency, setFrequency] = useState<CostFrequency>("monthly");
  const [category,  setCategory]  = useState("");
  const [lastPaid,  setLastPaid]  = useState("");
  const [saving,    setSaving]    = useState(false);
  const [editCostId, setEditCostId] = useState<string | null>(null);
  const [editCostData, setEditCostData] = useState<{ name: string; amount: string; frequency: CostFrequency; category: string; lastPaid: string }>({ name: "", amount: "", frequency: "monthly", category: "", lastPaid: "" });

  // ── Consumables state ──
  const [consumables,    setConsumables]    = useState<ConsumableItem[]>([]);
  const [consLoading,    setConsLoading]    = useState(true);
  const [consDeleteId,   setConsDeleteId]   = useState<string | null>(null);
  const [consName,       setConsName]       = useState("");
  const [consEst,        setConsEst]        = useState("");
  const [consEvery,      setConsEvery]      = useState("1");
  const [consUnit,       setConsUnit]       = useState<ConsumableUnit>("weeks");
  const [consLast,       setConsLast]       = useState("");
  const [consSaving,     setConsSaving]     = useState(false);
  const [consBundleIds,  setConsBundleIds]   = useState<string[]>([]);
  const [editConsId,     setEditConsId]     = useState<string | null>(null);
  const [editConsData,   setEditConsData]   = useState<{ name: string; estimatedCost: string; everyN: string; unit: ConsumableUnit; bundleIds: string[]; lastPurchased: string }>({ name: "", estimatedCost: "", everyN: "1", unit: "weeks", bundleIds: [], lastPurchased: "" });

  // ── Bundles state ──
  const [bundles,     setBundles]     = useState<ConsumableBundle[]>([]);
  const [bundleDialog, setBundleDialog] = useState(false);
  const [bundleEditId, setBundleEditId] = useState<string | null>(null);
  const [bundleName,   setBundleName]   = useState("");
  const [bundleColor,  setBundleColor]  = useState(BUNDLE_COLORS[0]);
  const [bundleDeleteId, setBundleDeleteId] = useState<string | null>(null);

  // ── Management section collapse ──
  const [showRecurring, setShowRecurring] = useState(false);
  const [showConsumables, setShowConsumables] = useState(false);

  // ── Timeline expand ──
  const [showAllTimeline, setShowAllTimeline] = useState(false);

  const { toast } = useToast();
  const errToast = () => toast({ title: "Erreur", description: "L'opération a échoué", variant: "destructive" });

  useEffect(() => {
    listCosts().then(setCosts).catch(errToast).finally(() => setLoading(false));
    listConsumables().then(setConsumables).catch(errToast).finally(() => setConsLoading(false));
    listBundles().then(setBundles).catch(errToast);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Computed values ──
  const monthlyTotal = useMemo(
    () => costs.reduce((sum, c) => sum + c.amount * FREQUENCY_MONTHLY_FACTOR[c.frequency as CostFrequency], 0),
    [costs]
  );

  const consMonthlyTotal = useMemo(
    () => consumables.reduce((sum, c) => {
      const intervalDays = c.everyN * UNIT_DAYS[c.unit];
      return sum + (c.estimatedCost * 30 / intervalDays);
    }, 0),
    [consumables]
  );

  const totalMonthly = monthlyTotal + consMonthlyTotal;

  // Category breakdown for donut chart
  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    costs.forEach(c => {
      const cat = c.category || "Autre";
      const monthly = c.amount * FREQUENCY_MONTHLY_FACTOR[c.frequency as CostFrequency];
      map.set(cat, (map.get(cat) ?? 0) + monthly);
    });
    if (consMonthlyTotal > 0) {
      map.set("Consommable", (map.get("Consommable") ?? 0) + consMonthlyTotal);
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100, color: catColor(name) }))
      .sort((a, b) => b.value - a.value);
  }, [costs, consMonthlyTotal]);

  // Unified timeline — individual items only (store grouping handled by "Prochains achats")
  type TimelineItem = { id: string; name: string; amount: number; days: number | null; type: 'recurring' | 'consumable'; bundleIds: string[] };
  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];
    costs.forEach(c => {
      items.push({ id: c.id, name: c.name, amount: c.amount, days: getDaysUntilDue(c), type: 'recurring', bundleIds: [] });
    });
    consumables.forEach(c => {
      items.push({ id: c.id, name: c.name, amount: c.estimatedCost, days: getDaysUntilConsumableDue(c), type: 'consumable', bundleIds: c.bundleIds });
    });
    return items.sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999));
  }, [costs, consumables]);

  // Shopping threshold for "Prochains achats"
  const [shoppingThreshold, setShoppingThreshold] = useState(7);

  // Store-based shopping groups — consumables due within threshold, grouped by store
  // A consumable with multiple bundleIds appears in each store group
  const storeShoppingGroups = useMemo(() => {
    const dueByStore = new Map<string, ConsumableItem[]>();
    const unbundledDue: ConsumableItem[] = [];

    consumables.forEach(c => {
      const days = getDaysUntilConsumableDue(c);
      if (days === null || days > shoppingThreshold) return;
      if (c.bundleIds.length > 0) {
        c.bundleIds.forEach(bid => {
          const existing = dueByStore.get(bid) ?? [];
          existing.push(c);
          dueByStore.set(bid, existing);
        });
      } else {
        unbundledDue.push(c);
      }
    });

    const groups = Array.from(dueByStore.entries()).map(([bundleId, items]) => {
      const bundle = bundles.find(b => b.id === bundleId);
      const minDays = Math.min(...items.map(c => getDaysUntilConsumableDue(c) ?? 9999));
      const totalCost = items.reduce((s, c) => s + c.estimatedCost, 0);
      return { bundleId, name: bundle?.name ?? 'Autre', color: bundle?.color ?? '#6366f1', items, minDays, totalCost };
    });

    groups.sort((a, b) => a.minDays - b.minDays);
    return { groups, unbundledDue };
  }, [consumables, bundles, shoppingThreshold]);

  // Next payment
  const nextPayment = timeline.length > 0 && timeline[0].days !== null ? timeline[0] : null;

  // Bundle helpers
  const bundleMap = useMemo(() => {
    const m = new Map<string, ConsumableBundle>();
    bundles.forEach(b => m.set(b.id, b));
    return m;
  }, [bundles]);

  const bundleItems = useCallback((bundleId: string) =>
    consumables.filter(c => c.bundleIds.includes(bundleId)),
  [consumables]);

  // Sorted consumables for management list
  const sortedConsumables = useMemo(() =>
    [...consumables].sort((a, b) => (getDaysUntilConsumableDue(a) ?? 9999) - (getDaysUntilConsumableDue(b) ?? 9999)),
  [consumables]);

  // ── Recurring handlers ──
  async function addCost() {
    if (!name.trim() || !amount) return;
    setSaving(true);
    try {
      const item = await createCost({
        name: name.trim(), amount: parseFloat(amount), frequency,
        category: category.trim() || undefined, lastPaid: lastPaid || undefined,
      });
      setCosts(prev => [...prev, item]);
      setName(""); setAmount(""); setCategory(""); setLastPaid(""); setFrequency("monthly");
      toast({ title: "Dépense ajoutée" });
    } catch { errToast(); }
    setSaving(false);
  }

  async function markPaid(id: string) {
    const today = todayStr();
    const prev = costs.find(c => c.id === id)?.lastPaid;
    setCosts(p => p.map(c => c.id === id ? { ...c, lastPaid: today } : c));
    try { await updateCost(id, { lastPaid: today }); }
    catch { setCosts(p => p.map(c => c.id === id ? { ...c, lastPaid: prev } : c)); errToast(); }
  }

  async function removeCost(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    const removed = costs.find(c => c.id === id);
    setCosts(prev => prev.filter(c => c.id !== id));
    setDeleteId(null);
    try { await deleteCost(id); }
    catch { if (removed) setCosts(prev => [...prev, removed]); errToast(); }
  }

  async function saveEditCost() {
    if (!editCostId) return;
    setSaving(true);
    try {
      const updated = await updateCost(editCostId, {
        name: editCostData.name.trim(),
        amount: parseFloat(editCostData.amount),
        frequency: editCostData.frequency,
        category: editCostData.category.trim() || undefined,
        lastPaid: editCostData.lastPaid || undefined,
      });
      setCosts(prev => prev.map(c => c.id === editCostId ? updated : c));
      setEditCostId(null);
      toast({ title: "Mis à jour" });
    } catch { errToast(); }
    setSaving(false);
  }

  // ── Consumable handlers ──
  async function handleAddConsumable() {
    if (!consName.trim()) return;
    setConsSaving(true);
    try {
      const item = await createConsumable({
        name: consName.trim(),
        estimatedCost: parseFloat(consEst) || 0,
        everyN: parseInt(consEvery) || 1,
        unit: consUnit,
        lastPurchased: consLast || undefined,
        bundleIds: consBundleIds,
      });
      setConsumables(prev => [...prev, item]);
      setConsName(""); setConsEst(""); setConsEvery("1"); setConsUnit("weeks"); setConsLast(""); setConsBundleIds([]);
      toast({ title: "Consommable ajouté" });
    } catch { errToast(); }
    setConsSaving(false);
  }

  async function markBought(id: string) {
    const today = todayStr();
    const prev = consumables.find(c => c.id === id)?.lastPurchased;
    setConsumables(p => p.map(c => c.id === id ? { ...c, lastPurchased: today } : c));
    try { await updateConsumable(id, { lastPurchased: today }); }
    catch { setConsumables(p => p.map(c => c.id === id ? { ...c, lastPurchased: prev } : c)); errToast(); }
  }

  async function markBundleBought(bundleId: string) {
    const today = todayStr();
    const items = consumables.filter(c => c.bundleIds.includes(bundleId));
    const prevStates = items.map(i => ({ id: i.id, lastPurchased: i.lastPurchased }));
    setConsumables(prev => prev.map(c => c.bundleIds.includes(bundleId) ? { ...c, lastPurchased: today } : c));
    try {
      for (const item of items) await updateConsumable(item.id, { lastPurchased: today });
    } catch {
      setConsumables(prev => prev.map(c => {
        const ps = prevStates.find(p => p.id === c.id);
        return ps ? { ...c, lastPurchased: ps.lastPurchased } : c;
      }));
      errToast();
    }
    toast({ title: "Tout marqué comme acheté" });
  }

  async function removeConsumable(id: string) {
    if (consDeleteId !== id) { setConsDeleteId(id); return; }
    const removed = consumables.find(c => c.id === id);
    setConsumables(prev => prev.filter(c => c.id !== id));
    setConsDeleteId(null);
    try { await deleteConsumable(id); }
    catch { if (removed) setConsumables(prev => [...prev, removed]); errToast(); }
  }

  async function saveEditCons() {
    if (!editConsId) return;
    setConsSaving(true);
    try {
      const updated = await updateConsumable(editConsId, {
        name: editConsData.name.trim(),
        estimatedCost: parseFloat(editConsData.estimatedCost) || 0,
        everyN: parseInt(editConsData.everyN) || 1,
        unit: editConsData.unit,
        bundleIds: editConsData.bundleIds,
        lastPurchased: editConsData.lastPurchased || undefined,
      });
      setConsumables(prev => prev.map(c => c.id === editConsId ? updated : c));
      setEditConsId(null);
      toast({ title: "Mis à jour" });
    } catch { errToast(); }
    setConsSaving(false);
  }

  // ── Bundle handlers ──
  async function saveBundle() {
    if (!bundleName.trim()) return;
    if (bundleEditId) {
      try {
        const updated = await updateBundle(bundleEditId, { name: bundleName.trim(), color: bundleColor });
        setBundles(prev => prev.map(b => b.id === bundleEditId ? updated : b));
        toast({ title: "Magasin mis à jour" });
      } catch { errToast(); }
    } else {
      try {
        const b = await createBundle({ name: bundleName.trim(), color: bundleColor });
        setBundles(prev => [...prev, b]);
        toast({ title: "Magasin créé" });
      } catch { errToast(); }
    }
    setBundleName(""); setBundleDialog(false); setBundleEditId(null);
  }

  function openBundleEdit(bundle: ConsumableBundle) {
    setBundleEditId(bundle.id);
    setBundleName(bundle.name);
    setBundleColor(bundle.color ?? BUNDLE_COLORS[0]);
    setBundleDialog(true);
  }

  async function removeBundle(id: string) {
    if (bundleDeleteId !== id) { setBundleDeleteId(id); return; }
    const removed = bundles.find(b => b.id === id);
    setConsumables(prev => prev.map(c => c.bundleIds.includes(id) ? { ...c, bundleIds: c.bundleIds.filter(bid => bid !== id) } : c));
    setBundles(prev => prev.filter(b => b.id !== id));
    setBundleDeleteId(null);
    try { await deleteBundle(id); }
    catch { if (removed) setBundles(prev => [...prev, removed]); errToast(); }
  }

  async function toggleStore(consumableId: string, storeId: string) {
    const c = consumables.find(x => x.id === consumableId);
    if (!c) return;
    const prev = c.bundleIds;
    const next = prev.includes(storeId) ? prev.filter(id => id !== storeId) : [...prev, storeId];
    setConsumables(p => p.map(x => x.id === consumableId ? { ...x, bundleIds: next } : x));
    try { await updateConsumable(consumableId, { bundleIds: next }); }
    catch { setConsumables(p => p.map(x => x.id === consumableId ? { ...x, bundleIds: prev } : x)); errToast(); }
  }

  // ── Due label helpers ──
  function dueLabel(days: number | null, type: 'recurring' | 'consumable'): { text: string; cls: string } {
    if (days === null) return { text: type === 'recurring' ? "Jamais payé" : "Jamais acheté", cls: "text-amber-600" };
    if (days < 0)      return { text: `En retard ${Math.abs(days)}j`, cls: "text-destructive font-semibold" };
    if (days === 0)    return { text: "Aujourd'hui", cls: "text-destructive font-semibold" };
    if (days <= 3)     return { text: `${days}j`, cls: "text-amber-600 font-medium" };
    if (days <= 7)     return { text: `${days}j`, cls: "text-amber-600" };
    if (days <= 14)    return { text: `${days}j`, cls: "text-muted-foreground" };
    if (days <= 30)    return { text: `${Math.round(days / 7)} sem`, cls: "text-muted-foreground" };
    return { text: `${Math.round(days / 30)} mois`, cls: "text-muted-foreground" };
  }

  function stripColor(days: number | null): string {
    if (days === null) return "bg-amber-400";
    if (days < 0)      return "bg-red-500";
    if (days <= 3)     return "bg-amber-400";
    if (days <= 7)     return "bg-amber-300";
    return "bg-green-400";
  }

  const isLoading = loading || consLoading;

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }

  const visibleTimeline = showAllTimeline ? timeline : timeline.slice(0, 8);

  return (
    <div className="max-w-4xl mx-auto space-y-6">

      {/* ════════════════════════════════════════════════════════════════════════
          PANEL 1: Monthly Dashboard
         ════════════════════════════════════════════════════════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="glass-card rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* Donut chart */}
          {categoryData.length > 0 ? (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, delay: 0.15 }} className="w-48 h-48 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%" cy="50%"
                    innerRadius={55} outerRadius={80}
                    dataKey="value"
                    stroke="none"
                    paddingAngle={2}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCHF(value)}
                    contentStyle={{ borderRadius: 12, fontSize: 12, fontFamily: 'var(--font-body)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-base sm:text-lg font-bold font-body truncate max-w-[90%]">{formatCHF(totalMonthly)}</span>
                <span className="text-[10px] text-muted-foreground font-body">/mois</span>
              </div>
            </motion.div>
          ) : (
            <div className="w-48 h-48 shrink-0 flex items-center justify-center text-muted-foreground text-sm font-body">
              Aucune donnée
            </div>
          )}

          {/* Stats */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
            {[
              { label: "Charges fixes", value: formatCHF(monthlyTotal), sub: `${formatCHF(monthlyTotal * 12)}/an`, accent: true },
              { label: "Consommables", value: formatCHF(consMonthlyTotal), sub: `${formatCHF(consMonthlyTotal * 12)}/an` },
            ].map((card, i) => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.08 }} className="glass-card rounded-xl p-4 text-center">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body mb-1">{card.label}</p>
                <p className={cn("text-xl font-bold font-body", card.accent && "text-primary")}>{card.value}</p>
                <p className="text-[10px] text-muted-foreground font-body">{card.sub}</p>
              </motion.div>
            ))}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }} className="glass-card rounded-xl p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body mb-1">Prochain paiement</p>
              {nextPayment ? (
                <>
                  <p className="text-sm font-semibold font-body break-words">{nextPayment.name}</p>
                  <p className={cn("text-xs font-body", nextPayment.days !== null && nextPayment.days <= 3 ? "text-destructive font-semibold" : "text-muted-foreground")}>
                    {dueLabel(nextPayment.days, nextPayment.type).text}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground font-body">-</p>
              )}
            </motion.div>
          </div>
        </div>

        {/* Category legend */}
        {categoryData.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4 pt-3 border-t border-border/50">
            {categoryData.map(d => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs font-body text-muted-foreground">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span>{d.name}</span>
                <span className="font-medium text-foreground">{formatCHF(d.value)}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* ════════════════════════════════════════════════════════════════════════
          PANEL 2: Upcoming Payments Timeline
         ════════════════════════════════════════════════════════════════════════ */}
      {timeline.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }} className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-body font-semibold flex items-center gap-2">
              <Calendar size={14} className="text-primary" /> Échéances à venir
            </p>
            <span className="text-xs text-muted-foreground font-body">
              {timeline.filter(t => t.days !== null && t.days <= 0).length} en retard
            </span>
          </div>

          <div className="space-y-1.5">
            {visibleTimeline.map((item, idx) => {
              const dl = dueLabel(item.days, item.type);
              const itemBundles = item.bundleIds.map(id => bundleMap.get(id)).filter(Boolean);
              return (
                <motion.div
                  key={`${item.type}-${item.id}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.04, duration: 0.25 }}
                  className="flex items-center gap-2 sm:gap-3 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className={cn("w-1.5 h-7 rounded-full shrink-0", stripColor(item.days))} />
                  <span className="text-xs shrink-0" title={item.type === 'recurring' ? 'Charge récurrente' : 'Consommable'}>
                    {item.type === 'recurring' ? '🔄' : '🛒'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-body font-medium break-words">{item.name}</span>
                      {itemBundles.map(bundle => bundle && (
                        <span key={bundle.id} className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-full font-body" style={{ backgroundColor: (bundle.color ?? '#6366f1') + '20', color: bundle.color ?? undefined }}>
                          {bundle.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-xs font-body text-muted-foreground shrink-0">{formatCHF(item.amount)}</span>
                  <span className={cn("text-xs font-body w-12 sm:w-16 text-right shrink-0", dl.cls)}>{dl.text}</span>
                  <Button
                    size="sm" variant="ghost"
                    className="h-7 px-2 text-xs font-body opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => item.type === 'recurring' ? markPaid(item.id) : markBought(item.id)}
                  >
                    <Check size={12} className="sm:mr-1" />
                    <span className="hidden sm:inline">{item.type === 'recurring' ? 'Payé' : 'Acheté'}</span>
                  </Button>
                </motion.div>
              );
            })}
          </div>

          {timeline.length > 8 && (
            <button
              onClick={() => setShowAllTimeline(v => !v)}
              className="text-xs font-body text-primary hover:underline w-full text-center pt-1"
            >
              {showAllTimeline ? 'Réduire' : `Voir tout (${timeline.length})`}
            </button>
          )}
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PANEL: Prochains achats — Due items grouped by store
         ════════════════════════════════════════════════════════════════════════ */}
      {(storeShoppingGroups.groups.length > 0 || storeShoppingGroups.unbundledDue.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-body font-semibold flex items-center gap-2">
              <ShoppingCart size={14} className="text-primary" /> Prochains achats
            </p>
            <Select value={String(shoppingThreshold)} onValueChange={v => setShoppingThreshold(parseInt(v))}>
              <SelectTrigger className="h-7 w-auto px-2 text-xs font-body border-0 bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 jours</SelectItem>
                <SelectItem value="7">7 jours</SelectItem>
                <SelectItem value="14">14 jours</SelectItem>
                <SelectItem value="30">30 jours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Store groups */}
          <div className="space-y-3">
            {storeShoppingGroups.groups.map((group, gi) => {
              const today = todayStr();
              return (
                <motion.div
                  key={group.bundleId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: gi * 0.06 }}
                  className="border border-border/50 rounded-xl overflow-hidden"
                >
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                    <span className="text-sm font-body font-semibold flex-1">{group.name}</span>
                    <Badge variant="secondary" className="text-[10px] font-body">{group.items.length} article{group.items.length !== 1 ? 's' : ''}</Badge>
                  </div>
                  <div className="px-3 py-2 space-y-1.5">
                    {group.items.map(c => {
                      const days = getDaysUntilConsumableDue(c);
                      const dl = dueLabel(days, 'consumable');
                      const boughtToday = c.lastPurchased === today;
                      const isDue = days !== null && days <= 3;
                      return (
                        <div key={c.id} className={cn("flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors", boughtToday ? "bg-green-50 dark:bg-green-950/20" : isDue ? "bg-amber-50/50 dark:bg-amber-950/10" : "")}>
                          <button
                            onClick={() => markBought(c.id)}
                            className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              boughtToday ? "border-green-500 bg-green-500 text-white" : isDue ? "border-amber-500 hover:bg-amber-500 hover:text-white" : "border-muted-foreground/30 hover:bg-muted"
                            )}
                          >
                            {boughtToday && <Check size={10} />}
                          </button>
                          <span className={cn("text-sm font-body flex-1 break-words min-w-0", boughtToday && "line-through text-muted-foreground")}>{c.name}</span>
                          <span className={cn("text-[10px] font-body shrink-0", boughtToday ? "text-green-600" : dl.cls)}>{boughtToday ? "OK" : dl.text}</span>
                          {c.estimatedCost > 0 && <span className="text-xs font-body text-muted-foreground shrink-0">~{formatCHF(c.estimatedCost)}</span>}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/20">
                    <span className="text-xs font-body text-muted-foreground">Total: <strong>~{formatCHF(group.totalCost)}</strong></span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs font-body" onClick={() => markBundleBought(group.bundleId)}>
                      <Check size={12} className="mr-1" /> Tout acheté
                    </Button>
                  </div>
                </motion.div>
              );
            })}

            {/* Unbundled due items */}
            {storeShoppingGroups.unbundledDue.length > 0 && (
              <div className="border border-border/50 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
                  <span className="text-sm font-body font-medium text-muted-foreground flex-1">Sans magasin</span>
                  <Badge variant="secondary" className="text-[10px] font-body">{storeShoppingGroups.unbundledDue.length}</Badge>
                </div>
                <div className="px-3 py-2 space-y-1.5">
                  {storeShoppingGroups.unbundledDue.map(c => {
                    const days = getDaysUntilConsumableDue(c);
                    const dl = dueLabel(days, 'consumable');
                    const boughtToday = c.lastPurchased === todayStr();
                    const isDue = days !== null && days <= 3;
                    return (
                      <div key={c.id} className={cn("flex items-center gap-3 py-1.5 px-2 rounded-lg transition-colors", boughtToday ? "bg-green-50 dark:bg-green-950/20" : isDue ? "bg-amber-50/50 dark:bg-amber-950/10" : "")}>
                        <button
                          onClick={() => markBought(c.id)}
                          className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                            boughtToday ? "border-green-500 bg-green-500 text-white" : isDue ? "border-amber-500 hover:bg-amber-500 hover:text-white" : "border-muted-foreground/30 hover:bg-muted"
                          )}
                        >
                          {boughtToday && <Check size={10} />}
                        </button>
                        <span className={cn("text-sm font-body flex-1 break-words min-w-0", boughtToday && "line-through text-muted-foreground")}>{c.name}</span>
                        <span className={cn("text-[10px] font-body shrink-0", boughtToday ? "text-green-600" : dl.cls)}>{boughtToday ? "OK" : dl.text}</span>
                        {c.estimatedCost > 0 && <span className="text-xs font-body text-muted-foreground shrink-0">~{formatCHF(c.estimatedCost)}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          PANEL 3: Management Section
         ════════════════════════════════════════════════════════════════════════ */}

      {/* Section A: Charges récurrentes */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowRecurring(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        >
          <span className="text-sm font-body font-semibold flex items-center gap-2">
            🔄 Charges récurrentes
            <Badge variant="secondary" className="text-[10px] font-body">{costs.length}</Badge>
          </span>
          {showRecurring ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <AnimatePresence>
          {showRecurring && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4">
                {/* Add form */}
                <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-body text-muted-foreground font-medium">Nouvelle dépense récurrente</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input placeholder="Nom" value={name} onChange={e => setName(e.target.value)} className="font-body h-9 text-sm" />
                    <Input placeholder="Montant CHF" type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="font-body h-9 text-sm" />
                    <Select value={frequency} onValueChange={v => setFrequency(v as CostFrequency)}>
                      <SelectTrigger className="font-body h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FREQUENCIES.map(f => <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Catégorie" value={category} onChange={e => setCategory(e.target.value)} className="font-body h-9 text-sm" />
                    <div className="sm:col-span-2 flex gap-2">
                      <Input type="date" value={lastPaid} onChange={e => setLastPaid(e.target.value)} className="font-body h-9 text-sm w-auto" title="Dernier paiement" />
                      <Button onClick={addCost} disabled={saving || !name.trim() || !amount} className="flex-1 h-9 text-sm">
                        {saving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Cost list */}
                {costs.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-4 font-body">Aucune dépense.</p>
                ) : (
                  <div className="space-y-1.5">
                    {[...costs].sort((a, b) => (getDaysUntilDue(a) ?? 9999) - (getDaysUntilDue(b) ?? 9999)).map(cost => {
                      const days = getDaysUntilDue(cost);
                      const monthly = cost.amount * FREQUENCY_MONTHLY_FACTOR[cost.frequency as CostFrequency];
                      const dl = dueLabel(days, 'recurring');
                      const isEditing = editCostId === cost.id;

                      if (isEditing) {
                        return (
                          <div key={cost.id} className="bg-muted/30 rounded-xl p-3 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input value={editCostData.name} onChange={e => setEditCostData(d => ({ ...d, name: e.target.value }))} className="font-body h-9 text-sm" />
                              <Input type="number" step="0.01" value={editCostData.amount} onChange={e => setEditCostData(d => ({ ...d, amount: e.target.value }))} className="font-body h-9 text-sm" />
                              <Select value={editCostData.frequency} onValueChange={v => setEditCostData(d => ({ ...d, frequency: v as CostFrequency }))}>
                                <SelectTrigger className="font-body h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {FREQUENCIES.map(f => <SelectItem key={f} value={f}>{FREQUENCY_LABELS[f]}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Input value={editCostData.category} onChange={e => setEditCostData(d => ({ ...d, category: e.target.value }))} placeholder="Catégorie" className="font-body h-9 text-sm" />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEditCost} disabled={saving} className="h-8 text-xs font-body">
                                {saving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Check size={12} className="mr-1" />} Sauver
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditCostId(null)} className="h-8 text-xs font-body">Annuler</Button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={cost.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors group">
                          <div className={cn("w-1.5 h-8 rounded-full shrink-0", stripColor(days))} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-body font-medium text-sm">{cost.name}</span>
                              {cost.category && <Badge variant="secondary" className="text-[10px] font-body">{cost.category}</Badge>}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground font-body flex-wrap">
                              <span>{formatCHF(cost.amount)} · {FREQUENCY_LABELS[cost.frequency as CostFrequency]}</span>
                              <span className="opacity-60">≈ {formatCHF(monthly)}/mois</span>
                              <span className={cn("font-medium", dl.cls)}>{dl.text}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-[11px] font-body" onClick={() => markPaid(cost.id)}>
                              <Check size={10} className="mr-1" /> Payé
                            </Button>
                            <button
                              onClick={() => { setEditCostId(cost.id); setEditCostData({ name: cost.name, amount: String(cost.amount), frequency: cost.frequency as CostFrequency, category: cost.category || "", lastPaid: cost.lastPaid || "" }); }}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <Pencil size={12} />
                            </button>
                            {deleteId === cost.id ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" onClick={() => removeCost(cost.id)}>Oui</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setDeleteId(null)}>Non</Button>
                              </div>
                            ) : (
                              <button onClick={() => removeCost(cost.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section B: Consommables */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <button
          onClick={() => setShowConsumables(v => !v)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
        >
          <span className="text-sm font-body font-semibold flex items-center gap-2">
            🛒 Consommables
            <Badge variant="secondary" className="text-[10px] font-body">{consumables.length}</Badge>
            {bundles.length > 0 && <Badge variant="outline" className="text-[10px] font-body">{bundles.length} magasin{bundles.length > 1 ? 's' : ''}</Badge>}
          </span>
          {showConsumables ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        <AnimatePresence>
          {showConsumables && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-4">
                {/* Store management */}
                <div className="flex gap-2 items-center">
                  <Button size="sm" variant="outline" className="h-8 text-xs font-body" onClick={() => { setBundleEditId(null); setBundleName(""); setBundleColor(BUNDLE_COLORS[0]); setBundleDialog(true); }}>
                    <Package size={12} className="mr-1.5" /> Nouveau magasin
                  </Button>
                </div>
                {bundles.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-body text-muted-foreground font-medium">Mes magasins</p>
                    {bundles.map(bundle => {
                      const items = bundleItems(bundle.id);
                      return (
                        <div key={bundle.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors group">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: bundle.color ?? BUNDLE_COLORS[0] }} />
                          <span className="text-sm font-body font-medium flex-1 break-words min-w-0">{bundle.name}</span>
                          <span className="text-[10px] font-body text-muted-foreground">{items.length} article{items.length !== 1 ? 's' : ''}</span>
                          <button onClick={() => openBundleEdit(bundle)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                            <Pencil size={11} />
                          </button>
                          {bundleDeleteId === bundle.id ? (
                            <div className="flex gap-1">
                              <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => removeBundle(bundle.id)}>Oui</Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setBundleDeleteId(null)}>Non</Button>
                            </div>
                          ) : (
                            <button onClick={() => removeBundle(bundle.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add consumable form */}
                <div className="bg-muted/30 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-body text-muted-foreground font-medium">Nouveau consommable</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Input placeholder="Nom" value={consName} onChange={e => setConsName(e.target.value)} className="font-body h-9 text-sm" />
                    <Input placeholder="Coût estimé CHF" type="number" step="0.01" value={consEst} onChange={e => setConsEst(e.target.value)} className="font-body h-9 text-sm" />
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-muted-foreground shrink-0 font-body">Tous les</span>
                      <Input type="number" min="1" value={consEvery} onChange={e => setConsEvery(e.target.value)} className="w-16 font-body h-9 text-sm" />
                      <Select value={consUnit} onValueChange={v => setConsUnit(v as ConsumableUnit)}>
                        <SelectTrigger className="font-body flex-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="days">jours</SelectItem>
                          <SelectItem value="weeks">semaines</SelectItem>
                          <SelectItem value="months">mois</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {bundles.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {bundles.map(b => {
                          const sel = consBundleIds.includes(b.id);
                          return (
                            <button key={b.id} type="button" onClick={() => setConsBundleIds(prev => sel ? prev.filter(id => id !== b.id) : [...prev, b.id])}
                              className={cn("flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-body border transition-colors h-9",
                                sel ? "border-primary/50 bg-primary/10" : "border-border/50 opacity-50 hover:opacity-80"
                              )}
                            >
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color ?? BUNDLE_COLORS[0] }} />
                              {b.name}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground font-body self-center">Aucun magasin</span>
                    )}
                    <div className="sm:col-span-2 flex gap-2">
                      <Input type="date" value={consLast} onChange={e => setConsLast(e.target.value)} className="font-body h-9 text-sm w-auto" title="Dernier achat" />
                      <Button onClick={handleAddConsumable} disabled={consSaving || !consName.trim()} className="flex-1 h-9 text-sm">
                        {consSaving ? <Loader2 size={14} className="animate-spin mr-1" /> : <Plus size={14} className="mr-1" />}
                        Ajouter
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Consumables list */}
                {consumables.length === 0 ? (
                  <p className="text-center text-muted-foreground text-xs py-4 font-body">Aucun consommable.</p>
                ) : (
                  <div className="space-y-1.5">
                    {sortedConsumables.map(c => {
                      const days = getDaysUntilConsumableDue(c);
                      const dl = dueLabel(days, 'consumable');
                      const cBundles = c.bundleIds.map(id => bundleMap.get(id)).filter(Boolean);
                      const isEditing = editConsId === c.id;

                      if (isEditing) {
                        return (
                          <div key={c.id} className="bg-muted/30 rounded-xl p-3 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input value={editConsData.name} onChange={e => setEditConsData(d => ({ ...d, name: e.target.value }))} placeholder="Nom" className="font-body h-9 text-sm" />
                              <Input type="number" step="0.01" value={editConsData.estimatedCost} onChange={e => setEditConsData(d => ({ ...d, estimatedCost: e.target.value }))} placeholder="Coût CHF" className="font-body h-9 text-sm" />
                              <div className="flex gap-2 items-center">
                                <span className="text-xs text-muted-foreground shrink-0 font-body">Tous les</span>
                                <Input type="number" min="1" value={editConsData.everyN} onChange={e => setEditConsData(d => ({ ...d, everyN: e.target.value }))} className="w-16 font-body h-9 text-sm" />
                                <Select value={editConsData.unit} onValueChange={v => setEditConsData(d => ({ ...d, unit: v as ConsumableUnit }))}>
                                  <SelectTrigger className="font-body flex-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="days">jours</SelectItem>
                                    <SelectItem value="weeks">semaines</SelectItem>
                                    <SelectItem value="months">mois</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Input type="date" value={editConsData.lastPurchased} onChange={e => setEditConsData(d => ({ ...d, lastPurchased: e.target.value }))} className="font-body h-9 text-sm" title="Dernier achat" />
                            </div>
                            {bundles.length > 0 && (
                              <div>
                                <p className="text-[10px] text-muted-foreground font-body mb-1">Magasins</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {bundles.map(b => {
                                    const selected = editConsData.bundleIds.includes(b.id);
                                    return (
                                      <button key={b.id} onClick={() => setEditConsData(d => ({ ...d, bundleIds: selected ? d.bundleIds.filter(id => id !== b.id) : [...d.bundleIds, b.id] }))}
                                        className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-body border transition-colors",
                                          selected ? "border-primary/50 bg-primary/10" : "border-border/50 opacity-50 hover:opacity-80"
                                        )}
                                      >
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: b.color ?? BUNDLE_COLORS[0] }} />
                                        {b.name}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" onClick={saveEditCons} disabled={consSaving} className="h-8 text-xs font-body">
                                {consSaving ? <Loader2 size={12} className="animate-spin mr-1" /> : <Check size={12} className="mr-1" />} Sauver
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditConsId(null)} className="h-8 text-xs font-body">Annuler</Button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={c.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-muted/30 transition-colors group">
                          <div className={cn("w-1.5 h-8 rounded-full shrink-0", stripColor(days))} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-body font-medium text-sm break-words">{c.name}</span>
                              {cBundles.map(bundle => bundle && (
                                <span key={bundle.id} className="text-[10px] px-1.5 py-0.5 rounded-full font-body shrink-0" style={{ backgroundColor: (bundle.color ?? BUNDLE_COLORS[0]) + '20', color: bundle.color ?? BUNDLE_COLORS[0] }}>
                                  {bundle.name}
                                </span>
                              ))}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground font-body flex-wrap">
                              <span>Tous les {c.everyN} {UNIT_LABELS[c.unit]}{c.estimatedCost > 0 && ` · ~${formatCHF(c.estimatedCost)}`}</span>
                              <span className={cn("font-medium", dl.cls)}>{dl.text}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="sm" variant="outline" className="h-7 text-[11px] font-body" onClick={() => markBought(c.id)}>
                              <Check size={10} className="mr-1" /> Acheté
                            </Button>
                            <button
                              onClick={() => { setEditConsId(c.id); setEditConsData({ name: c.name, estimatedCost: String(c.estimatedCost), everyN: String(c.everyN), unit: c.unit, bundleIds: [...c.bundleIds], lastPurchased: c.lastPurchased || "" }); }}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-muted opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                            >
                              <Pencil size={12} />
                            </button>
                            {consDeleteId === c.id ? (
                              <div className="flex gap-1">
                                <Button size="sm" variant="destructive" className="h-7 text-[10px] px-2" onClick={() => removeConsumable(c.id)}>Oui</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-[10px] px-2" onClick={() => setConsDeleteId(null)}>Non</Button>
                              </div>
                            ) : (
                              <button onClick={() => removeConsumable(c.id)} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-lg hover:bg-destructive/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Store create/edit dialog */}
      <Dialog open={bundleDialog} onOpenChange={v => { setBundleDialog(v); if (!v) setBundleEditId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-body">{bundleEditId ? "Modifier le magasin" : "Nouveau magasin"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {/* Quick-add presets (create mode only) */}
            {!bundleEditId && (() => {
              const existingNames = new Set(bundles.map(b => b.name.toLowerCase()));
              const available = PRESET_STORES.filter(p => !existingNames.has(p.name.toLowerCase()));
              if (available.length === 0) return null;
              return (
                <>
                  <div>
                    <p className="text-xs font-body text-muted-foreground mb-2">Ajout rapide</p>
                    <div className="flex flex-wrap gap-2">
                      {available.map(preset => (
                        <button
                          key={preset.name}
                          onClick={async () => {
                            try {
                              const b = await createBundle({ name: preset.name, color: preset.color });
                              setBundles(prev => [...prev, b]);
                              toast({ title: "Magasin créé" });
                              setBundleDialog(false);
                            } catch { errToast(); }
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-body border border-border/50 hover:bg-muted/50 transition-colors"
                        >
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: preset.color }} />
                          {preset.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <div className="flex-1 h-px bg-border" />
                    <span className="font-body">ou personnaliser</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                </>
              );
            })()}
            <Input placeholder="Nom du magasin (ex: Galaxus, Coop...)" value={bundleName} onChange={e => setBundleName(e.target.value)} className="font-body" />
            <div className="flex gap-2 flex-wrap">
              {BUNDLE_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setBundleColor(c)}
                  className={cn("w-7 h-7 rounded-full transition-all", bundleColor === c ? "ring-2 ring-offset-2 ring-primary scale-110" : "opacity-60 hover:opacity-100")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={saveBundle} disabled={!bundleName.trim()} className="font-body">
              {bundleEditId ? <><Check size={14} className="mr-1" /> Sauver</> : <><Plus size={14} className="mr-1" /> Créer</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

// ── Salsa Tab — Move Card ──────────────────────────────────────────────────────

interface MoveCardPill {
  classKey: string;
  className: string;
  status: "done" | "next" | "planned";
}

type SalsaDialogData = {
  id?: string;
  type: SalsaType;
  title: string;
  description: string;
  videoUrl: string;
  linkUrl: string;
  topics: string[];
  status: SalsaStatus;
  difficulty: number;
  notes: string;
  customTopic: string;
};

function emptyDialogClean(type: SalsaType): SalsaDialogData {
  return { type, title: "", description: "", videoUrl: "", linkUrl: "", topics: [], status: "learning", difficulty: 0, notes: "", customTopic: "" };
}

function extractYouTubeId(url?: string): string | null {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function MoveCard({
  move, onEdit, onDelete, onMoveUp, onMoveDown, isFirst, isLast, classPills,
  videos, onDeleteVideo, onOpenVideo,
}: {
  move: SalsaMoveItem;
  onEdit: (m: SalsaMoveItem) => void;
  onDelete: (id: string) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  classPills?: MoveCardPill[];
  videos?: SalsaVideo[];
  onDeleteVideo?: (videoId: string) => void;
  onOpenVideo?: (src: string, title: string, trimStart?: number | null, trimEnd?: number | null) => void;
}) {
  const [expanded,    setExpanded]    = useState(false);
  const [deleteState, setDeleteState] = useState(false);
  const [activeVideoIdx, setActiveVideoIdx] = useState(0);


  const ytId = move.videoUrl ? extractYouTubeId(move.videoUrl) : null;
  const hasUploadedVideos = videos && videos.length > 0;
  const activeVideo = hasUploadedVideos ? videos[activeVideoIdx] : null;

  return (
    <div className="glass-card rounded-2xl overflow-hidden flex flex-col relative group" style={{ containerType: 'inline-size' }}>
      {/* Video thumbnail - click to open lightbox (max square) */}
      {activeVideo ? (
        <div
          className="relative bg-black cursor-pointer overflow-hidden"
          style={{ maxHeight: '100cqi' }}
          onClick={() => onOpenVideo?.(getVideoUrl(activeVideo.id), move.title, activeVideo.trimStart, activeVideo.trimEnd)}
        >
          <video
            src={getVideoUrl(activeVideo.id)}
            className="w-full object-cover opacity-80"
            preload="metadata"
            muted
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={20} className="text-white ml-0.5" />
            </div>
          </div>
          {/* Video switcher dots */}
          {videos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm z-10">
              {videos.map((v, i) => (
                <button
                  key={v.id}
                  onClick={(e) => { e.stopPropagation(); setActiveVideoIdx(i); }}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === activeVideoIdx ? "bg-primary scale-125" : "bg-white/40 hover:bg-white/70",
                  )}
                />
              ))}
            </div>
          )}
        </div>
      ) : ytId ? (
        <div
          className="relative bg-black cursor-pointer overflow-hidden"
          style={{ maxHeight: '100cqi' }}
          onClick={() => onOpenVideo?.(`youtube:${ytId}`, move.title)}
        >
          <img
            src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`}
            alt={move.title}
            className="w-full object-cover opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
              <Play size={20} className="text-white ml-0.5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-violet-50 to-purple-100 dark:from-violet-950 dark:to-purple-900 flex items-center justify-center" style={{ maxHeight: '100cqi' }}>
          <Music2 size={32} className="text-violet-300 dark:text-violet-600" />
        </div>
      )}

      {/* Reorder arrows (cours only, hover) */}
      {(onMoveUp || onMoveDown) && (
        <div className="absolute top-2 left-2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className={cn("p-1 rounded bg-black/40 text-white hover:bg-black/60 transition-colors", isFirst && "opacity-30 cursor-default")}
          >
            <ArrowUp size={11} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className={cn("p-1 rounded bg-black/40 text-white hover:bg-black/60 transition-colors", isLast && "opacity-30 cursor-default")}
          >
            <ArrowDown size={11} />
          </button>
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-start gap-2">
          <h3 className="font-body font-semibold text-sm leading-snug flex-1">{move.title}</h3>
          {hasUploadedVideos && (
            <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0 mt-0.5">
              {(videos.reduce((s, v) => s + v.fileSize, 0) / (1024 * 1024)).toFixed(1)} Mo
            </span>
          )}
        </div>

        {move.difficulty > 0 && (
          <StarRating value={move.difficulty} />
        )}

        {move.topics.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {move.topics.map(t => (
              <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-body">{t}</span>
            ))}
          </div>
        )}

        {move.description && (
          <div>
            <p className={cn("text-xs text-muted-foreground font-body leading-relaxed", !expanded && "line-clamp-2")}>
              {move.description}
            </p>
            {move.description.length > 100 && (
              <button onClick={() => setExpanded(v => !v)} className="text-xs text-primary mt-0.5 flex items-center gap-0.5">
                {expanded ? <><ChevronUp size={12} /> Réduire</> : <><ChevronDown size={12} /> Voir plus</>}
              </button>
            )}
          </div>
        )}

        {move.notes && (
          <p className="text-xs italic text-muted-foreground/70 font-body border-l-2 border-border pl-2">{move.notes}</p>
        )}

        {/* Class pills */}
        {classPills && classPills.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {classPills.map(pill => (
              <span key={pill.classKey} className={cn(
                "text-xs px-2 py-0.5 rounded-full font-body",
                pill.status === "done"    ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                pill.status === "next"    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" :
                "bg-secondary text-muted-foreground"
              )}>
                {pill.status === "done" ? "✓" : pill.status === "next" ? "⚡" : "○"} {pill.className}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-auto pt-2">
          {move.linkUrl && (
            <a href={move.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary flex items-center gap-1 hover:underline">
              <ExternalLink size={11} /> Lien
            </a>
          )}
          <div className="ml-auto flex gap-1.5">
            <button onClick={() => onEdit(move)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
              <Pencil size={13} />
            </button>
            {deleteState ? (
              <>
                <Button size="sm" variant="destructive" className="h-7 text-xs px-2" onClick={() => onDelete(move.id)}>Oui</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setDeleteState(false)}>Non</Button>
              </>
            ) : (
              <button onClick={() => setDeleteState(true)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Rhythm Reference Panel ────────────────────────────────────────────────────

function RhythmReferencePanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <span className="text-base">🥁</span>
        <span className="font-body font-medium text-sm">Rythmes</span>
        <span className="text-xs text-muted-foreground font-body ml-1">Rumba · Orishas</span>
        {open ? <ChevronUp size={15} className="ml-auto text-muted-foreground" /> : <ChevronDown size={15} className="ml-auto text-muted-foreground" />}
      </button>
      {open && (
        <div className="border-t border-border">
          <RhythmReference />
        </div>
      )}
    </div>
  );
}

// ── Salsa Share Panel ─────────────────────────────────────────────────────────

function SalsaSharePanel() {
  const { toast } = useToast();
  const [open,           setOpen]          = useState(false);
  const [access,         setAccess]        = useState<Record<SalsaType, SalsaAccessItem[]>>({ cours: [], figures: [], solo: [] });
  const [loaded,         setLoaded]        = useState(false);
  const [newEmail,       setNewEmail]      = useState<Record<SalsaType, string>>({ cours: "", figures: "", solo: "" });
  const [adding,         setAdding]        = useState<SalsaType | null>(null);
  const [copied,         setCopied]        = useState<SalsaType | null>(null);
  // Playlists (figures & solo)
  const [adminPlaylists, setAdminPlaylists] = useState<Record<"figures"|"solo", Playlist[]>>({ figures: [], solo: [] });
  const [newPlName,      setNewPlName]     = useState<Record<"figures"|"solo", string>>({ figures: "", solo: "" });
  const [creatingPl,     setCreatingPl]    = useState<"figures"|"solo"|null>(null);
  const [togglingPl,     setTogglingPl]    = useState<string | null>(null);

  async function loadAll() {
    if (loaded) return;
    try {
      const [cours, figures, solo, figPl, soloPl] = await Promise.all([
        listAccess("cours"), listAccess("figures"), listAccess("solo"),
        listAllPlaylists("figures"), listAllPlaylists("solo"),
      ]);
      setAccess({ cours, figures, solo });
      setAdminPlaylists({ figures: figPl, solo: soloPl });
      setLoaded(true);
    } catch {}
  }

  async function handleCreatePlaylist(type: "figures"|"solo") {
    const name = newPlName[type].trim();
    if (!name) return;
    setCreatingPl(type);
    try {
      const pl = await createPlaylist({ type, email: "admin", name, isShared: false });
      setAdminPlaylists(prev => ({ ...prev, [type]: [...prev[type], pl] }));
      setNewPlName(prev => ({ ...prev, [type]: "" }));
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer la playlist.", variant: "destructive" });
    } finally { setCreatingPl(null); }
  }

  async function handleToggleShared(pl: Playlist) {
    setTogglingPl(pl.id);
    try {
      const updated = await updatePlaylist(pl.id, { isShared: !pl.isShared });
      const t = pl.type as "figures"|"solo";
      setAdminPlaylists(prev => ({ ...prev, [t]: prev[t].map(p => p.id === pl.id ? updated : p) }));
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally { setTogglingPl(null); }
  }

  async function handleDeletePlaylist(pl: Playlist) {
    const t = pl.type as "figures"|"solo";
    setAdminPlaylists(prev => ({ ...prev, [t]: prev[t].filter(p => p.id !== pl.id) }));
    try { await deletePlaylist(pl.id); } catch {}
  }

  function handleToggle() {
    if (!open) { loadAll(); }
    setOpen(o => !o);
  }

  async function handleAdd(type: SalsaType) {
    const email = newEmail[type].trim();
    if (!email) return;
    setAdding(type);
    try {
      const item = await addAccess(type, email);
      setAccess(prev => ({
        ...prev,
        [type]: prev[type].some(a => a.id === item.id) ? prev[type] : [...prev[type], item],
      }));
      // When adding "figures" access, also grant "solo" access (combined URL)
      if (type === "figures") {
        try {
          const soloItem = await addAccess("solo", email);
          setAccess(prev => ({
            ...prev,
            solo: prev.solo.some(a => a.id === soloItem.id) ? prev.solo : [...prev.solo, soloItem],
          }));
        } catch {}
      }
      setNewEmail(prev => ({ ...prev, [type]: "" }));
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ajouter l'accès.", variant: "destructive" });
    }
    setAdding(null);
  }

  async function handleRemove(type: SalsaType, id: string) {
    // Find the email to also remove solo access when removing figures
    const entry = access[type].find(a => a.id === id);
    setAccess(prev => ({ ...prev, [type]: prev[type].filter(a => a.id !== id) }));
    try { await removeAccess(id); } catch {}
    if (type === "figures" && entry) {
      const soloEntry = access.solo.find(a => a.email === entry.email);
      if (soloEntry) {
        setAccess(prev => ({ ...prev, solo: prev.solo.filter(a => a.id !== soloEntry.id) }));
        try { await removeAccess(soloEntry.id); } catch {}
      }
    }
  }

  function copyUrl(type: SalsaType) {
    const url = `https://kojima-solutions.ch/salsa/${type}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(t => t === type ? null : t), 2000);
    });
  }

  const SHARE_SECTIONS: { type: SalsaType; label: string; url: string }[] = [
    { type: "cours",   label: "Programme de cours", url: "https://kojima-solutions.ch/salsa/cours" },
    { type: "figures", label: "Figures & Solo",     url: "https://kojima-solutions.ch/salsa/figures" },
  ];

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-secondary/30 transition-colors"
      >
        <Link2 size={15} className="text-muted-foreground" />
        <span className="font-body font-medium text-sm">🔗 Partage & Accès</span>
        {open ? <ChevronUp size={15} className="ml-auto text-muted-foreground" /> : <ChevronDown size={15} className="ml-auto text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-6 border-t border-border pt-4">
          {SHARE_SECTIONS.map(({ type, label, url }) => (
            <div key={type} className="space-y-2">
              <h4 className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-wider">
                {label}
              </h4>
              {/* Shareable URL */}
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-secondary px-2.5 py-1.5 rounded-lg overflow-x-auto font-mono text-muted-foreground whitespace-nowrap">
                  {url}
                </code>
                <button
                  onClick={() => copyUrl(type)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"
                  title="Copier l'URL"
                >
                  {copied === type ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
              {/* Authorized emails */}
              <div className="flex flex-wrap gap-1.5 min-h-6">
                {access[type].length === 0 && (
                  <span className="text-xs text-muted-foreground/50 italic">Aucun accès configuré</span>
                )}
                {access[type].map(a => (
                  <span key={a.id} className="inline-flex items-center gap-1 text-xs bg-secondary text-foreground px-2.5 py-1 rounded-full font-body">
                    {a.email}
                    <button onClick={() => handleRemove(type, a.id)} className="hover:text-destructive ml-0.5 transition-colors">
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
              {/* Add email */}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@exemple.com"
                  value={newEmail[type]}
                  onChange={e => setNewEmail(prev => ({ ...prev, [type]: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleAdd(type)}
                  className="h-8 text-xs font-body"
                />
                <Button
                  size="sm" variant="outline"
                  className="h-8 text-xs shrink-0"
                  onClick={() => handleAdd(type)}
                  disabled={adding === type || !newEmail[type].trim()}
                >
                  {adding === type ? <Loader2 size={12} className="animate-spin" /> : "Ajouter"}
                </Button>
              </div>

              {/* Playlists (figures section shows both figures & solo playlists) */}
              {type === "figures" && (
                <div className="pt-2 border-t border-border space-y-2">
                  <p className="text-xs font-body text-muted-foreground font-semibold">🔖 Playlists</p>
                  {(["figures", "solo"] as const).map(plType => {
                    const pls = adminPlaylists[plType];
                    return pls.map(pl => (
                      <div key={pl.id} className="flex items-center gap-2 text-xs font-body">
                        <span className="text-muted-foreground/50">{plType === "figures" ? "F" : "S"}</span>
                        <span className="flex-1 break-words min-w-0">{pl.name}
                          <span className="ml-1 text-muted-foreground/50">({pl.items.length})</span>
                        </span>
                        <button
                          onClick={() => handleToggleShared(pl)}
                          disabled={togglingPl === pl.id}
                          title={pl.isShared ? "Visible par tous (cliquer pour retirer)" : "Privée (cliquer pour partager)"}
                          className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                            pl.isShared
                              ? "bg-violet-100 text-violet-700 border-violet-300"
                              : "text-muted-foreground border-border hover:border-violet-300"
                          }`}
                        >
                          {pl.isShared ? "📌 Partagée" : "Privée"}
                        </button>
                        <button onClick={() => handleDeletePlaylist(pl)}
                          className="text-muted-foreground hover:text-destructive transition-colors">
                          <X size={11} />
                        </button>
                      </div>
                    ));
                  })}
                  {adminPlaylists.figures.length === 0 && adminPlaylists.solo.length === 0 && (
                    <p className="text-xs text-muted-foreground/50 italic">Aucune playlist.</p>
                  )}
                  {(["figures", "solo"] as const).map(plType => (
                    <div key={plType} className="flex gap-2">
                      <Input
                        placeholder={`Playlist ${plType === "figures" ? "figures" : "solo"}...`}
                        value={newPlName[plType]}
                        onChange={e => setNewPlName(prev => ({ ...prev, [plType]: e.target.value }))}
                        onKeyDown={e => e.key === "Enter" && handleCreatePlaylist(plType)}
                        className="h-7 text-xs font-body"
                      />
                      <Button size="sm" variant="outline" className="h-7 text-xs shrink-0"
                        onClick={() => handleCreatePlaylist(plType)}
                        disabled={creatingPl === plType || !newPlName[plType].trim()}>
                        {creatingPl === plType ? <Loader2 size={11} className="animate-spin" /> : <Plus size={12} />}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Class Tracker ─────────────────────────────────────────────────────────────

type ClassKey = "class_1" | "class_2";


function ClassTracker({
  coursMoves, allProgress, classNames, onProgressChange, onClassNamesChange,
}: {
  coursMoves: SalsaMoveItem[];
  allProgress: Record<string, ClassProgressItem[]>;
  classNames: Record<string, string>;
  onProgressChange: (classKey: string, items: ClassProgressItem[]) => void;
  onClassNamesChange: (names: Record<string, string>) => void;
}) {
  function handleRename(classKey: string, name: string) {
    const updated = { ...classNames, [classKey]: name };
    onClassNamesChange(updated);
    localStorage.setItem("kojima-class-names", JSON.stringify(updated));
  }

  return (
    <div>
      <h3 className="font-body font-semibold text-base mb-4 flex items-center gap-2">
        📊 Suivi des classes
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(["class_1", "class_2"] as ClassKey[]).map(key => (
          <ClassColumn
            key={key}
            classKey={key}
            className={classNames[key] || (key === "class_1" ? "Classe 1" : "Classe 2")}
            coursMoves={coursMoves}
            progress={allProgress[key] || []}
            onProgressChange={items => onProgressChange(key, items)}
            onRename={name => handleRename(key, name)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Salsa Tab ─────────────────────────────────────────────────────────────────

function SalsaTab() {
  const [salsaType,    setSalsaType]    = useState<SalsaType>("figures");
  const [moves,        setMoves]        = useState<SalsaMoveItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [search,       setSearch]       = useState("");
  const [topicFilter,  setTopicFilter]  = useState("all");

  const [dialogOpen,   setDialogOpen]   = useState(false);
  const [form,         setForm]         = useState<SalsaDialogData>(emptyDialogClean("figures"));
  const [saving,       setSaving]       = useState(false);

  // Video state
  const [videoFile,    setVideoFile]    = useState<File | null>(null);
  const [uploading,    setUploading]    = useState(false);
  const [compressMsg,  setCompressMsg]  = useState<string | null>(null);
  const [moveVideos,   setMoveVideos]   = useState<Record<string, SalsaVideo[]>>({});

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ src: string; title: string; trimStart?: number | null; trimEnd?: number | null } | null>(null);

  // Class tracker state
  const [allProgress, setAllProgress] = useState<Record<string, ClassProgressItem[]>>({ class_1: [], class_2: [] });
  const [classNames,  setClassNames]  = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem("kojima-class-names") || "{}"); } catch { return {}; }
  });

  // Load videos for all moves
  async function loadAllVideos(allMoves: SalsaMoveItem[]) {
    const videoMap: Record<string, SalsaVideo[]> = {};
    await Promise.all(
      allMoves.map(async m => {
        try {
          const vids = await listVideos(m.id);
          if (vids.length > 0) videoMap[m.id] = vids;
        } catch {}
      })
    );
    setMoveVideos(videoMap);
  }

  useEffect(() => {
    listMoves()
      .then(allMoves => {
        setMoves(allMoves);
        loadAllVideos(allMoves);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    Promise.all([listProgress("class_1"), listProgress("class_2")])
      .then(([p1, p2]) => setAllProgress({ class_1: p1, class_2: p2 }))
      .catch(() => {});
  }, []);

  const currentMoves = useMemo(() => {
    return moves
      .filter(m => m.type === salsaType)
      .filter(m => !search || m.title.toLowerCase().includes(search.toLowerCase()) || m.description?.toLowerCase().includes(search.toLowerCase()))
      .filter(m => topicFilter === "all" || m.topics.includes(topicFilter))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }, [moves, salsaType, search, topicFilter]);

  const allTopics = useMemo(() => {
    const set = new Set<string>();
    moves.filter(m => m.type === salsaType).forEach(m => m.topics.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [moves, salsaType]);


  const allSuggestedTopics = useMemo(() => {
    const extra = moves.flatMap(m => m.topics);
    return Array.from(new Set([...SALSA_DEFAULT_TOPICS, ...extra])).sort();
  }, [moves]);

  function openAdd() { setForm(emptyDialogClean(salsaType)); setVideoFile(null); setDialogOpen(true); }
  function openEdit(m: SalsaMoveItem) {
    setForm({
      id: m.id, type: m.type, title: m.title,
      description: m.description ?? "", videoUrl: m.videoUrl ?? "",
      linkUrl: m.linkUrl ?? "", topics: [...m.topics],
      status: m.status, difficulty: m.difficulty ?? 0, notes: m.notes ?? "", customTopic: "",
    });
    setVideoFile(null);
    setDialogOpen(true);
  }

  const { toast } = useToast();

  async function save() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        type: form.type, title: form.title.trim(),
        description: form.description.trim() || undefined,
        videoUrl:    form.videoUrl.trim() || undefined,
        linkUrl:     form.linkUrl.trim() || undefined,
        topics:      form.topics,
        status:      form.status,
        difficulty:  form.difficulty,
        notes:       form.notes.trim() || undefined,
        sortOrder:   form.id ? (moves.find(m => m.id === form.id)?.sortOrder ?? 0) : moves.length,
      };
      let moveId: string;
      if (form.id) {
        const updated = await updateMove(form.id, payload);
        setMoves(prev => prev.map(m => m.id === form.id ? updated : m));
        moveId = form.id;
      } else {
        const created = await createMove(payload);
        setMoves(prev => [...prev, created]);
        moveId = created.id;
      }

      // Upload video if selected
      if (videoFile) {
        setUploading(true);
        try {
          let fileToUpload = videoFile;

          // Compress large videos (>50 MB) or transcode non-browser formats (.mov etc.)
          const { needsCompression, compressVideo } = await import('@/lib/videoCompress');
          if (needsCompression(fileToUpload)) {
            setCompressMsg("Compression en cours... 0%");
            fileToUpload = await compressVideo(fileToUpload, (p) => {
              if (p.phase === 'loading') {
                setCompressMsg("Chargement de la video...");
              } else if (p.phase === 'compressing') {
                setCompressMsg(`Compression en cours... ${p.percent}%`);
              } else if (p.phase === 'done') {
                setCompressMsg(null);
              }
            });
            setCompressMsg(null);
          } else {
            setCompressMsg("Upload direct (pas de compression)...");
          }

          const vid = await uploadVideo(moveId, fileToUpload);
          setMoveVideos(prev => ({
            ...prev,
            [moveId]: [...(prev[moveId] || []), vid],
          }));
          const sizeMB = (fileToUpload.size / (1024 * 1024)).toFixed(1);
          toast({ title: `Video uploaded (${sizeMB} Mo)` });
        } catch (e: any) {
          setCompressMsg(null);
          toast({ title: "Erreur upload video", description: e.message, variant: "destructive" });
        }
        setUploading(false);
      }

      setVideoFile(null);
      setDialogOpen(false);
    } catch {}
    setSaving(false);
  }

  async function handleDeleteVideo(videoId: string) {
    try {
      await deleteVideo(videoId);
      setMoveVideos(prev => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          updated[key] = updated[key].filter(v => v.id !== videoId);
          if (updated[key].length === 0) delete updated[key];
        }
        return updated;
      });
    } catch {}
  }

  async function remove(id: string) {
    setMoves(prev => prev.filter(m => m.id !== id));
    try { await deleteMove(id); } catch {}
  }

  async function moveUp(id: string) {
    const sorted = moves.filter(m => m.type === "cours").sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(m => m.id === id);
    if (idx <= 0) return;
    const prev = sorted[idx - 1], curr = sorted[idx];
    setMoves(ms => ms.map(m =>
      m.id === curr.id ? { ...m, sortOrder: prev.sortOrder } :
      m.id === prev.id ? { ...m, sortOrder: curr.sortOrder } : m
    ));
    try {
      await Promise.all([
        updateMove(curr.id, { sortOrder: prev.sortOrder }),
        updateMove(prev.id, { sortOrder: curr.sortOrder }),
      ]);
    } catch {}
  }

  async function moveDown(id: string) {
    const sorted = moves.filter(m => m.type === "cours").sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(m => m.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const next = sorted[idx + 1], curr = sorted[idx];
    setMoves(ms => ms.map(m =>
      m.id === curr.id ? { ...m, sortOrder: next.sortOrder } :
      m.id === next.id ? { ...m, sortOrder: curr.sortOrder } : m
    ));
    try {
      await Promise.all([
        updateMove(curr.id, { sortOrder: next.sortOrder }),
        updateMove(next.id, { sortOrder: curr.sortOrder }),
      ]);
    } catch {}
  }

  function getClassPills(moveId: string): MoveCardPill[] {
    return (["class_1", "class_2"] as ClassKey[]).flatMap(key => {
      const p = allProgress[key]?.find(p => p.moveId === moveId);
      if (!p) return [];
      return [{ classKey: key, className: classNames[key] || (key === "class_1" ? "Classe 1" : "Classe 2"), status: p.status }];
    });
  }

  function toggleTopic(topic: string) {
    setForm(f => ({
      ...f,
      topics: f.topics.includes(topic) ? f.topics.filter(t => t !== topic) : [...f.topics, topic],
    }));
  }

  function addCustomTopic() {
    const t = form.customTopic.trim();
    if (!t || form.topics.includes(t)) return;
    setForm(f => ({ ...f, topics: [...f.topics, t], customTopic: "" }));
  }

  const coursMoves = useMemo(
    () => moves.filter(m => m.type === "cours").sort((a, b) => a.sortOrder - b.sortOrder),
    [moves]
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Sub-type switcher */}
      <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl w-fit">
        {(["cours", "figures", "solo"] as SalsaType[]).map(t => (
          <button
            key={t}
            onClick={() => { setSalsaType(t); setSearch(""); setTopicFilter("all"); }}
            className={cn(
              "px-4 py-1.5 rounded-lg text-sm font-body transition-all",
              salsaType === t ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {SALSA_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Choreography editor (cours only, at the very top) */}
      {salsaType === "cours" && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <h2 className="font-display text-sm font-bold text-foreground">Choregraphie</h2>
          <ChoreographyEditor />
        </div>
      )}

      {/* Class tracker (cours only) */}
      {salsaType === "cours" && (
        <div className="pt-2 border-t border-border">
          <ClassTracker
            coursMoves={coursMoves}
            allProgress={allProgress}
            classNames={classNames}
            onProgressChange={(key, items) => setAllProgress(prev => ({ ...prev, [key]: items }))}
            onClassNamesChange={setClassNames}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 font-body h-9"
          />
        </div>
        <Select value={topicFilter} onValueChange={setTopicFilter}>
          <SelectTrigger className="w-44 font-body h-9 text-xs"><SelectValue placeholder="Tous les topics" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les topics</SelectItem>
            {allTopics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={openAdd} className="h-9"><Plus size={14} className="mr-1" /> Ajouter</Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : currentMoves.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm font-body">
          {moves.filter(m => m.type === salsaType).length === 0
            ? "Aucune figure pour cette section. Ajoutez-en une !"
            : "Aucun résultat pour ces filtres."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {currentMoves.map((m, idx) => (
            <MoveCard
              key={m.id}
              move={m}
              onEdit={openEdit}
              onDelete={remove}
              onMoveUp={salsaType === "cours" ? () => moveUp(m.id) : undefined}
              onMoveDown={salsaType === "cours" ? () => moveDown(m.id) : undefined}
              isFirst={salsaType === "cours" && idx === 0}
              isLast={salsaType === "cours" && idx === currentMoves.length - 1}
              classPills={salsaType === "cours" ? getClassPills(m.id) : undefined}
              videos={moveVideos[m.id]}
              onDeleteVideo={handleDeleteVideo}
              onOpenVideo={(src, title, ts, te) => setLightbox({ src, title, trimStart: ts, trimEnd: te })}
            />
          ))}
        </div>
      )}



      {/* Rhythm Reference */}
      <RhythmReferencePanel />

      {/* Sharing panel */}
      <SalsaSharePanel />

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto font-body">
          <DialogHeader>
            <DialogTitle>{form.id ? "Modifier la figure" : "Nouvelle figure"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Titre *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as SalsaType }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cours">Programme de cours</SelectItem>
                  <SelectItem value="figures">Figures</SelectItem>
                  <SelectItem value="solo">Solo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Topics</p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {allSuggestedTopics.map(t => (
                  <button
                    key={t}
                    onClick={() => toggleTopic(t)}
                    className={cn(
                      "text-xs px-2.5 py-1 rounded-full border transition-all font-body",
                      form.topics.includes(t)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ajouter un topic…"
                  value={form.customTopic}
                  onChange={e => setForm(f => ({ ...f, customTopic: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && addCustomTopic()}
                  className="text-xs h-8"
                />
                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addCustomTopic}>+</Button>
              </div>
            </div>
            <Textarea
              placeholder="Description (optionnel)"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
            />
            <Input placeholder="URL YouTube (optionnel)" value={form.videoUrl} onChange={e => setForm(f => ({ ...f, videoUrl: e.target.value }))} />
            <Input placeholder="Lien externe (optionnel)" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} />

            {/* Video upload */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-body">Video (max 150 Mo)</p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors flex-1">
                  <Upload size={14} className="text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-body truncate">
                    {videoFile ? videoFile.name : "Choisir une video..."}
                  </span>
                  <input
                    type="file"
                    accept="video/*"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0];
                      if (f) {
                        if (f.size > 150 * 1024 * 1024) {
                          toast({ title: "Fichier trop volumineux", description: "Maximum 150 Mo", variant: "destructive" });
                          return;
                        }
                        setVideoFile(f);
                      }
                    }}
                  />
                </label>
                {videoFile && (
                  <button onClick={() => {
                    setVideoFile(null);
                  }} className="p-1.5 rounded text-muted-foreground hover:text-destructive">
                    <X size={14} />
                  </button>
                )}
              </div>
              {videoFile && (
                <p className="text-[10px] text-muted-foreground font-body">
                  {(videoFile.size / (1024 * 1024)).toFixed(1)} Mo
                </p>
              )}
              {compressMsg && (
                <p className="text-[10px] text-primary font-body font-medium animate-pulse">{compressMsg}</p>
              )}
              {/* Show existing videos */}
              {form.id && moveVideos[form.id]?.length > 0 && (
                <div className="pt-1">
                  <p className="text-[10px] text-muted-foreground font-body mb-1">Vidéos existantes :</p>
                  {moveVideos[form.id].map(v => (
                    <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground font-body">
                      <Video size={11} />
                      <span className="truncate flex-1">{v.originalName}</span>
                      <span className="text-[10px]">{(v.fileSize / (1024 * 1024)).toFixed(1)} Mo</span>
                      <button
                        onClick={() => handleDeleteVideo(v.id)}
                        className="p-0.5 rounded text-muted-foreground hover:text-destructive transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-body">Difficulté</p>
              <StarRating value={form.difficulty} onChange={v => setForm(f => ({ ...f, difficulty: v }))} size="md" />
            </div>
            <Textarea
              placeholder="Notes personnelles (optionnel)"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={saving || uploading || !form.title.trim()}>
              {(saving || uploading) ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              {uploading ? "Upload…" : form.id ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Video lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
            onClick={() => setLightbox(null)}
          >
            <X size={24} />
          </button>
          <div
            className="w-full max-w-4xl max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            {lightbox.src.startsWith("youtube:") ? (
              <div className="aspect-video w-full">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${lightbox.src.replace("youtube:", "")}?autoplay=1`}
                  className="w-full h-full rounded-xl"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                />
              </div>
            ) : (
              <VideoPlayer src={lightbox.src} title={lightbox.title} trimStart={lightbox.trimStart} trimEnd={lightbox.trimEnd} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Personal() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Espace<span className="text-primary">.</span>Personnel
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">Budget, trésorerie et salsa.</p>
        </div>

        <Tabs defaultValue="budget">
          <div className="overflow-x-auto mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="font-body w-max">
              <TabsTrigger value="budget" className="text-xs sm:text-sm">Budget</TabsTrigger>
              <TabsTrigger value="tresorerie" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Wallet size={13} /> Trésorerie
              </TabsTrigger>
              <TabsTrigger value="salsa"  className="text-xs sm:text-sm flex items-center gap-1.5">
                <Music2 size={13} /> Salsa
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="budget"><BudgetTab /></TabsContent>
          <TabsContent value="tresorerie"><TresorerieTab /></TabsContent>
          <TabsContent value="salsa"><SalsaTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
