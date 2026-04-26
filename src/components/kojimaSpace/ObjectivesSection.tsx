import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Target, LayoutList, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useObjectives, useCreateObjective, useUpdateObjective, useDeleteObjective,
} from "@/hooks/useObjectives";
import {
  useAllSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask, useBatchCompleteSubtasks,
} from "@/hooks/useSubtasks";
import { ALL_CATEGORIES, getCategoryColor } from "@/lib/objectiveCategories";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { ObjectiveSource, UnifiedObjective } from "@/api/objectiveSource";
import { FocusDuJour } from "./FocusDuJour";
import { CategorizedObjectives, type ObjectiveActions } from "./CategorizedObjectives";
import { AddObjectiveForm } from "./AddObjectiveForm";

export function ObjectivesSection() {
  const { data: todos = [] } = useObjectives();
  const { data: allSubtasks = [] } = useAllSubtasks();
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

  const [todoDeleteId, setTodoDeleteId] = useState<string | null>(null);

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

  function handleAdd(text: string, isObjective: boolean, category: string) {
    createObjectiveMut.mutate({ source: 'admin', data: { text, category, isObjective } });
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

  function updateTodo(source: ObjectiveSource, id: string, patch: Partial<UnifiedObjective>) {
    updateObjectiveMut.mutate({ source, id, patch });
  }

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

  const actions: ObjectiveActions = {
    onToggleTodo: toggleTodo,
    onDeleteTodo: deleteTodo,
    onSwapOrder: swapObjectiveOrder,
    onUpdateTodo: updateTodo,
    onSubtaskToggle: handleSubtaskToggle,
    onSubtaskAdd: handleSubtaskAdd,
    onSubtaskDelete: handleSubtaskDelete,
    onSubtaskUpdate: handleSubtaskUpdate,
  };

  const usedCatsForChips = [...new Set(todos.map(t => t.category).filter((c): c is string => !!c))];
  const orderedCatsForChips = [...ALL_CATEGORIES].filter(c => usedCatsForChips.includes(c));
  usedCatsForChips.forEach(c => {
    if (!orderedCatsForChips.includes(c as typeof ALL_CATEGORIES[number])) {
      orderedCatsForChips.push(c as typeof ALL_CATEGORIES[number]);
    }
  });
  const showChips = orderedCatsForChips.length > 1;
  const anyHidden = orderedCatsForChips.some(c => hiddenCats.has(c));

  return (
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

      {showChips && (
        <div className="flex items-center gap-1.5 px-5 py-2 border-b border-border overflow-x-auto no-scrollbar">
          <span className="text-[10px] font-body text-muted-foreground shrink-0 uppercase tracking-wider">Filtrer</span>
          {orderedCatsForChips.map(cat => {
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
      )}

      <div className="p-5">
        <FocusDuJour
          subtasksMap={subtasksMap}
          todos={todos}
          hiddenCats={hiddenCats}
          onToggleSubtask={handleSubtaskToggle}
          onUnflagSubtask={(parentId, subId) => handleSubtaskUpdate(parentId, subId, { flaggedToday: false } as Partial<SubtaskItem>)}
        />

        <CategorizedObjectives
          todos={todos}
          subtasksMap={subtasksMap}
          hiddenCats={hiddenCats}
          compactView={compactView}
          todoDeleteId={todoDeleteId}
          setTodoDeleteId={setTodoDeleteId}
          actions={actions}
        />

        <AddObjectiveForm onAdd={handleAdd} />
      </div>
    </motion.section>
  );
}
