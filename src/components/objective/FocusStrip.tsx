import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square, Check, Clock, ChevronDown, Target, Star, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useFocusSession, formatElapsed } from "./useFocusSession";
import { attributeSubtasks } from "@/api/objectiveSessions";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useObjectives } from "@/hooks/useObjectives";
import type { ObjectiveSource } from "@/api/objectiveSource";
import type { SubtaskItem } from "@/api/todoSubtasks";

interface RetroCandidate extends SubtaskItem {
  objectiveTitle?: string;
}

interface RetroState {
  sessionId: string;
  primarySubtaskId: string;
  primaryText: string;
  durationSec: number;
  candidates: RetroCandidate[];
}

interface FocusStripProps {
  source: ObjectiveSource;
  objectiveId: string;
  objectiveTitle: string;
  subtasks: SubtaskItem[];
  onSetFocus: (subtaskId: string) => void;
  onClearFocus: (subtaskId: string) => void;
  onComplete: (subtaskId: string) => void;
}

export function FocusStrip({
  source, objectiveId, objectiveTitle, subtasks,
  onSetFocus, onClearFocus, onComplete,
}: FocusStripProps) {
  const session = useFocusSession({ source, objectiveId });

  const subtaskById = useMemo(() => {
    const m: Record<string, SubtaskItem> = {};
    for (const s of subtasks) m[s.id] = s;
    return m;
  }, [subtasks]);

  // Active = the timed subtask (if session running), else the first flagged pending subtask
  const flagged = useMemo(
    () => subtasks.filter(s => s.flaggedToday && !s.completed).sort((a, b) => a.order - b.order),
    [subtasks],
  );
  const pending = useMemo(() => subtasks.filter(s => !s.completed), [subtasks]);

  // Cross-objective sprint backlog: every flagged subtask the user committed
  // to today, regardless of its parent objective. Used by the retro so a
  // single session can credit work spread across several projects.
  const { data: allSubtasksData } = useAllSubtasks();
  const { data: allObjectivesData } = useObjectives();
  const objectiveTitleById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const o of allObjectivesData ?? []) m[o.id] = o.text;
    return m;
  }, [allObjectivesData]);
  const sprintCandidates = useMemo<RetroCandidate[]>(() => {
    const decorate = (s: SubtaskItem): RetroCandidate => ({
      ...s,
      objectiveTitle: s.parentId === objectiveId ? undefined : objectiveTitleById[s.parentId],
    });
    if (!allSubtasksData) return flagged.map(decorate);
    const filtered = allSubtasksData.filter(s => s.flaggedToday && !s.completed);
    if (filtered.length === 0) return flagged.map(decorate);
    return filtered
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(decorate);
  }, [allSubtasksData, flagged, objectiveTitleById, objectiveId]);

  const activeFromSession = session.active && session.subtaskId ? subtaskById[session.subtaskId] : null;
  const active = activeFromSession ?? flagged[0] ?? null;

  const parentOfActive = active?.parentSubtaskId ? subtaskById[active.parentSubtaskId] : null;
  const [picking, setPicking] = useState(false);
  const [retro, setRetro]     = useState<RetroState | null>(null);
  const retroTimeout = useRef<number | null>(null);

  function scheduleDismiss() {
    if (retroTimeout.current) window.clearTimeout(retroTimeout.current);
    retroTimeout.current = window.setTimeout(() => setRetro(null), 15000);
  }

  useEffect(() => () => {
    if (retroTimeout.current) window.clearTimeout(retroTimeout.current);
  }, []);

  async function handleStart() {
    await session.start(active?.id);
  }

  async function handleStop() {
    // Capture before stopping (state unmounts elapsed)
    const snapshot = active
      ? {
          primarySubtaskId: active.id,
          primaryText: active.text,
          durationSec: session.elapsedSec,
          // Offer the cross-objective sprint backlog so the user can credit
          // work that spanned several projects. sprintCandidates already
          // falls back to local-objective flagged subtasks when nothing
          // else is loaded; if even that is empty, surface just the active
          // one so the retro is never empty.
          candidates: sprintCandidates.length > 0
            ? sprintCandidates
            : [active as RetroCandidate],
        }
      : null;
    const closed = await session.stop();
    if (snapshot && closed && snapshot.durationSec >= 10) {
      setRetro({ ...snapshot, sessionId: closed.sessionId });
      scheduleDismiss();
    }
  }

  // F keyboard shortcut (dispatched from the workspace page) toggles focus
  useEffect(() => {
    function onToggle() {
      if (session.active) handleStop();
      else if (active || pending.length > 0) handleStart();
    }
    window.addEventListener("toggle-focus", onToggle);
    return () => window.removeEventListener("toggle-focus", onToggle);
  });

  async function handleDone() {
    if (!active) return;
    if (session.active) await session.stop();
    onComplete(active.id);
    onClearFocus(active.id);
  }

  async function handleRetroConfirm(selectedIds: string[], markDoneIds: string[], _note: string) {
    if (!retro) return;
    // Persist multi-subtask attribution: the backend splits duration_sec
    // equally across these ids when computing per-project breakdowns.
    if (selectedIds.length > 0) {
      try { await attributeSubtasks(retro.sessionId, selectedIds); } catch {}
    }
    for (const id of markDoneIds) {
      onComplete(id);
      onClearFocus(id);
    }
    setRetro(null);
    if (retroTimeout.current) window.clearTimeout(retroTimeout.current);
  }

  async function switchFocus(id: string) {
    // If a session is running on another subtask, stop it first, then start on the new one
    const wasActive = session.active;
    if (wasActive) await session.stop();
    // Just mark flagged — user can hit Start to time
    if (!subtaskById[id]?.flaggedToday) onSetFocus(id);
    if (wasActive) await session.start(id);
  }

  return (
    <div
      className={cn(
        "relative rounded-2xl border-2 p-5 transition-all overflow-hidden",
        session.active
          ? "border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-primary/5 to-transparent shadow-[0_0_0_1px_rgba(16,185,129,0.2)]"
          : active
            ? "border-primary/40 bg-primary/[0.04]"
            : "border-dashed border-border/50 bg-card/30",
      )}
    >
      {/* Animated gradient ring when session is running */}
      {session.active && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-2xl"
          style={{
            background: "conic-gradient(from var(--focus-angle, 0deg), rgba(16,185,129,0.4), rgba(99,102,241,0.25), rgba(16,185,129,0.4))",
            WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            padding: "2px",
            opacity: 0.6,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Retrospective prompt — appears after stop */}
      <AnimatePresence>
        {retro && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative mb-4 rounded-xl border border-primary/40 bg-primary/5 p-4"
          >
            <SprintRetroContent
              retro={retro}
              onConfirm={handleRetroConfirm}
              onDismiss={() => setRetro(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {session.active && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
          <Target size={15} className={cn("shrink-0", session.active ? "text-emerald-600" : "text-primary")} />
          <span className="text-xs font-display font-bold uppercase tracking-wider text-foreground/70 truncate">
            {session.active ? "En cours" : active ? "Focus" : "Sprint"}
          </span>
        </div>
        {session.active && (
          <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-mono tabular-nums text-sm font-bold shrink-0">
            <Clock size={14} />
            {formatElapsed(session.elapsedSec)}
          </div>
        )}
      </div>

      {active ? (
        <>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 text-[11px] font-body text-muted-foreground mb-1.5 truncate">
            <span className="truncate max-w-[160px]" title={objectiveTitle}>{objectiveTitle}</span>
            {parentOfActive && (
              <>
                <span className="text-muted-foreground/40">›</span>
                <span className="truncate max-w-[160px]" title={parentOfActive.text}>{parentOfActive.text}</span>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-base sm:text-lg font-display font-semibold text-foreground break-words flex items-start gap-2">
                <Star size={14} className="fill-amber-400 text-amber-400 shrink-0 mt-1.5" />
                <span>{active.text}</span>
              </div>
              {active.dueDate && (
                <div className="text-xs font-mono text-muted-foreground tabular-nums mt-0.5 ml-6">
                  Échéance · {active.dueDate}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {!session.active ? (
                <Button size="sm" onClick={handleStart} className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 rounded-full">
                  <Play size={14} className="mr-1.5" /> Démarrer
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handleStop} className="h-9 px-4 rounded-full border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10">
                  <Square size={13} className="mr-1.5" /> Stop
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleDone} className="h-9 px-4 rounded-full">
                <Check size={13} className="mr-1.5" /> Terminée
              </Button>
            </div>
          </div>

          {/* Sprint backlog pills */}
          {flagged.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/30">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[10px] font-display font-bold uppercase tracking-wider text-foreground/60">
                  Sprint en cours · {flagged.filter(f => f.completed).length}/{flagged.length}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {flagged.map(s => {
                  const isActive = active?.id === s.id;
                  const parent = s.parentSubtaskId ? subtaskById[s.parentSubtaskId] : null;
                  return (
                    <button
                      key={s.id}
                      onClick={() => switchFocus(s.id)}
                      className={cn(
                        "flex items-center gap-1.5 text-[11px] font-body font-medium px-2.5 py-1 rounded-full border transition-all max-w-full",
                        isActive
                          ? session.active
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-primary/15 text-primary border-primary/40"
                          : "bg-card/70 text-foreground/70 border-border/40 hover:border-primary/40 hover:bg-primary/5",
                      )}
                      title={parent ? `${parent.text} › ${s.text}` : s.text}
                    >
                      <Star size={10} className={cn("fill-current shrink-0", isActive ? (session.active ? "text-white" : "text-primary") : "text-amber-400")} />
                      <span className="truncate max-w-[200px]">{s.text}</span>
                      {isActive && session.active && <span className="font-mono tabular-nums text-[10px] shrink-0">· actif</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : pending.length === 0 ? (
        <div className="text-sm font-body text-muted-foreground/70 italic">
          Ajoute d'abord une étape pour pouvoir t'y concentrer.
        </div>
      ) : picking ? (
        <div className="space-y-1.5">
          <div className="text-xs font-body text-muted-foreground mb-1">Choisir l'étape sur laquelle se concentrer :</div>
          {pending.slice(0, 10).map(s => {
            const parent = s.parentSubtaskId ? subtaskById[s.parentSubtaskId] : null;
            return (
              <button
                key={s.id}
                onClick={() => { onSetFocus(s.id); setPicking(false); }}
                className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg bg-card/50 hover:bg-primary/10 border border-border/40 hover:border-primary/40 transition-all"
              >
                <Target size={12} className="text-primary/60 shrink-0" />
                <span className="text-sm font-body text-foreground truncate flex-1">
                  {parent && <span className="text-muted-foreground/60 text-xs mr-1">{parent.text} ›</span>}
                  {s.text}
                </span>
                {s.dueDate && <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">{s.dueDate}</span>}
              </button>
            );
          })}
          <button
            onClick={() => setPicking(false)}
            className="text-xs font-body text-muted-foreground hover:text-foreground px-2 py-1"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-card/50 hover:bg-primary/5 border border-dashed border-border/50 hover:border-primary/40 transition-all group"
        >
          <span className="text-sm font-body text-muted-foreground group-hover:text-foreground transition-colors">
            Choisir ma prochaine action · DOING NOW
          </span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

function SprintRetroContent({
  retro, onConfirm, onDismiss,
}: {
  retro: RetroState;
  onConfirm: (selectedIds: string[], markDoneIds: string[], note: string) => void;
  onDismiss: () => void;
}) {
  // Pre-select the subtask that started the session — it's almost always
  // the right default. The user can extend the selection to credit other
  // flagged subtasks they touched during the session.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set([retro.primarySubtaskId])
  );
  const [markDoneIds, setMarkDoneIds] = useState<Set<string>>(() => new Set());
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const mins = Math.floor(retro.durationSec / 60);
  const secs = retro.durationSec % 60;
  const durationLabel = mins > 0 ? `${mins}min ${secs.toString().padStart(2, "0")}s` : `${secs}s`;
  const splitPerSubtaskMin = selectedIds.size > 1
    ? Math.max(1, Math.round(retro.durationSec / selectedIds.size / 60))
    : null;

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Unselecting also clears any markDone flag on that row
    setMarkDoneIds(prev => {
      if (!prev.has(id) || selectedIds.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function toggleMarkDone(id: string) {
    setMarkDoneIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Marking done implies the row is selected for attribution
        setSelectedIds(p => p.has(id) ? p : new Set(p).add(id));
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Sparkles size={14} className="text-primary shrink-0" />
        <span className="text-xs font-display font-bold uppercase tracking-wider text-primary">
          Rétro · {durationLabel}
        </span>
        {splitPerSubtaskMin !== null && (
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            ~{splitPerSubtaskMin}min × {selectedIds.size}
          </span>
        )}
        <button
          onClick={onDismiss}
          className="ml-auto text-muted-foreground/60 hover:text-foreground transition-colors"
          aria-label="Fermer"
        >
          <X size={14} />
        </button>
      </div>

      <div className="text-xs font-body text-foreground/70">
        Sur quelles étapes du sprint as-tu travaillé ? Le temps est réparti à parts égales entre celles cochées.
      </div>

      <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
        {retro.candidates.map(c => {
          const sel = selectedIds.has(c.id);
          const done = markDoneIds.has(c.id);
          const isPrimary = c.id === retro.primarySubtaskId;
          return (
            <div
              key={c.id}
              className={cn(
                "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors",
                sel ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/40",
              )}
            >
              <input
                type="checkbox"
                checked={sel}
                onChange={() => toggleSelected(c.id)}
                className="w-4 h-4 rounded border-border/50 text-primary focus:ring-2 focus:ring-primary/20 cursor-pointer"
                aria-label={`Inclure « ${c.text} » dans la répartition`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-body text-foreground/80 truncate" title={c.text}>
                  {isPrimary && <Star size={10} className="fill-amber-400 text-amber-400 inline mr-1 -mt-0.5" />}
                  {c.text}
                </div>
                {c.objectiveTitle && (
                  <div className="text-[10px] font-body text-muted-foreground/70 truncate" title={c.objectiveTitle}>
                    {c.objectiveTitle}
                  </div>
                )}
              </div>
              <label className="flex items-center gap-1 text-[10px] font-body text-muted-foreground cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleMarkDone(c.id)}
                  className="w-3.5 h-3.5 rounded border-border/50 text-primary focus:ring-2 focus:ring-primary/20"
                />
                <span>Terminée</span>
              </label>
            </div>
          );
        })}
      </div>

      {!showNote ? (
        <button
          onClick={() => setShowNote(true)}
          className="text-xs font-body text-muted-foreground/60 hover:text-primary transition-colors"
        >
          + Ajouter une note
        </button>
      ) : (
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="Qu'avez-vous accompli ? Qu'est-ce qui a bloqué ?"
          rows={2}
          autoFocus
          className="w-full text-xs font-body bg-card/70 border border-border/40 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none"
        />
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => onConfirm([...selectedIds], [...markDoneIds], note)}
          className="h-8 rounded-full"
        >
          <Check size={13} className="mr-1" />
          Confirmer{selectedIds.size > 1 ? ` (${selectedIds.size} étapes)` : ""}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss} className="h-8 rounded-full text-muted-foreground">
          Ignorer
        </Button>
      </div>
    </div>
  );
}
