import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Calendar, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SubtaskCard } from "./SubtaskCard";
import type { SubtaskItem } from "@/api/todoSubtasks";

interface SubtaskListProps {
  subtasks: SubtaskItem[];
  onToggle:  (id: string) => void;
  /** parentSubtaskId = null → top-level; otherwise sub-subtask under that parent */
  onAdd:     (text: string, dueDate: string | undefined, parentSubtaskId: string | null) => void;
  onDelete:  (id: string) => void;
  onUpdate?: (id: string, data: Partial<SubtaskItem>) => void;
  hideAddInput?: boolean;
  /** map of subtaskId → actual minutes spent (computed from sessions) */
  actualsMap?: Record<string, number>;
}

export function SubtaskList({ subtasks, onToggle, onAdd, onDelete, onUpdate, hideAddInput, actualsMap }: SubtaskListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  function handleDelete(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    onDelete(id);
    setDeleteId(null);
  }

  // Group subtasks into top-level + children map
  const { topLevel, childrenByParent } = useMemo(() => {
    const top: SubtaskItem[] = [];
    const byParent: Record<string, SubtaskItem[]> = {};
    for (const s of subtasks) {
      if (s.parentSubtaskId) (byParent[s.parentSubtaskId] ??= []).push(s);
      else top.push(s);
    }
    const sortFn = (a: SubtaskItem, b: SubtaskItem) => a.order - b.order;
    top.sort(sortFn);
    for (const k of Object.keys(byParent)) byParent[k].sort(sortFn);
    return { topLevel: top, childrenByParent: byParent };
  }, [subtasks]);

  const pendingTop   = topLevel.filter(s => !s.completed);
  const completedTop = topLevel.filter(s => s.completed);
  const sortedTop    = [...pendingTop, ...completedTop];

  // Drag-to-reorder sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function reorderWithin(items: SubtaskItem[], fromId: string, toId: string) {
    if (!onUpdate || fromId === toId) return;
    const fromIdx = items.findIndex(i => i.id === fromId);
    const toIdx   = items.findIndex(i => i.id === toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...items];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    next.forEach((s, i) => {
      if (s.order !== i) onUpdate(s.id, { order: i });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const activeId = e.active.id as string;
    const overId   = e.over?.id as string | undefined;
    if (!overId || activeId === overId) return;

    // Reorder within same level (same parentSubtaskId)
    const activeSub = subtasks.find(s => s.id === activeId);
    const overSub   = subtasks.find(s => s.id === overId);
    if (!activeSub || !overSub) return;
    if ((activeSub.parentSubtaskId ?? null) !== (overSub.parentSubtaskId ?? null)) return;

    if (activeSub.parentSubtaskId) {
      reorderWithin(childrenByParent[activeSub.parentSubtaskId] ?? [], activeId, overId);
    } else {
      reorderWithin(pendingTop, activeId, overId);
    }
  }

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sortedTop.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <AnimatePresence>
            {sortedTop.map((sub, i) => {
              const kids = childrenByParent[sub.id] || [];
              // Parent's actual time rollup: its own + children's
              const ownActual = actualsMap?.[sub.id] ?? 0;
              const kidsActual = kids.reduce((sum, k) => sum + (actualsMap?.[k.id] ?? 0), 0);
              const rollup = ownActual + kidsActual;
              return (
                <SubtaskTreeEntry
                  key={sub.id}
                  sub={sub}
                  kids={kids}
                  index={i}
                  today={today}
                  deleteId={deleteId}
                  actualMinutesOwn={rollup > 0 ? rollup : undefined}
                  actualsMap={actualsMap}
                  onToggle={onToggle}
                  onDelete={handleDelete}
                  onCancelDelete={() => setDeleteId(null)}
                  onUpdate={onUpdate}
                  onAddChild={(text, due) => onAdd(text, due, sub.id)}
                />
              );
            })}
          </AnimatePresence>
        </SortableContext>
      </DndContext>

      {!hideAddInput && <AddInput level="top" onAdd={(text, due) => onAdd(text, due, null)} />}
    </div>
  );
}

function SubtaskTreeEntry({
  sub, kids, index, today, deleteId,
  actualMinutesOwn,
  actualsMap,
  onToggle, onDelete, onCancelDelete, onUpdate, onAddChild,
}: {
  sub: SubtaskItem;
  kids: SubtaskItem[];
  index: number;
  today: string;
  deleteId: string | null;
  actualMinutesOwn?: number;
  actualsMap?: Record<string, number>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onUpdate?: (id: string, data: Partial<SubtaskItem>) => void;
  onAddChild: (text: string, dueDate?: string) => void;
}) {
  const [addingChild, setAddingChild] = useState(false);
  const hasKids      = kids.length > 0;
  const completedKids = kids.filter(k => k.completed).length;

  const sortable = useSortable({ id: sub.id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div ref={sortable.setNodeRef} style={style}>
      <SubtaskCard
        sub={sub}
        variant="parent"
        index={index}
        today={today}
        deleteId={deleteId}
        childrenProgress={hasKids ? { completed: completedKids, total: kids.length } : undefined}
        actualMinutes={actualMinutesOwn}
        onToggle={onToggle}
        onDelete={onDelete}
        onCancelDelete={onCancelDelete}
        onUpdate={onUpdate}
        onDecompose={!hasKids && !sub.completed ? () => setAddingChild(true) : undefined}
        dragHandleProps={sortable.listeners}
        dragHandleRef={sortable.setActivatorNodeRef}
        isDragging={sortable.isDragging}
      />

      {(hasKids || addingChild) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.18 }}
          className="overflow-hidden"
        >
          <div className={cn(
            "ml-5 sm:ml-7 mt-1.5 pl-3 border-l-2 space-y-1.5 py-1",
            sub.completed ? "border-border/10" : "border-border/25",
          )}>
            <ChildrenGroup
              parentId={sub.id}
              kids={kids}
              today={today}
              deleteId={deleteId}
              actualsMap={actualsMap}
              onToggle={onToggle}
              onDelete={onDelete}
              onCancelDelete={onCancelDelete}
              onUpdate={onUpdate}
            />
            {addingChild ? (
              <AddInput
                level="child"
                autoFocus
                onAdd={(text, due) => onAddChild(text, due)}
                onClose={() => setAddingChild(false)}
              />
            ) : (
              <button
                onClick={() => setAddingChild(true)}
                className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors px-3 py-1"
              >
                <Plus size={11} /> Ajouter une sous-étape
              </button>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}

function ChildrenGroup({
  parentId, kids, today, deleteId, actualsMap,
  onToggle, onDelete, onCancelDelete, onUpdate,
}: {
  parentId: string;
  kids: SubtaskItem[];
  today: string;
  deleteId: string | null;
  actualsMap?: Record<string, number>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onUpdate?: (id: string, data: Partial<SubtaskItem>) => void;
}) {
  const pending = kids.filter(k => !k.completed);
  const done    = kids.filter(k => k.completed);
  const ordered = [...pending, ...done];
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function onDragEnd(e: DragEndEvent) {
    if (!onUpdate) return;
    const activeId = e.active.id as string;
    const overId   = e.over?.id as string | undefined;
    if (!overId || activeId === overId) return;
    const fromIdx = pending.findIndex(k => k.id === activeId);
    const toIdx   = pending.findIndex(k => k.id === overId);
    if (fromIdx === -1 || toIdx === -1) return;
    const next = [...pending];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    next.forEach((s, i) => { if (s.order !== i) onUpdate(s.id, { order: i }); });
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ordered.map(k => k.id)} strategy={verticalListSortingStrategy}>
        {ordered.map((kid, ki) => (
          <ChildDraggable
            key={kid.id}
            sub={kid}
            index={ki}
            today={today}
            deleteId={deleteId}
            actualMinutes={actualsMap?.[kid.id]}
            onToggle={onToggle}
            onDelete={onDelete}
            onCancelDelete={onCancelDelete}
            onUpdate={onUpdate}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function ChildDraggable(props: {
  sub: SubtaskItem;
  index: number;
  today: string;
  deleteId: string | null;
  actualMinutes?: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onUpdate?: (id: string, data: Partial<SubtaskItem>) => void;
}) {
  const sortable = useSortable({ id: props.sub.id });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };
  return (
    <div ref={sortable.setNodeRef} style={style}>
      <SubtaskCard
        sub={props.sub}
        variant="child"
        index={props.index}
        today={props.today}
        deleteId={props.deleteId}
        actualMinutes={props.actualMinutes}
        onToggle={props.onToggle}
        onDelete={props.onDelete}
        onCancelDelete={props.onCancelDelete}
        onUpdate={props.onUpdate}
        dragHandleProps={sortable.listeners}
        dragHandleRef={sortable.setActivatorNodeRef}
        isDragging={sortable.isDragging}
      />
    </div>
  );
}

function AddInput({
  level, onAdd, autoFocus, onClose,
}: {
  level: "top" | "child";
  onAdd: (text: string, due?: string) => void;
  autoFocus?: boolean;
  onClose?: () => void;
}) {
  const [text, setText] = useState("");
  const [due,  setDue]  = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (autoFocus) inputRef.current?.focus(); }, [autoFocus]);

  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t, due || undefined);
    setText(""); setDue("");
    inputRef.current?.focus();
  }

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-xl border border-dashed transition-all",
      level === "top"
        ? "bg-secondary/20 border-border/30 px-3 py-2"
        : "bg-secondary/10 border-border/20 px-2.5 py-1.5",
    )}>
      <Plus size={12} className="text-muted-foreground/30 shrink-0" />
      <input
        ref={inputRef}
        type="text"
        placeholder={level === "top" ? "Ajouter une étape…" : "Ajouter une sous-étape…"}
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape" && !text && onClose) onClose();
        }}
        className={cn(
          "flex-1 font-body bg-transparent border-none px-0 py-0.5 focus:outline-none placeholder:text-muted-foreground/30",
          level === "top" ? "text-sm" : "text-xs",
        )}
      />
      <div className="flex items-center gap-1 shrink-0">
        <Calendar size={10} className="text-muted-foreground/30" />
        <input
          type="date"
          value={due}
          onChange={e => setDue(e.target.value)}
          className={cn(
            "bg-transparent font-body text-muted-foreground/60 focus:outline-none",
            level === "top" ? "text-xs w-[100px]" : "text-[10px] w-[95px]",
          )}
        />
      </div>
      {text.trim() && (
        <Button size="sm" variant="default" className="h-6 px-2 text-[10px] rounded-lg shrink-0" onClick={submit}>
          <CornerDownLeft size={10} />
        </Button>
      )}
    </div>
  );
}
