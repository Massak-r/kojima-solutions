import { useState } from "react";
import { Circle, CheckCircle2, Trash2, Plus, Calendar, ChevronRight, ChevronUp, ChevronDown, Pencil, AlertTriangle, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { SmartFields } from "./SmartFields";
import { STATUS_CONFIG, PRIORITY_BORDER } from "@/lib/objectiveConstants";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { TodoPriority, TodoStatus } from "@/api/objectives";

interface SubtaskListProps {
  subtasks: SubtaskItem[];
  onToggle:  (id: string) => void;
  onAdd:     (text: string, dueDate?: string) => void;
  onDelete:  (id: string) => void;
  onUpdate?: (id: string, data: Partial<SubtaskItem>) => void;
}

export function SubtaskList({ subtasks, onToggle, onAdd, onDelete, onUpdate }: SubtaskListProps) {
  const [newText,   setNewText]   = useState("");
  const [newDue,    setNewDue]    = useState("");
  const [deleteId,  setDeleteId]  = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function handleAdd() {
    const text = newText.trim();
    if (!text) return;
    onAdd(text, newDue || undefined);
    setNewText("");
    setNewDue("");
  }

  function handleDelete(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    onDelete(id);
    setDeleteId(null);
  }

  const completedSubs = subtasks.filter(s => s.completed);
  const pendingSubs   = subtasks.filter(s => !s.completed);
  const sorted = [...pendingSubs, ...completedSubs];

  function swapOrder(idA: string, idB: string) {
    if (!onUpdate) return;
    const a = subtasks.find(s => s.id === idA);
    const b = subtasks.find(s => s.id === idB);
    if (!a || !b) return;
    onUpdate(idA, { order: b.order } as any);
    onUpdate(idB, { order: a.order } as any);
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {sorted.map((sub, i) => (
          <SubtaskCard
            key={sub.id}
            sub={sub}
            index={i}
            today={today}
            deleteId={deleteId}
            onToggle={onToggle}
            onDelete={handleDelete}
            onCancelDelete={() => setDeleteId(null)}
            onUpdate={onUpdate}
            onMoveUp={i > 0 && !sub.completed && !pendingSubs[i - 1]?.completed ? () => swapOrder(sub.id, sorted[i - 1].id) : undefined}
            onMoveDown={i < pendingSubs.length - 1 && !sub.completed ? () => swapOrder(sub.id, sorted[i + 1].id) : undefined}
          />
        ))}
      </AnimatePresence>

      {/* Add subtask */}
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-secondary/20 border border-dashed border-border/30">
        <Plus size={16} className="text-muted-foreground/30 shrink-0" />
        <input
          type="text"
          placeholder="Ajouter une étape SMART..."
          value={newText}
          onChange={e => setNewText(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          className="flex-1 text-sm font-body bg-transparent border-none px-0 py-1 focus:outline-none placeholder:text-muted-foreground/30"
        />
        <div className="flex items-center gap-1.5 shrink-0">
          <Calendar size={13} className="text-muted-foreground/30" />
          <input
            type="date"
            value={newDue}
            onChange={e => setNewDue(e.target.value)}
            className="bg-transparent text-xs font-body text-muted-foreground/50 w-[100px] focus:outline-none"
          />
        </div>
        {newText.trim() && (
          <Button size="sm" variant="default" className="h-7 px-3 text-xs rounded-lg shrink-0" onClick={handleAdd}>
            Ajouter
          </Button>
        )}
      </div>
    </div>
  );
}

function SubtaskCard({
  sub, index, today, deleteId, onToggle, onDelete, onCancelDelete, onUpdate, onMoveUp, onMoveDown,
}: {
  sub: SubtaskItem;
  index: number;
  today: string;
  deleteId: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onUpdate?: (id: string, data: Partial<SubtaskItem>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [expanded, setExpanded]     = useState(false);
  const [editDesc, setEditDesc]     = useState(false);
  const [descDraft, setDescDraft]   = useState(sub.description || "");
  const [editTitle, setEditTitle]   = useState(false);
  const [titleDraft, setTitleDraft] = useState(sub.text);

  const isOverdue = !!sub.dueDate && !sub.completed && sub.dueDate < today;
  const isDueSoon = !!sub.dueDate && !sub.completed && !isOverdue && sub.dueDate <= (() => {
    const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10);
  })();

  const statusCfg = STATUS_CONFIG[(sub as any).status || "not_started"];
  const priority = (sub as any).priority || "medium";

  function saveField(field: string, value: any) {
    if (!onUpdate) return;
    if (field === "timebound") {
      onUpdate(sub.id, { dueDate: value || undefined });
    } else {
      onUpdate(sub.id, { [field]: value || null } as any);
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className={cn(
        "rounded-xl border border-l-[3px] transition-all",
        PRIORITY_BORDER[priority],
        expanded
          ? "bg-white/60 dark:bg-white/[0.03] border-border/50 shadow-sm"
          : "bg-white/30 dark:bg-white/[0.02] border-transparent hover:border-border/30 hover:bg-white/50",
        isOverdue && "bg-red-50/30 border-red-200/50",
        sub.completed && "opacity-40",
      )}
    >
      {/* Main row */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer group"
        onClick={() => setExpanded(o => !o)}
      >
        <button
          onClick={e => { e.stopPropagation(); onToggle(sub.id); }}
          className={cn(
            "shrink-0 transition-all",
            sub.completed ? "text-emerald-500" : "text-muted-foreground/60 hover:text-primary hover:scale-110",
          )}
        >
          {sub.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {editTitle ? (
              <input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { onUpdate?.(sub.id, { text: titleDraft.trim() } as any); setEditTitle(false); }
                  if (e.key === "Escape") { setTitleDraft(sub.text); setEditTitle(false); }
                }}
                onBlur={() => { onUpdate?.(sub.id, { text: titleDraft.trim() } as any); setEditTitle(false); }}
                autoFocus
                onClick={e => e.stopPropagation()}
                className="text-sm font-body font-medium text-foreground bg-secondary/50 border border-border/50 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
              />
            ) : (
              <span
                className={cn(
                  "text-sm font-body font-medium group/stitle inline items-center gap-1 break-words",
                  sub.completed && "line-through text-muted-foreground",
                )}
              >
                {sub.text}
                {onUpdate && !sub.completed && (
                  <Pencil
                    size={11}
                    className="inline ml-1 opacity-0 group-hover/stitle:opacity-50 hover:!opacity-100 transition-opacity cursor-pointer text-muted-foreground align-middle"
                    onClick={e => { e.stopPropagation(); setTitleDraft(sub.text); setEditTitle(true); }}
                  />
                )}
              </span>
            )}
            {(sub as any).status && (sub as any).status !== "not_started" && (
              <span className={cn("text-[10px] font-body font-bold px-2 py-0.5 rounded-full shrink-0", statusCfg.bg, statusCfg.text)}>
                {statusCfg.label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 mt-1">
            {sub.dueDate && (
              <span className={cn(
                "text-[10px] font-mono font-body tabular-nums",
                isOverdue ? "text-destructive font-bold" : isDueSoon ? "text-amber-600 font-semibold" : "text-muted-foreground",
              )}>
                {isOverdue && <AlertTriangle className="w-2.5 h-2.5 inline mr-0.5" />}
                {sub.dueDate.slice(5)}
              </span>
            )}
          </div>
        </div>

        {/* Right-side actions — collapsed until hover to save space */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Flagged star — always visible when active */}
          {onUpdate && (sub as any).flaggedToday && (
            <button
              onClick={e => { e.stopPropagation(); onUpdate(sub.id, { flaggedToday: false } as any); }}
              className="text-amber-500 hover:text-amber-400 transition-all"
              title="Retirer du focus"
            >
              <Star size={14} className="fill-current" />
            </button>
          )}

          {/* Hover-only actions */}
          <div className="hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {/* Reorder */}
            {(onMoveUp || onMoveDown) && !sub.completed && (
              <div className="flex flex-col">
                {onMoveUp && <button onClick={onMoveUp} className="text-muted-foreground hover:text-foreground p-0.5"><ChevronUp size={12} /></button>}
                {onMoveDown && <button onClick={onMoveDown} className="text-muted-foreground hover:text-foreground p-0.5"><ChevronDown size={12} /></button>}
              </div>
            )}

            {/* Flag for daily focus (when not flagged) */}
            {onUpdate && !(sub as any).flaggedToday && (
              <button
                onClick={e => { e.stopPropagation(); onUpdate(sub.id, { flaggedToday: true } as any); }}
                className="text-muted-foreground/30 hover:text-amber-400 transition-all"
                title="Ajouter au focus du jour"
              >
                <Star size={14} />
              </button>
            )}

            <button
              onClick={e => { e.stopPropagation(); onDelete(sub.id); }}
              className="text-muted-foreground hover:text-destructive transition-opacity"
            >
              <Trash2 size={13} />
            </button>
          </div>

          {/* Delete confirm (replaces hover actions) */}
          {deleteId === sub.id && (
            <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
              <Button size="sm" variant="destructive" className="h-6 px-1.5 text-[10px] rounded-md" onClick={() => onDelete(sub.id)}>Oui</Button>
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] rounded-md" onClick={onCancelDelete}>Non</Button>
            </div>
          )}

          <div className={cn("transition-transform duration-200 text-muted-foreground", expanded && "rotate-90")}>
            <ChevronRight size={14} />
          </div>
        </div>
      </div>

      {/* Expanded: SMART fields + description */}
      <AnimatePresence>
        {expanded && onUpdate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 pt-0">
              <div className="h-px bg-border/30 mb-2.5 mx-1" />

              {/* Status + Priority inline */}
              <div className="flex flex-wrap items-center gap-2 mb-2.5 ml-1">
                {(["not_started", "in_progress", "done", "blocked"] as TodoStatus[]).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={e => { e.stopPropagation(); saveField("status", s); }}
                      className={cn(
                        "text-[10px] font-body font-bold px-2 py-0.5 rounded-full transition-all",
                        (sub as any).status === s ? cn(cfg.bg, cfg.text) : "text-muted-foreground/25 hover:text-muted-foreground/50",
                      )}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
                <div className="w-px h-3 bg-border/20" />
                {(["low", "medium", "high"] as TodoPriority[]).map(p => (
                  <button
                    key={p}
                    onClick={e => { e.stopPropagation(); saveField("priority", p); }}
                    className={cn(
                      "text-[10px] font-body font-bold px-2 py-0.5 rounded-full transition-all",
                      priority === p
                        ? p === "high" ? "bg-red-100 text-red-700" : p === "medium" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                        : "text-muted-foreground/25 hover:text-muted-foreground/50",
                    )}
                  >
                    {p === "low" ? "Basse" : p === "medium" ? "Moyenne" : "Haute"}
                  </button>
                ))}
              </div>

              {/* SMART fields */}
              <SmartFields
                specific={(sub as any).smartSpecific}
                measurable={(sub as any).smartMeasurable}
                achievable={(sub as any).smartAchievable}
                relevant={(sub as any).smartRelevant}
                dueDate={sub.dueDate}
                onSave={(field, value) => saveField(field, value)}
              />

              {/* Description */}
              <div className="ml-1">
                {editDesc ? (
                  <div className="flex gap-1.5 items-start">
                    <textarea
                      value={descDraft}
                      onChange={e => setDescDraft(e.target.value)}
                      placeholder="Notes pour cette étape..."
                      className="flex-1 text-xs font-body bg-secondary/30 border border-border/30 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-primary/20 resize-none"
                      rows={2}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                    <button
                      onClick={() => { saveField("description", descDraft.trim()); setEditDesc(false); }}
                      className="text-[10px] font-body font-semibold text-primary px-1.5 py-1"
                    >
                      OK
                    </button>
                  </div>
                ) : (sub as any).description ? (
                  <button
                    onClick={e => { e.stopPropagation(); setDescDraft((sub as any).description); setEditDesc(true); }}
                    className="flex items-start gap-1.5 text-xs text-muted-foreground/60 font-body hover:text-muted-foreground transition-colors w-full text-left group/desc"
                  >
                    <span className="leading-relaxed">{(sub as any).description}</span>
                    <Pencil size={10} className="opacity-0 group-hover/desc:opacity-50 transition-opacity mt-0.5 shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setDescDraft(""); setEditDesc(true); }}
                    className="text-[11px] text-muted-foreground/25 hover:text-muted-foreground/40 font-body italic transition-colors"
                  >
                    + Notes...
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
