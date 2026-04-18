import { useState } from "react";
import {
  Circle, CheckCircle2, Trash2, ChevronRight, ChevronUp, ChevronDown,
  Pencil, AlertTriangle, Star, Zap, GripVertical, CornerDownRight, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { SmartFields } from "./SmartFields";
import { STATUS_CONFIG, PRIORITY_BORDER } from "@/lib/objectiveConstants";
import type { SubtaskItem, EffortSize } from "@/api/todoSubtasks";
import type { TodoPriority, TodoStatus } from "@/api/objectives";

export const EFFORT_CONFIG: Record<EffortSize, { label: string; short: string; bg: string; text: string; border: string }> = {
  rapide:   { label: "Rapide",   short: "R", bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-500/30" },
  moyen:    { label: "Moyen",    short: "M", bg: "bg-amber-100 dark:bg-amber-500/15",     text: "text-amber-700 dark:text-amber-300",     border: "border-amber-500/30"   },
  complexe: { label: "Complexe", short: "C", bg: "bg-rose-100 dark:bg-rose-500/15",       text: "text-rose-700 dark:text-rose-300",       border: "border-rose-500/30"    },
};

const EFFORT_CYCLE: (EffortSize | null)[] = [null, "rapide", "moyen", "complexe"];
function nextEffort(current: EffortSize | null | undefined): EffortSize | null {
  const idx = EFFORT_CYCLE.indexOf(current ?? null);
  return EFFORT_CYCLE[(idx + 1) % EFFORT_CYCLE.length];
}

export const ESTIMATE_PRESETS: { value: number; label: string }[] = [
  { value: 5,   label: "5min" },
  { value: 15,  label: "15min" },
  { value: 30,  label: "30min" },
  { value: 60,  label: "1h" },
  { value: 120, label: "2h" },
  { value: 240, label: "4h" },
  { value: 480, label: "1j" },
];

export function formatMinutes(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return "—";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
}

interface SubtaskCardProps {
  sub: SubtaskItem;
  variant: "parent" | "child";
  index: number;
  today: string;
  deleteId: string | null;
  /** child completion summary for parent rows (null = no children, don't show) */
  childrenProgress?: { completed: number; total: number };
  /** computed actual minutes from session aggregation */
  actualMinutes?: number;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onUpdate?: (id: string, data: Partial<SubtaskItem>) => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  /** If set and there are no children, clicking it triggers decomposer mode on the parent */
  onDecompose?: () => void;
  /** Drag handle (for @dnd-kit) — opaque attrs/listeners/ref passthrough */
  dragHandleProps?: Record<string, unknown>;
  dragHandleRef?: (el: HTMLElement | null) => void;
  isDragging?: boolean;
}

export function SubtaskCard({
  sub, variant, index, today, deleteId,
  childrenProgress,
  actualMinutes,
  onToggle, onDelete, onCancelDelete, onUpdate, onMoveUp, onMoveDown,
  onDecompose,
  dragHandleProps, dragHandleRef, isDragging,
}: SubtaskCardProps) {
  const [expanded,  setExpanded]  = useState(false);
  const [editDesc,  setEditDesc]  = useState(false);
  const [descDraft, setDescDraft] = useState(sub.description || "");
  const [editTitle, setEditTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(sub.text);

  const isOverdue = !!sub.dueDate && !sub.completed && sub.dueDate < today;
  const isDueSoon = !!sub.dueDate && !sub.completed && !isOverdue && sub.dueDate <= (() => {
    const d = new Date(); d.setDate(d.getDate() + 3); return d.toISOString().slice(0, 10);
  })();

  const status     = sub.status || "not_started";
  const statusCfg  = STATUS_CONFIG[status];
  const priority   = sub.priority || "medium";
  const effort     = sub.effortSize;
  const effortCfg  = effort ? EFFORT_CONFIG[effort] : null;
  const isChild    = variant === "child";
  const estimated  = sub.estimatedMinutes ?? null;
  const actualMin  = actualMinutes != null && actualMinutes > 0 ? actualMinutes : null;

  const estimateRatio = estimated && actualMin ? actualMin / estimated : 0;
  const overEstimate  = estimated && actualMin ? actualMin > estimated : false;

  function saveField(field: string, value: any) {
    if (!onUpdate) return;
    if (field === "timebound") onUpdate(sub.id, { dueDate: value || undefined });
    else onUpdate(sub.id, { [field]: value || null } as any);
  }

  function cycleEffort() {
    if (!onUpdate) return;
    onUpdate(sub.id, { effortSize: nextEffort(effort) });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ delay: index * 0.02, duration: 0.18 }}
      className={cn(
        "rounded-xl border transition-all",
        isChild ? "border-l-2" : "border-l-[3px]",
        PRIORITY_BORDER[priority],
        expanded
          ? isChild
            ? "bg-card/70 border-border/40 shadow-sm"
            : "bg-white/60 dark:bg-white/[0.03] border-border/50 shadow-sm"
          : isChild
            ? "bg-muted/20 border-transparent hover:border-border/30 hover:bg-muted/30"
            : "bg-white/30 dark:bg-white/[0.02] border-transparent hover:border-border/30 hover:bg-white/50",
        isOverdue && "bg-red-50/30 border-red-200/50",
        sub.flaggedToday && !sub.completed && "ring-1 ring-amber-300/40",
        sub.completed && "opacity-40",
        isDragging && "opacity-50 shadow-xl",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 cursor-pointer group",
          isChild ? "px-3 py-2" : "px-4 py-3",
        )}
        onClick={() => setExpanded(o => !o)}
      >
        {/* Drag handle */}
        {dragHandleProps && onUpdate && !sub.completed && (
          <button
            ref={dragHandleRef as any}
            {...dragHandleProps}
            onClick={e => e.stopPropagation()}
            className="opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-muted-foreground shrink-0 -ml-0.5"
            title="Glisser pour réordonner"
          >
            <GripVertical size={isChild ? 12 : 14} />
          </button>
        )}

        {/* Child connector icon */}
        {isChild && <CornerDownRight size={10} className="text-muted-foreground/30 shrink-0" />}

        {/* Checkbox */}
        <button
          onClick={e => { e.stopPropagation(); onToggle(sub.id); }}
          className={cn(
            "shrink-0 transition-all",
            sub.completed ? "text-emerald-500" : "text-muted-foreground/60 hover:text-primary hover:scale-110",
          )}
        >
          {sub.completed
            ? <CheckCircle2 size={isChild ? 15 : 18} />
            : <Circle size={isChild ? 15 : 18} />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {editTitle ? (
              <input
                value={titleDraft}
                onChange={e => setTitleDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { onUpdate?.(sub.id, { text: titleDraft.trim() }); setEditTitle(false); }
                  if (e.key === "Escape") { setTitleDraft(sub.text); setEditTitle(false); }
                }}
                onBlur={() => { onUpdate?.(sub.id, { text: titleDraft.trim() }); setEditTitle(false); }}
                autoFocus
                onClick={e => e.stopPropagation()}
                className={cn(
                  "font-body font-medium text-foreground bg-secondary/50 border border-border/50 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-primary/20 w-full",
                  isChild ? "text-xs" : "text-sm",
                )}
              />
            ) : (
              <span
                className={cn(
                  "font-body font-medium group/stitle inline items-center gap-1 break-words",
                  isChild ? "text-xs text-foreground/80" : "text-sm",
                  sub.completed && "line-through text-muted-foreground",
                )}
              >
                {sub.text}
                {onUpdate && !sub.completed && (
                  <Pencil
                    size={10}
                    className="inline ml-1 opacity-0 group-hover/stitle:opacity-50 hover:!opacity-100 transition-opacity cursor-pointer text-muted-foreground align-middle"
                    onClick={e => { e.stopPropagation(); setTitleDraft(sub.text); setEditTitle(true); }}
                  />
                )}
              </span>
            )}

            {effortCfg && (
              <button
                onClick={e => { e.stopPropagation(); cycleEffort(); }}
                className={cn(
                  "shrink-0 text-[9px] font-body font-bold px-1.5 py-0.5 rounded-full border transition-all",
                  effortCfg.bg, effortCfg.text, effortCfg.border,
                )}
                title={`Effort: ${effortCfg.label} · clic pour changer`}
              >
                {effortCfg.short}
              </button>
            )}

            {(estimated !== null || actualMin !== null) && (
              <span
                className={cn(
                  "shrink-0 inline-flex items-center gap-0.5 text-[10px] font-mono font-semibold tabular-nums px-1.5 py-0.5 rounded-full border",
                  overEstimate
                    ? "bg-rose-100/70 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30"
                    : actualMin && estimated
                      ? "bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                      : "bg-muted/40 text-muted-foreground border-border/40",
                )}
                title={
                  estimated && actualMin
                    ? `${formatMinutes(actualMin)} passé · ${formatMinutes(estimated)} estimé`
                    : estimated
                      ? `${formatMinutes(estimated)} estimé`
                      : `${formatMinutes(actualMin ?? 0)} passé`
                }
              >
                <Clock size={9} />
                {actualMin && estimated ? `${formatMinutes(actualMin)}/${formatMinutes(estimated)}`
                  : estimated ? formatMinutes(estimated)
                  : formatMinutes(actualMin ?? 0)}
              </span>
            )}

            {status && status !== "not_started" && (
              <span className={cn("text-[10px] font-body font-bold px-2 py-0.5 rounded-full shrink-0", statusCfg.bg, statusCfg.text)}>
                {statusCfg.label}
              </span>
            )}

            {childrenProgress && childrenProgress.total > 0 && (
              <span className="text-[10px] font-mono font-semibold tabular-nums text-muted-foreground shrink-0">
                {childrenProgress.completed}/{childrenProgress.total}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 mt-0.5">
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

        {/* Right-side actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Flag star — always visible when flagged */}
          {onUpdate && sub.flaggedToday && (
            <button
              onClick={e => { e.stopPropagation(); onUpdate(sub.id, { flaggedToday: false }); }}
              className="text-amber-500 hover:text-amber-400 transition-all"
              title="Retirer du sprint"
            >
              <Star size={isChild ? 12 : 14} className="fill-current" />
            </button>
          )}

          <div className="hidden group-hover:flex items-center gap-1" onClick={e => e.stopPropagation()}>
            {!dragHandleProps && (onMoveUp || onMoveDown) && !sub.completed && (
              <div className="flex flex-col">
                {onMoveUp && <button onClick={onMoveUp} className="text-muted-foreground hover:text-foreground p-0.5"><ChevronUp size={11} /></button>}
                {onMoveDown && <button onClick={onMoveDown} className="text-muted-foreground hover:text-foreground p-0.5"><ChevronDown size={11} /></button>}
              </div>
            )}

            {onUpdate && !sub.flaggedToday && (
              <button
                onClick={e => { e.stopPropagation(); onUpdate(sub.id, { flaggedToday: true }); }}
                className="text-muted-foreground/30 hover:text-amber-400 transition-all"
                title="Ajouter au sprint"
              >
                <Star size={isChild ? 12 : 14} />
              </button>
            )}

            {onDecompose && !sub.completed && (
              <button
                onClick={e => { e.stopPropagation(); onDecompose(); }}
                className="text-muted-foreground/40 hover:text-primary transition-all px-1.5 py-0.5 text-[10px] font-body font-semibold rounded"
                title="Décomposer en sous-étapes"
              >
                <Zap size={12} className="inline mr-0.5" />
                Décomposer
              </button>
            )}

            <button
              onClick={e => { e.stopPropagation(); onDelete(sub.id); }}
              className="text-muted-foreground hover:text-destructive transition-opacity"
            >
              <Trash2 size={isChild ? 11 : 13} />
            </button>
          </div>

          {deleteId === sub.id && (
            <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
              <Button size="sm" variant="destructive" className="h-6 px-1.5 text-[10px] rounded-md" onClick={() => onDelete(sub.id)}>Oui</Button>
              <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] rounded-md" onClick={onCancelDelete}>Non</Button>
            </div>
          )}

          <div className={cn("transition-transform duration-200 text-muted-foreground", expanded && "rotate-90")}>
            <ChevronRight size={isChild ? 11 : 14} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && onUpdate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={cn("pt-0", isChild ? "px-3 pb-2.5" : "px-4 pb-3")}>
              <div className="h-px bg-border/30 mb-2.5 mx-1" />

              {/* Status + Priority + Effort */}
              <div className="flex flex-wrap items-center gap-2 mb-2.5 ml-1">
                {(["not_started", "in_progress", "done", "blocked"] as TodoStatus[]).map(s => {
                  const cfg = STATUS_CONFIG[s];
                  return (
                    <button
                      key={s}
                      onClick={e => { e.stopPropagation(); saveField("status", s); }}
                      className={cn(
                        "text-[10px] font-body font-bold px-2 py-0.5 rounded-full transition-all",
                        status === s ? cn(cfg.bg, cfg.text) : "text-muted-foreground/25 hover:text-muted-foreground/50",
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
                <div className="w-px h-3 bg-border/20" />
                {(EFFORT_CYCLE.filter(Boolean) as EffortSize[]).map(e => {
                  const cfg = EFFORT_CONFIG[e];
                  return (
                    <button
                      key={e}
                      onClick={ev => { ev.stopPropagation(); onUpdate(sub.id, { effortSize: effort === e ? null : e }); }}
                      className={cn(
                        "text-[10px] font-body font-bold px-2 py-0.5 rounded-full transition-all border",
                        effort === e ? cn(cfg.bg, cfg.text, cfg.border) : "text-muted-foreground/25 border-transparent hover:text-muted-foreground/50",
                      )}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              {/* Estimated time row */}
              <div className="flex flex-wrap items-center gap-2 mb-2.5 ml-1">
                <div className="flex items-center gap-1.5 text-[10px] font-display font-bold text-foreground/60 uppercase tracking-wider">
                  <Clock size={10} /> Estimation
                </div>
                {ESTIMATE_PRESETS.map(p => (
                  <button
                    key={p.value}
                    onClick={ev => { ev.stopPropagation(); onUpdate(sub.id, { estimatedMinutes: estimated === p.value ? null : p.value }); }}
                    className={cn(
                      "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full transition-all border tabular-nums",
                      estimated === p.value
                        ? "bg-primary/10 text-primary border-primary/40"
                        : "text-muted-foreground/30 border-transparent hover:text-muted-foreground/70",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
                {actualMin !== null && (
                  <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums ml-1">
                    · {formatMinutes(actualMin)} passé
                  </span>
                )}
              </div>

              {/* Actual vs estimate progress bar (only when both present) */}
              {estimated && actualMin !== null && (
                <div className="mb-2.5 ml-1">
                  <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        overEstimate ? "bg-rose-400" : estimateRatio > 0.8 ? "bg-amber-400" : "bg-emerald-400",
                      )}
                      style={{ width: `${Math.min(100, estimateRatio * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {!isChild && (
                <SmartFields
                  specific={sub.smartSpecific}
                  measurable={sub.smartMeasurable}
                  achievable={sub.smartAchievable}
                  relevant={sub.smartRelevant}
                  dueDate={sub.dueDate}
                  onSave={(field, value) => saveField(field, value)}
                />
              )}

              {/* Description */}
              <div className="ml-1">
                {editDesc ? (
                  <div className="flex gap-1.5 items-start">
                    <textarea
                      value={descDraft}
                      onChange={e => setDescDraft(e.target.value)}
                      placeholder="Notes…"
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
                ) : sub.description ? (
                  <button
                    onClick={e => { e.stopPropagation(); setDescDraft(sub.description || ""); setEditDesc(true); }}
                    className="flex items-start gap-1.5 text-xs text-muted-foreground/60 font-body hover:text-muted-foreground transition-colors w-full text-left group/desc"
                  >
                    <span className="leading-relaxed">{sub.description}</span>
                    <Pencil size={10} className="opacity-0 group-hover/desc:opacity-50 transition-opacity mt-0.5 shrink-0" />
                  </button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setDescDraft(""); setEditDesc(true); }}
                    className="text-[11px] text-muted-foreground/25 hover:text-muted-foreground/40 font-body italic transition-colors"
                  >
                    + Notes…
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
