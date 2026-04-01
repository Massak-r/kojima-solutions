import { useState } from "react";
import { Circle, CheckCircle2, Trash2, ChevronRight, Pencil, Target, AlertTriangle, ChevronUp, ChevronDown, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ObjectiveProgress } from "./ObjectiveProgress";
import { SubtaskList } from "./SubtaskList";
import { STATUS_CONFIG, PRIORITY_BORDER } from "@/lib/objectiveConstants";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { TodoPriority, TodoStatus } from "@/api/objectives";

interface ObjectiveRowProps {
  id:          string;
  text:        string;
  completed:   boolean;
  description?: string | null;
  dueDate?:    string;
  isOverdue:   boolean;
  isDueSoon:   boolean;
  subtasks:    SubtaskItem[];
  priority:    TodoPriority;
  status:      TodoStatus;
  /** If true, render as a lightweight card (no subtasks section, no progress) */
  isSimpleTodo?: boolean;
  smartSpecific?:   string | null;
  smartMeasurable?: string | null;
  smartAchievable?: string | null;
  smartRelevant?:   string | null;
  recurringLabel?: string;
  categoryBadge?:  string;
  parentCategory?: string;
  categoryOptions?: string[];
  onToggle:           () => void;
  onDelete:           () => void;
  onTitleSave?:       (title: string) => void;
  onCategoryChange?:  (cat: string) => void;
  onMoveUp?:          () => void;
  onMoveDown?:        () => void;
  onDescriptionSave:  (desc: string) => void;
  onSmartSave:        (field: string, value: string) => void;
  onPriorityChange:   (p: TodoPriority) => void;
  onStatusChange:     (s: TodoStatus) => void;
  onSubtaskToggle:    (id: string) => void;
  onSubtaskAdd:       (text: string, dueDate?: string) => void;
  onSubtaskDelete:    (id: string) => void;
  onSubtaskUpdate?:   (id: string, data: any) => void;
  deleteConfirming:   boolean;
  onDeleteConfirm:    () => void;
  onDeleteCancel:     () => void;
}

export function ObjectiveRow({
  id, text, completed, description, dueDate,
  isOverdue, isDueSoon, subtasks,
  priority, status, isSimpleTodo,
  smartSpecific, smartMeasurable, smartAchievable, smartRelevant,
  recurringLabel, categoryBadge, parentCategory, categoryOptions,
  onToggle, onDelete, onTitleSave, onCategoryChange, onMoveUp, onMoveDown,
  onDescriptionSave, onSmartSave, onPriorityChange, onStatusChange,
  onSubtaskToggle, onSubtaskAdd, onSubtaskDelete, onSubtaskUpdate,
  deleteConfirming, onDeleteConfirm, onDeleteCancel,
}: ObjectiveRowProps) {
  const [expanded, setExpanded]     = useState(false);
  const [editDesc, setEditDesc]     = useState(false);
  const [descDraft, setDescDraft]   = useState(description || "");
  const [editTitle, setEditTitle]   = useState(false);
  const [titleDraft, setTitleDraft] = useState(text);

  const completedCount = subtasks.filter(s => s.completed).length;
  const totalCount     = subtasks.length;
  const statusCfg      = STATUS_CONFIG[status];
  const pendingSubtasks = subtasks.filter(s => !s.completed);
  const previewSubtasks = pendingSubtasks.slice(0, 3);
  const hasFlagged = subtasks.some(s => (s as any).flaggedToday && !s.completed);

  function saveDesc() {
    onDescriptionSave(descDraft.trim());
    setEditDesc(false);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "rounded-2xl transition-all border border-l-4 shadow-sm",
        PRIORITY_BORDER[priority],
        expanded
          ? "bg-white/80 dark:bg-white/[0.05] border-border/70 shadow-md"
          : "bg-white/50 dark:bg-white/[0.03] border-border/30 hover:border-border/50 hover:bg-white/70 hover:shadow-md",
        isOverdue && !completed && "border-red-300 bg-red-50/40",
        hasFlagged && !completed && "ring-1 ring-amber-300/40 bg-amber-50/20",
        completed && "opacity-45",
      )}
    >
      {/* Main row */}
      <div
        className="flex items-start sm:items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 cursor-pointer group"
        onClick={() => setExpanded(o => !o)}
      >
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          className={cn(
            "shrink-0 transition-all",
            completed ? "text-emerald-500" : "text-muted-foreground/60 hover:text-primary hover:scale-110",
          )}
        >
          {completed ? <CheckCircle2 size={22} /> : <Circle size={22} />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div>
            <div className="flex items-start gap-1.5">
              {!isSimpleTodo && <Target size={15} className="text-primary shrink-0 mt-0.5" />}
              {editTitle ? (
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") { onTitleSave?.(titleDraft.trim()); setEditTitle(false); }
                    if (e.key === "Escape") { setTitleDraft(text); setEditTitle(false); }
                  }}
                  onBlur={() => { onTitleSave?.(titleDraft.trim()); setEditTitle(false); }}
                  autoFocus
                  onClick={e => e.stopPropagation()}
                  className="text-sm sm:text-base font-display font-semibold text-foreground bg-secondary/50 border border-border/50 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full"
                />
              ) : (
                <span
                  className={cn(
                    "text-sm sm:text-base font-display font-semibold text-foreground group/title inline break-words",
                    completed && "line-through opacity-60",
                  )}
                >
                  {text}
                  {onTitleSave && !completed && (
                    <Pencil
                      size={12}
                      className="inline ml-1 align-middle opacity-0 group-hover/title:opacity-50 hover:!opacity-100 transition-opacity cursor-pointer text-muted-foreground"
                      onClick={e => { e.stopPropagation(); setTitleDraft(text); setEditTitle(true); }}
                    />
                  )}
                </span>
              )}
            </div>
            {/* Badges row */}
            {(status !== "not_started" || (categoryBadge && categoryBadge !== parentCategory)) && (
              <div className="flex items-center gap-1.5 mt-1 ml-5">
                {status !== "not_started" && (
                  <span className={cn("text-[10px] font-body font-bold px-2 py-0.5 rounded-full", statusCfg.bg, statusCfg.text)}>
                    {statusCfg.label}
                  </span>
                )}
                {categoryBadge && categoryBadge !== parentCategory && (
                  <span className="text-[10px] bg-primary/10 text-primary font-semibold rounded-full px-2.5 py-0.5 font-body">{categoryBadge}</span>
                )}
              </div>
            )}
          </div>

          {/* Progress + meta row */}
          {!isSimpleTodo && (
            <div className="flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-2 flex-wrap">
              {totalCount > 0 ? (
                <ObjectiveProgress completed={completedCount} total={totalCount} className="min-w-[80px] max-w-[300px]" />
              ) : !completed ? (
                <span className="text-xs text-muted-foreground font-body">Aucune étape</span>
              ) : null}

              {dueDate && (
                <span className={cn(
                  "text-xs font-mono font-body tabular-nums",
                  isOverdue && !completed ? "text-destructive font-bold" : isDueSoon && !completed ? "text-amber-600 font-semibold" : "text-muted-foreground",
                )}>
                  {isOverdue && !completed ? <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" /> : ""}{dueDate}
                </span>
              )}
              {recurringLabel && (
                <span className="text-xs text-muted-foreground font-body">{recurringLabel}</span>
              )}
            </div>
          )}
          {/* Simple todo: just show due date inline */}
          {isSimpleTodo && dueDate && (
            <div className="flex items-center gap-2 mt-1">
              <span className={cn(
                "text-xs font-mono font-body tabular-nums",
                isOverdue && !completed ? "text-destructive font-bold" : isDueSoon && !completed ? "text-amber-600 font-semibold" : "text-muted-foreground",
              )}>
                {isOverdue && !completed ? <AlertTriangle className="w-3.5 h-3.5 inline mr-0.5" /> : ""}{dueDate}
              </span>
            </div>
          )}

          {/* Inline subtask preview (visible without expanding) */}
          {!isSimpleTodo && !expanded && !completed && previewSubtasks.length > 0 && (
            <div className="mt-2 space-y-0.5 ml-0.5">
              {previewSubtasks.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 group/sub">
                  <button
                    onClick={e => { e.stopPropagation(); onSubtaskToggle(sub.id); }}
                    className="shrink-0 text-muted-foreground/40 hover:text-primary hover:scale-110 transition-all"
                  >
                    <Circle size={13} />
                  </button>
                  <span className="text-xs font-body text-foreground/70 truncate">
                    {(sub as any).flaggedToday && <Sun size={10} className="inline mr-1 text-amber-500" />}
                    {sub.text}
                  </span>
                </div>
              ))}
              {pendingSubtasks.length > 3 && (
                <span className="text-[10px] text-muted-foreground/50 font-body ml-5">
                  ... et {pendingSubtasks.length - 3} autre{pendingSubtasks.length - 3 > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Reorder */}
        {(onMoveUp || onMoveDown) && !completed && (
          <div className="flex flex-col opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
            {onMoveUp && <button onClick={onMoveUp} className="text-muted-foreground hover:text-foreground p-0.5"><ChevronUp size={14} /></button>}
            {onMoveDown && <button onClick={onMoveDown} className="text-muted-foreground hover:text-foreground p-0.5"><ChevronDown size={14} /></button>}
          </div>
        )}

        {/* Expand indicator (hidden for simple todos) */}
        {!isSimpleTodo && (
          <div className={cn(
            "transition-transform duration-200 text-muted-foreground shrink-0",
            expanded && "rotate-90",
          )}>
            <ChevronRight size={18} />
          </div>
        )}

        {/* Delete */}
        {deleteConfirming ? (
          <div className="flex gap-1 sm:gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
            <Button size="sm" variant="destructive" className="h-7 sm:h-8 px-2 sm:px-3 text-[11px] sm:text-xs rounded-lg" onClick={onDeleteConfirm}>Supprimer</Button>
            <Button size="sm" variant="ghost" className="h-7 sm:h-8 px-2 sm:px-3 text-[11px] sm:text-xs rounded-lg" onClick={onDeleteCancel}>Annuler</Button>
          </div>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="opacity-40 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Expanded content (not for simple todos) */}
      <AnimatePresence>
        {expanded && !isSimpleTodo && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-3 sm:px-5 pb-4 sm:pb-5 pt-0">
              <div className="h-px bg-border/50 mb-4 mx-1" />

              {/* Description / notes */}
              <div className="mb-4 ml-1">
                {editDesc ? (
                  <div className="flex gap-2 items-start">
                    <textarea
                      value={descDraft}
                      onChange={e => setDescDraft(e.target.value)}
                      placeholder="Notes, contexte, critères de succès..."
                      className="flex-1 text-sm font-body bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-all"
                      rows={3}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                    />
                    <div className="flex flex-col gap-1">
                      <Button size="sm" variant="default" className="h-8 px-3 text-xs rounded-lg" onClick={saveDesc}>OK</Button>
                      <Button size="sm" variant="ghost" className="h-8 px-3 text-xs rounded-lg" onClick={() => { setEditDesc(false); setDescDraft(description || ""); }}>
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : description ? (
                  <button
                    onClick={e => { e.stopPropagation(); setEditDesc(true); }}
                    className="flex items-start gap-2 text-sm text-foreground/70 font-body transition-colors hover:text-foreground group/desc w-full text-left"
                  >
                    <span className="leading-relaxed">{description}</span>
                    <Pencil size={12} className="opacity-0 group-hover/desc:opacity-60 transition-opacity mt-0.5 shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setEditDesc(true); }}
                    className="text-sm text-muted-foreground/50 hover:text-muted-foreground font-body italic transition-colors"
                  >
                    + Ajouter des notes...
                  </button>
                )}
              </div>

              {/* Subtask section header */}
              <div className="flex items-center gap-2.5 mb-2.5 ml-1">
                <span className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
                  Étapes
                </span>
                {totalCount > 0 && (
                  <span className="text-xs font-mono text-muted-foreground font-semibold">
                    {completedCount}/{totalCount}
                  </span>
                )}
                <div className="flex-1 h-px bg-border/40" />
              </div>

              {/* Subtasks */}
              <SubtaskList
                subtasks={subtasks}
                onToggle={onSubtaskToggle}
                onAdd={onSubtaskAdd}
                onDelete={onSubtaskDelete}
                onUpdate={onSubtaskUpdate}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
