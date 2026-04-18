import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
  Search, ChevronDown, ChevronUp, Loader2, Sun,
  X, Check, Zap, RefreshCw, Calendar,
  Target, ShoppingCart, Package, Wallet,
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
  listPersonalTodos, createPersonalTodo,
  updatePersonalTodo, deletePersonalTodo,
} from "@/api/personalTodos";
import type { PersonalTodoItem } from "@/api/personalTodos";
import {
  listSubtasks, createSubtask, updateSubtask, deleteSubtask, batchCompleteSubtasks,
} from "@/api/todoSubtasks";
import type { SubtaskItem } from "@/api/todoSubtasks";

// Each personal-page row carries a hidden source tag so writes go to the right table.
// New items always go to personal_todos; legacy admin_todos rows with category="Perso"
// remain editable in place until they're naturally completed/deleted.
type DualObjective = ObjectiveItem & { __source: "admin" | "personal" };

function personalToObjective(p: PersonalTodoItem): DualObjective {
  return {
    id: p.id,
    text: p.text,
    completed: p.completed,
    category: "Perso",
    dueDate: p.dueDate,
    recurring: (p.recurring ?? null) as ObjectiveItem["recurring"],
    isObjective: p.isObjective,
    description: p.description ?? null,
    smartSpecific: p.smartSpecific ?? null,
    smartMeasurable: p.smartMeasurable ?? null,
    smartAchievable: p.smartAchievable ?? null,
    smartRelevant: p.smartRelevant ?? null,
    priority: p.priority,
    status: p.status,
    definitionOfDone: p.definitionOfDone ?? null,
    linkedProjectId: p.linkedProjectId ?? null,
    linkedClientId: p.linkedClientId ?? null,
    order: p.order,
    createdAt: p.createdAt,
    __source: "personal",
  };
}
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
  FREQUENCY_MONTHLY_FACTOR, FREQUENCY_DAYS, FREQUENCY_LABELS,
  type CostFrequency,
} from "@/types/personalCost";

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
  const navigate = useNavigate();
  const [todos,         setTodos]         = useState<DualObjective[]>(() => {
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
      listPersonalTodos(),
      listSubtasks(undefined, "admin"),
      listSubtasks(undefined, "personal"),
    ]).then(([adminItems, personalItems, adminSubs, personalSubs]) => {
      const merged: DualObjective[] = [
        ...adminItems.map(o => ({ ...o, __source: "admin" as const })),
        ...personalItems.map(personalToObjective),
      ];
      setTodos(merged);
      setCompletedOpen(merged.filter(t => t.completed).length <= 3);
      localStorage.setItem("kojima-personal-todos", JSON.stringify(merged));
      const subs = [...adminSubs, ...personalSubs];
      const map: Record<string, SubtaskItem[]> = {};
      for (const s of subs) (map[s.parentId] ??= []).push(s);
      setSubtasksMap(map);
      localStorage.setItem("kojima-personal-subtasks", JSON.stringify(subs));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function sync(updated: DualObjective[]) {
    setTodos(updated);
    localStorage.setItem("kojima-personal-todos", JSON.stringify(updated));
  }

  function sourceOf(id: string): "admin" | "personal" {
    return todos.find(t => t.id === id)?.__source ?? "personal";
  }

  function dispatchUpdate(id: string, data: Partial<ObjectiveItem>) {
    if (sourceOf(id) === "admin") return updateObjective(id, data);
    return updatePersonalTodo(id, data as any);
  }

  function dispatchDelete(id: string) {
    if (sourceOf(id) === "admin") return deleteObjective(id);
    return deletePersonalTodo(id);
  }

  async function addTodo() {
    const text = newText.trim();
    if (!text) return;
    const isObjective = newIsObj;
    setNewText(""); setNewDue(""); setNewRecurring(""); setNewIsObj(false);
    try {
      const item = await createPersonalTodo({
        text,
        dueDate:   newDue       || undefined,
        recurring: newRecurring || undefined,
        isObjective,
      });
      sync([...todos, personalToObjective(item)]);
    } catch {
      const fake: DualObjective = {
        id: crypto.randomUUID(), text, completed: false, category: "Perso", order: todos.length,
        dueDate: newDue || undefined, recurring: (newRecurring as TodoRecurring) || undefined,
        isObjective,
        priority: "medium", status: "not_started",
        createdAt: new Date().toISOString(),
        __source: "personal",
      };
      sync([...todos, fake]);
    }
  }

  async function toggle(id: string) {
    const todo = todos.find(t => t.id === id)!;
    const willComplete = !todo.completed;
    const updated = todos.map(t => t.id === id ? { ...t, completed: willComplete } : t);
    sync(updated);
    try { await dispatchUpdate(id, { completed: willComplete }); } catch {}

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

    // Spawn next occurrence for recurring todos — always create the next one in personal_todos
    if (willComplete && todo.recurring) {
      const nextDue = nextRecurringDate(todo.dueDate, todo.recurring);
      try {
        const next = await createPersonalTodo({ text: todo.text, dueDate: nextDue, recurring: todo.recurring as TodoRecurring });
        sync([...updated, personalToObjective(next)]);
      } catch {}
    }
  }

  async function remove(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    sync(todos.filter(t => t.id !== id));
    setSubtasksMap(prev => { const n = { ...prev }; delete n[id]; return n; });
    setDeleteId(null);
    try { await dispatchDelete(id); } catch {}
  }

  async function swapOrder(idA: string, idB: string) {
    const a = todos.find(t => t.id === idA);
    const b = todos.find(t => t.id === idB);
    if (!a || !b) return;
    setTodos(prev => prev.map(t => t.id === idA ? { ...t, order: b.order } : t.id === idB ? { ...t, order: a.order } : t));
    try { await dispatchUpdate(idA, { order: b.order }); await dispatchUpdate(idB, { order: a.order }); } catch {}
  }

  async function promote(id: string) {
    const updated = todos.map(t => t.id === id ? { ...t, isObjective: true } : t);
    sync(updated);
    try { await dispatchUpdate(id, { isObjective: true }); } catch {}
  }

  async function saveDescription(id: string, desc: string) {
    const updated = todos.map(t => t.id === id ? { ...t, description: desc || null } : t);
    sync(updated);
    try { await dispatchUpdate(id, { description: desc || undefined }); } catch {}
  }

  async function saveSmartField(id: string, field: string, value: string) {
    if (field === "timebound") {
      const updated = todos.map(t => t.id === id ? { ...t, dueDate: value || undefined } : t);
      sync(updated);
      try { await dispatchUpdate(id, { dueDate: value || undefined }); } catch {}
      return;
    }
    const updated = todos.map(t => t.id === id ? { ...t, [field]: value || null } : t);
    sync(updated);
    try { await dispatchUpdate(id, { [field]: value || undefined } as any); } catch {}
  }

  async function savePriority(id: string, priority: any) {
    const updated = todos.map(t => t.id === id ? { ...t, priority } : t);
    sync(updated);
    try { await dispatchUpdate(id, { priority }); } catch {}
  }

  async function saveStatus(id: string, status: any) {
    const updated = todos.map(t => t.id === id ? { ...t, status } : t);
    sync(updated);
    try { await dispatchUpdate(id, { status }); } catch {}
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
      const sub = await createSubtask({ parentId, text, dueDate, source: sourceOf(parentId) });
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
                  onTitleSave={async (title) => { if (title) { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, text: title } : t)); try { await dispatchUpdate(todo.id, { text: title }); } catch {} } }}
                  onCategoryChange={async (c) => { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, category: c } : t)); try { await dispatchUpdate(todo.id, { category: c }); } catch {} }}
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
                  onOpenWorkspace={() => navigate(`/objective/${todo.__source}/${todo.id}`, { state: { from: "/personal" } })}
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
                  onTitleSave={async (title) => { if (title) { setTodos(prev => prev.map(t => t.id === todo.id ? { ...t, text: title } : t)); try { await dispatchUpdate(todo.id, { text: title }); } catch {} } }}
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
                    onOpenWorkspace={() => navigate(`/objective/admin/${t.id}`, { state: { from: "/personal" } })}
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Personal() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Espace<span className="text-primary">.</span>Personnel
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">Budget et trésorerie.</p>
        </div>

        <Tabs defaultValue="budget">
          <div className="overflow-x-auto mb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="font-body w-max">
              <TabsTrigger value="budget" className="text-xs sm:text-sm">Budget</TabsTrigger>
              <TabsTrigger value="tresorerie" className="text-xs sm:text-sm flex items-center gap-1.5">
                <Wallet size={13} /> Trésorerie
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="budget"><BudgetTab /></TabsContent>
          <TabsContent value="tresorerie"><TresorerieTab /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
