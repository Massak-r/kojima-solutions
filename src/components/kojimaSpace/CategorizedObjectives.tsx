import { ChevronRight, Circle, CheckCircle2, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { ObjectiveRow } from "@/components/todos/ObjectiveRow";
import { CategorySection } from "@/components/todos/CategorySection";
import { ALL_CATEGORIES, sortObjectives, getCategoryColor } from "@/lib/objectiveCategories";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { UnifiedObjective, ObjectiveSource } from "@/api/objectiveSource";
import { CompletedToggle } from "./CompletedToggle";
import { OBJECTIVE_STALE_DAYS, objectiveDaysSinceUpdate } from "./helpers";

export interface ObjectiveActions {
  onToggleTodo: (id: string) => void;
  onDeleteTodo: (id: string) => void;
  onSwapOrder: (idA: string, idB: string) => void;
  onUpdateTodo: (source: ObjectiveSource, id: string, patch: Partial<UnifiedObjective>) => void;
  onSubtaskToggle: (parentId: string, subId: string) => void;
  onSubtaskAdd: (parentId: string, text: string, dueDate?: string) => void;
  onSubtaskDelete: (parentId: string, subId: string) => void;
  onSubtaskUpdate: (parentId: string, subId: string, data: Partial<SubtaskItem>) => void;
}

interface CategorizedObjectivesProps {
  todos: UnifiedObjective[];
  subtasksMap: Record<string, SubtaskItem[]>;
  hiddenCats: Set<string>;
  compactView: boolean;
  todoDeleteId: string | null;
  setTodoDeleteId: (id: string | null) => void;
  actions: ObjectiveActions;
}

export function CategorizedObjectives({
  todos, subtasksMap, hiddenCats, compactView, todoDeleteId, setTodoDeleteId, actions,
}: CategorizedObjectivesProps) {
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);
  const dueSoon = (() => { const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10); })();
  const usedCats = [...new Set(todos.map(t => t.category))];
  const orderedCats = [...ALL_CATEGORIES].filter(c => usedCats.includes(c));
  usedCats.forEach(c => { if (!orderedCats.includes(c)) orderedCats.push(c); });

  if (orderedCats.length === 0) {
    return <p className="text-sm text-muted-foreground font-body py-4 text-center">Aucun objectif.</p>;
  }

  const visibleCats = orderedCats.filter(c => !hiddenCats.has(c));
  if (visibleCats.length === 0) {
    return <p className="text-sm text-muted-foreground font-body py-4 text-center">Toutes les catégories sont masquées.</p>;
  }

  return (
    <>
      {visibleCats.map(cat => {
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
                          onClick={() => actions.onToggleTodo(todo.id)}
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
                          onClick={() => actions.onToggleTodo(t.id)}
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
                  onToggle={() => actions.onToggleTodo(todo.id)}
                  onDelete={() => setTodoDeleteId(todo.id)}
                  onTitleSave={(title) => { if (title) actions.onUpdateTodo(todo.source, todo.id, { text: title }); }}
                  onCategoryChange={(c) => actions.onUpdateTodo(todo.source, todo.id, { category: c })}
                  onDescriptionSave={(desc) => actions.onUpdateTodo(todo.source, todo.id, { description: desc || null })}
                  onSmartSave={(field, value) => {
                    if (field === "timebound") {
                      actions.onUpdateTodo(todo.source, todo.id, { dueDate: value || null });
                    } else {
                      actions.onUpdateTodo(todo.source, todo.id, { [field]: value || null } as Partial<UnifiedObjective>);
                    }
                  }}
                  onPriorityChange={(p) => actions.onUpdateTodo(todo.source, todo.id, { priority: p })}
                  onStatusChange={(s) => actions.onUpdateTodo(todo.source, todo.id, { status: s })}
                  onSubtaskToggle={subId => actions.onSubtaskToggle(todo.id, subId)}
                  onSubtaskAdd={(text, due) => actions.onSubtaskAdd(todo.id, text, due)}
                  onSubtaskDelete={subId => actions.onSubtaskDelete(todo.id, subId)}
                  onSubtaskUpdate={(subId, data) => actions.onSubtaskUpdate(todo.id, subId, data)}
                  onMoveUp={idx > 0 ? () => actions.onSwapOrder(todo.id, active[idx - 1].id) : undefined}
                  onMoveDown={idx < active.length - 1 ? () => actions.onSwapOrder(todo.id, active[idx + 1].id) : undefined}
                  onOpenWorkspace={() => navigate(`/objective/${todo.source}/${todo.id}`, { state: { from: "/space" } })}
                  deleteConfirming={todoDeleteId === todo.id}
                  onDeleteConfirm={() => actions.onDeleteTodo(todo.id)}
                  onDeleteCancel={() => setTodoDeleteId(null)}
                />
              ) : (
                <ObjectiveRow
                  key={todo.id} id={todo.id} text={todo.text} completed={todo.completed}
                  dueDate={todo.dueDate} isOverdue={isOverdue} isDueSoon={isDueSoon}
                  subtasks={[]} priority={todo.priority || "medium"} status={todo.status || "not_started"}
                  isSimpleTodo
                  categoryBadge={todo.category} parentCategory={cat}
                  onToggle={() => actions.onToggleTodo(todo.id)}
                  onDelete={() => setTodoDeleteId(todo.id)}
                  onTitleSave={(title) => { if (title) actions.onUpdateTodo(todo.source, todo.id, { text: title }); }}
                  onDescriptionSave={() => {}} onSmartSave={() => {}} onPriorityChange={() => {}} onStatusChange={() => {}}
                  onSubtaskToggle={() => {}} onSubtaskAdd={() => {}} onSubtaskDelete={() => {}}
                  deleteConfirming={todoDeleteId === todo.id} onDeleteConfirm={() => actions.onDeleteTodo(todo.id)} onDeleteCancel={() => setTodoDeleteId(null)}
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
                    onToggle={() => actions.onToggleTodo(t.id)}
                    onDelete={() => actions.onDeleteTodo(t.id)}
                    onDescriptionSave={(desc) => actions.onUpdateTodo(t.source, t.id, { description: desc || null })}
                    onSmartSave={() => {}}
                    onPriorityChange={() => {}}
                    onStatusChange={() => {}}
                    onSubtaskToggle={subId => actions.onSubtaskToggle(t.id, subId)}
                    onSubtaskAdd={(text, due) => actions.onSubtaskAdd(t.id, text, due)}
                    onSubtaskDelete={subId => actions.onSubtaskDelete(t.id, subId)}
                    onOpenWorkspace={() => navigate(`/objective/${t.source}/${t.id}`, { state: { from: "/space" } })}
                    deleteConfirming={todoDeleteId === t.id}
                    onDeleteConfirm={() => actions.onDeleteTodo(t.id)}
                    onDeleteCancel={() => setTodoDeleteId(null)}
                  />
                ) : (
                  <ObjectiveRow
                    key={t.id} id={t.id} text={t.text} completed={true}
                    dueDate={t.dueDate} isOverdue={false} isDueSoon={false}
                    subtasks={[]} priority={t.priority || "medium"} status={t.status || "done"}
                    isSimpleTodo
                    categoryBadge={t.category} parentCategory={cat}
                    onToggle={() => actions.onToggleTodo(t.id)} onDelete={() => setTodoDeleteId(t.id)}
                    onDescriptionSave={() => {}} onSmartSave={() => {}} onPriorityChange={() => {}} onStatusChange={() => {}}
                    onSubtaskToggle={() => {}} onSubtaskAdd={() => {}} onSubtaskDelete={() => {}}
                    deleteConfirming={todoDeleteId === t.id} onDeleteConfirm={() => actions.onDeleteTodo(t.id)} onDeleteCancel={() => setTodoDeleteId(null)}
                  />
                ))}
              </CompletedToggle>
            )}
          </CategorySection>
        );
      })}
    </>
  );
}
