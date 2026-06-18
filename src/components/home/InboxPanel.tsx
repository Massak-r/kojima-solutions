import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Check, Trash2, ArrowRight, Pencil, X, Loader2, Target,
  Sparkles, ChevronDown, ChevronUp, FolderOpen, StickyNote, FolderKanban,
  Archive, Zap, MapPin,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { formatDateShort } from "@/lib/dateFormat";
import {
  listInboxCaptures, markCaptureTriaged, untriageCapture, deleteInboxCapture, updateCaptureText,
  type InboxCapture, type InboxList,
} from "@/api/inboxCaptures";
import { createSubtask, deleteSubtask } from "@/api/todoSubtasks";
import { createDecision, deleteDecision } from "@/api/objectiveDecisions";
import { createNote as createObjectiveNote, deleteNote as deleteObjectiveNote } from "@/api/objectiveNotes";
import { createMeetingNote, deleteMeetingNote } from "@/api/meetingNotes";
import { CAPTURE_KIND_MAP } from "@/lib/captureKinds";
import { suggestTriage } from "@/lib/triageSuggest";
import { useObjectives } from "@/hooks/useObjectives";
import { useProjects, type StoredProject } from "@/contexts/ProjectsContext";
import { subtasksQueryKey } from "@/hooks/useSubtasks";
import { SwipeableRow } from "@/components/ui/swipeable-row";
import { useIsMobile } from "@/hooks/use-mobile";
import type { UnifiedObjective } from "@/api/objectiveSource";
import { INBOX_PENDING_KEY } from "@/hooks/useInboxCount";

/** Shared with the nav badge (useInboxCount) so the panel and the badge
 *  dedupe one fetch and react to the same invalidations. */
const PENDING_KEY = INBOX_PENDING_KEY;
const KEPT_KEY    = ["inbox-captures", "admin", "kept"] as const;

/** Destination label used by the pre-2026-05-26 "Garder" button. Captures
 *  matching this prefix get surfaced in the recovery section so the operator
 *  can route them into a real destination now that the button is gone. */
const LEGACY_KEPT_DESTINATION = "kept-as-note";

type PickerMode = "subtask" | "decision" | "note" | null;

/** Polymorphic destination — note can land on a project or an objective. */
type NoteTarget =
  | { kind: "project"; project: StoredProject }
  | { kind: "objective"; objective: UnifiedObjective };

export function InboxPanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: objectives = [] } = useObjectives();
  const { projects } = useProjects();

  const { data, isLoading } = useQuery<InboxList>({
    queryKey: PENDING_KEY,
    queryFn: () => listInboxCaptures({ status: "pending", source: "admin", limit: 50 }),
    staleTime: 30_000,
  });

  // Surface previously "Garder"-ed captures so they can be re-routed into a
  // real note destination. Filtered client-side to the legacy marker — other
  // triaged destinations stay archived and out of the way.
  const { data: triagedData } = useQuery<InboxList>({
    queryKey: KEPT_KEY,
    queryFn: () => listInboxCaptures({ status: "triaged", source: "admin", limit: 200 }),
    staleTime: 60_000,
  });

  const items = data?.items ?? [];
  const keptItems = useMemo(
    () => (triagedData?.items ?? []).filter(
      (c) => c.triaged_destination === LEGACY_KEPT_DESTINATION,
    ),
    [triagedData],
  );

  /** Optimistically removes a row from the cached list whose query key is
   *  passed in. Used by both the pending list and the kept-recovery list. */
  function dropFromList(key: readonly unknown[], id: string) {
    qc.setQueryData<InboxList>(key as readonly string[], (p) =>
      p ? {
        ...p,
        items: p.items.filter((i) => i.id !== id),
        pendingCount: key === PENDING_KEY ? Math.max(0, p.pendingCount - 1) : p.pendingCount,
      } : p,
    );
  }

  const triage = useMutation({
    mutationFn: ({ id, destination }: { id: string; destination: string }) =>
      markCaptureTriaged(id, destination),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: PENDING_KEY });
      await qc.cancelQueries({ queryKey: KEPT_KEY });
      const prevPending = qc.getQueryData<InboxList>(PENDING_KEY);
      const prevKept    = qc.getQueryData<InboxList>(KEPT_KEY);
      dropFromList(PENDING_KEY, id);
      dropFromList(KEPT_KEY, id);
      return { prevPending, prevKept };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevPending) qc.setQueryData(PENDING_KEY, ctx.prevPending);
      if (ctx?.prevKept)    qc.setQueryData(KEPT_KEY, ctx.prevKept);
      toast({ title: "Action échouée", description: "Réessaye ?", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PENDING_KEY });
      qc.invalidateQueries({ queryKey: KEPT_KEY });
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteInboxCapture(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: PENDING_KEY });
      await qc.cancelQueries({ queryKey: KEPT_KEY });
      const prevPending = qc.getQueryData<InboxList>(PENDING_KEY);
      const prevKept    = qc.getQueryData<InboxList>(KEPT_KEY);
      dropFromList(PENDING_KEY, id);
      dropFromList(KEPT_KEY, id);
      return { prevPending, prevKept };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevPending) qc.setQueryData(PENDING_KEY, ctx.prevPending);
      if (ctx?.prevKept)    qc.setQueryData(KEPT_KEY, ctx.prevKept);
      toast({ title: "Suppression échouée", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PENDING_KEY });
      qc.invalidateQueries({ queryKey: KEPT_KEY });
    },
  });

  const editText = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updateCaptureText(id, text),
    onMutate: async ({ id, text }) => {
      await qc.cancelQueries({ queryKey: PENDING_KEY });
      await qc.cancelQueries({ queryKey: KEPT_KEY });
      const prevPending = qc.getQueryData<InboxList>(PENDING_KEY);
      const prevKept    = qc.getQueryData<InboxList>(KEPT_KEY);
      const patch = (list: InboxList | undefined) =>
        list ? { ...list, items: list.items.map((i) => i.id === id ? { ...i, text } : i) } : list;
      qc.setQueryData<InboxList>(PENDING_KEY, patch);
      qc.setQueryData<InboxList>(KEPT_KEY, patch);
      return { prevPending, prevKept };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevPending) qc.setQueryData(PENDING_KEY, ctx.prevPending);
      if (ctx?.prevKept)    qc.setQueryData(KEPT_KEY, ctx.prevKept);
      toast({ title: "Modification échouée", variant: "destructive" });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: PENDING_KEY });
      qc.invalidateQueries({ queryKey: KEPT_KEY });
    },
  });

  /** Success toast for a triage with a 15s "Annuler" action. Reverses the
   *  triage by deleting the entity we just created and bringing the capture
   *  back to the pending list. Uses Sonner (not the local useToast) because
   *  it's the app's canonical undo-toast surface — see useUndoableDelete. */
  function triagedToastWithUndo(opts: {
    title: string;
    description: string;
    captureId: string;
    undoDelete: () => Promise<unknown>;
  }) {
    sonnerToast.success(opts.title, {
      description: opts.description,
      duration: 15_000,
      action: {
        label: "Annuler",
        onClick: async () => {
          try {
            await opts.undoDelete();
            await untriageCapture(opts.captureId);
          } catch (e) {
            sonnerToast.error("Annulation échouée", {
              description: e instanceof Error ? e.message : "Réessaye ?",
            });
          } finally {
            qc.invalidateQueries({ queryKey: PENDING_KEY });
            qc.invalidateQueries({ queryKey: KEPT_KEY });
            qc.invalidateQueries({ queryKey: subtasksQueryKey });
          }
        },
      },
    });
  }

  async function convertToSubtask(capture: InboxCapture, objective: UnifiedObjective) {
    try {
      const created = await createSubtask({
        parentId: objective.id,
        source: objective.source,
        text: capture.text,
      });
      await markCaptureTriaged(capture.id, `subtask:${objective.text.slice(0, 80)}`);
      qc.invalidateQueries({ queryKey: subtasksQueryKey });
      qc.invalidateQueries({ queryKey: PENDING_KEY });
      qc.invalidateQueries({ queryKey: KEPT_KEY });
      triagedToastWithUndo({
        title: "Convertie en étape",
        description: `Ajoutée à « ${objective.text} »`,
        captureId: capture.id,
        undoDelete: () => deleteSubtask(created.id),
      });
    } catch (e) {
      toast({
        title: "Conversion échouée",
        description: e instanceof Error ? e.message : "Réessaye ?",
        variant: "destructive",
      });
    }
  }

  async function convertToDecision(capture: InboxCapture, objective: UnifiedObjective) {
    try {
      const created = await createDecision({
        source: objective.source,
        objectiveId: objective.id,
        title: capture.text,
      });
      await markCaptureTriaged(capture.id, `decision:${objective.text.slice(0, 80)}`);
      qc.invalidateQueries({ queryKey: PENDING_KEY });
      qc.invalidateQueries({ queryKey: KEPT_KEY });
      triagedToastWithUndo({
        title: "Décision archivée",
        description: `Sous « ${objective.text} »`,
        captureId: capture.id,
        undoDelete: () => deleteDecision(created.id),
      });
    } catch (e) {
      toast({
        title: "Conversion échouée",
        description: e instanceof Error ? e.message : "Réessaye ?",
        variant: "destructive",
      });
    }
  }

  /** Note conversion — polymorphic. Project target → meeting_note.
   *  Objective target → objective_note. The capture body becomes the note
   *  content; the title is a short prefix of the capture (so the note list
   *  on either side stays readable). */
  async function convertToNote(capture: InboxCapture, target: NoteTarget) {
    try {
      const titleLine = capture.text.split("\n")[0]?.trim() ?? "";
      const title = titleLine.length > 60 ? titleLine.slice(0, 57) + "…"
        : titleLine || "Note";
      let undoDelete: () => Promise<unknown>;
      let okTitle: string;
      let okDescription: string;
      if (target.kind === "project") {
        const created = await createMeetingNote({
          projectId: target.project.id,
          title,
          content: capture.text,
          meetingDate: new Date().toISOString().slice(0, 10),
        });
        await markCaptureTriaged(capture.id, `note:project:${target.project.title.slice(0, 80)}`);
        undoDelete = () => deleteMeetingNote(created.id);
        okTitle = "Note ajoutée au projet";
        okDescription = `« ${target.project.title} »`;
      } else {
        const created = await createObjectiveNote({
          source: target.objective.source,
          objectiveId: target.objective.id,
          title,
          content: capture.text,
        });
        await markCaptureTriaged(capture.id, `note:objective:${target.objective.text.slice(0, 80)}`);
        undoDelete = () => deleteObjectiveNote(created.id);
        okTitle = "Note ajoutée à l'objectif";
        okDescription = `« ${target.objective.text} »`;
      }
      qc.invalidateQueries({ queryKey: PENDING_KEY });
      qc.invalidateQueries({ queryKey: KEPT_KEY });
      triagedToastWithUndo({
        title: okTitle,
        description: okDescription,
        captureId: capture.id,
        undoDelete,
      });
    } catch (e) {
      toast({
        title: "Conversion échouée",
        description: e instanceof Error ? e.message : "Réessaye ?",
        variant: "destructive",
      });
    }
  }

  // Hide entirely when there's nothing pending AND nothing legacy to recover.
  if (!isLoading && items.length === 0 && keptItems.length === 0) return null;

  return (
    <section className="rounded-2xl border border-violet-200/60 dark:border-violet-500/25 bg-card shadow-card p-4 sm:p-5">
      <header className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Inbox size={14} className="text-violet-600 dark:text-violet-400" />
          <h2 className="font-display text-xs font-bold text-foreground/75 uppercase tracking-wider">
            Inbox à trier
          </h2>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            · {items.length}
          </span>
        </div>
        <span className="text-[10px] font-body text-muted-foreground/60 italic">
          Convertit en étape · décision · note projet/objectif
        </span>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {items.length > 0 && (
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {items.map(item => (
                  <motion.li
                    key={item.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -12, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.18 }}
                  >
                    <CaptureRow
                      capture={item}
                      objectives={objectives}
                      projects={projects}
                      busy={triage.isPending || remove.isPending || editText.isPending}
                      onDelete={() => remove.mutate(item.id)}
                      onEdit={(text) => editText.mutate({ id: item.id, text })}
                      onConvertSubtask={(obj) => convertToSubtask(item, obj)}
                      onConvertDecision={(obj) => convertToDecision(item, obj)}
                      onConvertNote={(target) => convertToNote(item, target)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
          {keptItems.length > 0 && (
            <KeptCapturesSection
              captures={keptItems}
              objectives={objectives}
              projects={projects}
              busy={triage.isPending || remove.isPending || editText.isPending}
              onDelete={(id) => remove.mutate(id)}
              onEdit={(id, text) => editText.mutate({ id, text })}
              onConvertSubtask={(c, o) => convertToSubtask(c, o)}
              onConvertDecision={(c, o) => convertToDecision(c, o)}
              onConvertNote={(c, t) => convertToNote(c, t)}
            />
          )}
        </>
      )}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────

/** Surfaces captures that were previously "Garder"-ed (i.e. marked as
 *  triaged with destination=kept-as-note but never actually saved as a
 *  note). Collapsed by default — it's a one-shot recovery surface, not
 *  the daily flow. */
function KeptCapturesSection({
  captures, objectives, projects, busy,
  onDelete, onEdit, onConvertSubtask, onConvertDecision, onConvertNote,
}: {
  captures: InboxCapture[];
  objectives: UnifiedObjective[];
  projects: StoredProject[];
  busy: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onConvertSubtask: (capture: InboxCapture, objective: UnifiedObjective) => void;
  onConvertDecision: (capture: InboxCapture, objective: UnifiedObjective) => void;
  onConvertNote: (capture: InboxCapture, target: NoteTarget) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-4 rounded-xl border border-amber-200/60 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-500/8 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-amber-100/40 dark:hover:bg-amber-500/15 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Archive size={13} className="text-amber-700 dark:text-amber-300" />
          <span className="text-xs font-display font-bold text-amber-800 dark:text-amber-200 uppercase tracking-wider">
            Anciennes captures « gardées » · {captures.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-body text-amber-700/70 dark:text-amber-300/70 italic hidden sm:inline">
            À convertir ou supprimer
          </span>
          {open ? <ChevronUp size={14} className="text-amber-700 dark:text-amber-300" /> : <ChevronDown size={14} className="text-amber-700 dark:text-amber-300" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="text-[11px] font-body text-amber-800/80 dark:text-amber-200/80 px-3 pb-2 leading-relaxed">
              Le bouton « Garder » ne créait pas vraiment de note — ces captures sont restées en archive. Convertis-les en note projet ou objectif, ou supprime celles qui ne servent plus.
            </p>
            <ul className="space-y-1.5 px-3 pb-3">
              {captures.map((c) => (
                <li key={c.id}>
                  <CaptureRow
                    capture={c}
                    objectives={objectives}
                    projects={projects}
                    busy={busy}
                    onDelete={() => onDelete(c.id)}
                    onEdit={(text) => onEdit(c.id, text)}
                    onConvertSubtask={(obj) => onConvertSubtask(c, obj)}
                    onConvertDecision={(obj) => onConvertDecision(c, obj)}
                    onConvertNote={(target) => onConvertNote(c, target)}
                  />
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function CaptureRow({
  capture, objectives, projects, busy,
  onDelete, onEdit, onConvertSubtask, onConvertDecision, onConvertNote,
}: {
  capture: InboxCapture;
  objectives: UnifiedObjective[];
  projects: StoredProject[];
  busy: boolean;
  onDelete: () => void;
  onEdit: (text: string) => void;
  onConvertSubtask: (obj: UnifiedObjective) => void;
  onConvertDecision: (obj: UnifiedObjective) => void;
  onConvertNote: (target: NoteTarget) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(capture.text);
  const [picker, setPicker] = useState<PickerMode>(null);
  const isMobile = useIsMobile();

  const objectivesOnly = useMemo(
    () => objectives.filter(o => o.isObjective && !o.completed),
    [objectives],
  );

  /** Live projects worth offering as a note destination — everything except
   *  completed. Sorted by status (active first) then title. */
  const projectsForNote = useMemo(
    () => projects
      .filter(p => p.status !== "completed")
      .sort((a, b) => {
        const rank = (s: string) =>
          s === "in-progress" ? 0
          : s === "draft" ? 1
          : s === "on-hold" ? 2
          : 3;
        const ra = rank(a.status);
        const rb = rank(b.status);
        if (ra !== rb) return ra - rb;
        return a.title.localeCompare(b.title);
      }),
    [projects],
  );

  const noteTargetTotal = projectsForNote.length + objectivesOnly.length;

  // One-tap suggested destination: rank the best target from type + tag +
  // keywords so the common case skips the picker entirely. null = no confident
  // suggestion → fall back to the manual pills.
  const suggestion = useMemo(
    () => suggestTriage(capture, objectivesOnly, projectsForNote),
    [capture, objectivesOnly, projectsForNote],
  );

  function acceptSuggestion() {
    if (!suggestion) return;
    if (suggestion.action === "subtask") {
      const obj = objectivesOnly.find((o) => o.id === suggestion.targetId);
      if (obj) onConvertSubtask(obj);
    } else if (suggestion.targetKind === "project") {
      const p = projectsForNote.find((p) => p.id === suggestion.targetId);
      if (p) onConvertNote({ kind: "project", project: p });
    } else {
      const o = objectivesOnly.find((o) => o.id === suggestion.targetId);
      if (o) onConvertNote({ kind: "objective", objective: o });
    }
  }

  const created = useMemo(() => {
    const d = new Date(capture.created_at);
    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return "à l'instant";
    if (diffMin < 60) return `il y a ${diffMin}min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `il y a ${diffHr}h`;
    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 7) return `il y a ${diffDay}j`;
    return formatDateShort(d);
  }, [capture.created_at]);

  function saveEdit() {
    const next = draft.trim();
    if (next && next !== capture.text) onEdit(next);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(capture.text);
    setEditing(false);
  }

  const swipeEnabled = isMobile && !!suggestion && !editing;
  const row = (
    <div className={cn(
      "rounded-xl border border-border/50 bg-card/70 px-3 py-2.5 group transition-colors",
      "hover:border-violet-300/60 dark:hover:border-violet-500/30",
    )}>
      {/* Row 1 — text + meta */}
      <div className="flex items-start gap-2.5">
        <Sparkles size={11} className="text-violet-500 mt-1 shrink-0" />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-1.5">
              <textarea
                value={draft}
                autoFocus
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Escape") { e.preventDefault(); cancelEdit(); }
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); saveEdit(); }
                }}
                rows={Math.min(14, Math.max(3, Math.ceil(draft.length / 50)))}
                className="w-full text-sm font-body bg-background border border-border rounded-md px-2 py-1.5 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 resize-y min-h-[72px] max-h-[60vh] leading-relaxed"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-muted-foreground/50 tabular-nums">
                  {draft.trim().length} car · ⌘↵ enregistrer · Échap annuler · poignée ↘ pour agrandir
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={cancelEdit}
                    className="text-[11px] font-body text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-secondary transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={!draft.trim()}
                    className={cn(
                      "inline-flex items-center gap-1 text-[11px] font-body font-semibold px-2.5 py-1 rounded-md transition-colors",
                      draft.trim()
                        ? "bg-primary text-primary-foreground hover:bg-primary/90"
                        : "bg-muted text-muted-foreground/50 cursor-not-allowed",
                    )}
                  >
                    <Check size={11} />
                    Enregistrer
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-left text-sm font-body text-foreground/90 leading-snug w-full hover:text-foreground transition-colors"
              title="Cliquer pour éditer"
            >
              {capture.text}
            </button>
          )}
          <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-muted-foreground/60">
            <span className="tabular-nums">{created}</span>
            {capture.kind && CAPTURE_KIND_MAP[capture.kind] && (
              <span className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full normal-case font-body",
                CAPTURE_KIND_MAP[capture.kind].badge,
              )}>
                <span aria-hidden>{CAPTURE_KIND_MAP[capture.kind].emoji}</span>
                {CAPTURE_KIND_MAP[capture.kind].label}
              </span>
            )}
            {capture.project_hint && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-100/60 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300 normal-case">
                <FolderOpen size={9} />
                {capture.project_hint}
              </span>
            )}
            {capture.context && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-sky-100/60 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 normal-case">
                <MapPin size={9} />
                {capture.context}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Row 2 — actions */}
      {!editing && (
        <div className="flex items-center gap-1 mt-2 pl-[18px] flex-wrap">
          {suggestion && (
            <button
              onClick={acceptSuggestion}
              disabled={busy}
              title="Routage suggéré — un tap pour classer"
              className={cn(
                "inline-flex items-center gap-1 text-[11px] font-body font-semibold rounded-full px-2 py-0.5 transition-colors max-w-full",
                "bg-violet-600 text-white hover:bg-violet-700 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed",
              )}
            >
              <Zap size={11} className="shrink-0" />
              <span className="truncate">{suggestion.label}</span>
            </button>
          )}
          <ActionPill
            onClick={() => setPicker(p => p === "note" ? null : "note")}
            disabled={busy || noteTargetTotal === 0}
            tone="emerald"
            active={picker === "note"}
            icon={<StickyNote size={11} />}
            label="Note"
            chevron
            tooltip={noteTargetTotal === 0 ? "Aucun projet ou objectif actif" : "Attacher comme note à un projet ou un objectif"}
          />
          <ActionPill
            onClick={() => setPicker(p => p === "subtask" ? null : "subtask")}
            disabled={busy || objectivesOnly.length === 0}
            tone="amber"
            active={picker === "subtask"}
            icon={<Target size={11} />}
            label="Subtask"
            chevron
            tooltip={objectivesOnly.length === 0 ? "Aucun objectif actif" : "Convertir en étape sous un objectif"}
          />
          <ActionPill
            onClick={() => setPicker(p => p === "decision" ? null : "decision")}
            disabled={busy || objectivesOnly.length === 0}
            tone="sky"
            active={picker === "decision"}
            icon={<ArrowRight size={11} />}
            label="Décision"
            chevron
            tooltip={objectivesOnly.length === 0 ? "Aucun objectif actif" : "Archiver comme décision sur un objectif"}
          />
          <div className="flex-1" />
          <button
            onClick={() => setEditing(true)}
            disabled={busy}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30"
            aria-label="Éditer"
          >
            <Pencil size={11} />
          </button>
          <button
            onClick={onDelete}
            disabled={busy}
            className="p-1.5 rounded-md text-muted-foreground/50 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-colors disabled:opacity-30"
            aria-label="Supprimer"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}

      {/* Row 3 — picker (target depends on the mode) */}
      <AnimatePresence>
        {picker === "subtask" || picker === "decision" ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <ObjectivePicker
              objectives={objectivesOnly}
              hint={capture.project_hint}
              onPick={(obj) => {
                if (picker === "subtask") onConvertSubtask(obj);
                else                       onConvertDecision(obj);
                setPicker(null);
              }}
              onCancel={() => setPicker(null)}
              modeLabel={picker === "subtask" ? "Subtask" : "Décision"}
            />
          </motion.div>
        ) : picker === "note" ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <NoteTargetPicker
              projects={projectsForNote}
              objectives={objectivesOnly}
              hint={capture.project_hint}
              onPick={(target) => {
                onConvertNote(target);
                setPicker(null);
              }}
              onCancel={() => setPicker(null)}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );

  // Mobile swipe-to-triage: drag right to accept the suggested destination.
  if (swipeEnabled) {
    return (
      <SwipeableRow
        direction="right"
        onSwipe={acceptSuggestion}
        actionLabel="Classer"
        actionIcon={<Zap size={14} />}
        actionClassName="bg-violet-600 text-white"
        contentClassName="bg-card"
        className="rounded-xl"
      >
        {row}
      </SwipeableRow>
    );
  }
  return row;
}

// ───────────────────────────────────────────────────────────────────────────

function ActionPill({
  onClick, disabled, tone, active, icon, label, chevron, tooltip,
}: {
  onClick: () => void;
  disabled?: boolean;
  tone: "emerald" | "amber" | "sky";
  active?: boolean;
  icon: React.ReactNode;
  label: string;
  chevron?: boolean;
  tooltip?: string;
}) {
  const TONES: Record<typeof tone, { active: string; idle: string }> = {
    emerald: {
      active: "bg-emerald-600 text-white",
      idle:   "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20",
    },
    amber: {
      active: "bg-amber-600 text-white",
      idle:   "text-amber-700 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:bg-amber-500/10 dark:hover:bg-amber-500/20",
    },
    sky: {
      active: "bg-sky-600 text-white",
      idle:   "text-sky-700 bg-sky-50 hover:bg-sky-100 dark:text-sky-300 dark:bg-sky-500/10 dark:hover:bg-sky-500/20",
    },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-body font-medium rounded-full px-2 py-0.5 transition-colors",
        active ? TONES[tone].active : TONES[tone].idle,
        disabled && "opacity-40 cursor-not-allowed hover:bg-transparent",
      )}
    >
      {icon}
      {label}
      {chevron && <ChevronDown size={9} className={cn("transition-transform", active && "rotate-180")} />}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function ObjectivePicker({
  objectives, hint, onPick, onCancel, modeLabel,
}: {
  objectives: UnifiedObjective[];
  hint: string | null;
  onPick: (obj: UnifiedObjective) => void;
  onCancel: () => void;
  modeLabel: string;
}) {
  const [filter, setFilter] = useState("");
  // Pre-score: if hint matches any objective text, surface it first
  const sorted = useMemo(() => {
    const hintLower = (hint ?? "").toLowerCase();
    const filterLower = filter.toLowerCase();
    return [...objectives]
      .filter(o => !filterLower || o.text.toLowerCase().includes(filterLower) || (o.category ?? "").toLowerCase().includes(filterLower))
      .sort((a, b) => {
        if (hintLower) {
          const am = a.text.toLowerCase().includes(hintLower) ? 0 : 1;
          const bm = b.text.toLowerCase().includes(hintLower) ? 0 : 1;
          if (am !== bm) return am - bm;
        }
        return a.text.localeCompare(b.text);
      });
  }, [objectives, hint, filter]);

  return (
    <div className="mt-2.5 ml-[18px] rounded-lg border border-border/60 bg-background/60 p-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">
          → {modeLabel} sous…
        </span>
        <input
          autoFocus
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrer…"
          className="flex-1 text-xs font-body bg-transparent border-b border-border/40 focus:outline-none focus:border-primary/60 px-1 py-0.5"
        />
        <button
          onClick={onCancel}
          className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5"
          aria-label="Annuler"
        >
          <X size={12} />
        </button>
      </div>
      {sorted.length === 0 ? (
        <div className="text-[11px] font-body text-muted-foreground/60 italic px-2 py-2">
          Aucun objectif trouvé.
        </div>
      ) : (
        <ul className="max-h-[160px] overflow-y-auto space-y-0.5 -mx-1">
          {sorted.slice(0, 30).map(o => (
            <li key={`${o.source}:${o.id}`}>
              <button
                onClick={() => onPick(o)}
                className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/70 transition-colors group"
              >
                <span className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  o.source === "admin" ? "bg-indigo-400" : "bg-rose-400",
                )} />
                <span className="text-xs font-body text-foreground truncate flex-1">{o.text}</span>
                {o.category && (
                  <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[100px]">
                    {o.category}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

/** Picker that lets the user route a capture to either a project (creates
 *  a meeting_note) or an objective (creates an objective_note). Two
 *  visually-distinct sections so the destination type is obvious. */
function NoteTargetPicker({
  projects, objectives, hint, onPick, onCancel,
}: {
  projects: StoredProject[];
  objectives: UnifiedObjective[];
  hint: string | null;
  onPick: (target: NoteTarget) => void;
  onCancel: () => void;
}) {
  const [filter, setFilter] = useState("");
  const hintLower = (hint ?? "").toLowerCase();
  const filterLower = filter.toLowerCase().trim();

  const filteredProjects = useMemo(() => {
    return projects
      .filter((p) => !filterLower
        || p.title.toLowerCase().includes(filterLower)
        || (p.client ?? "").toLowerCase().includes(filterLower))
      .sort((a, b) => {
        if (hintLower) {
          const am = a.title.toLowerCase().includes(hintLower) ? 0 : 1;
          const bm = b.title.toLowerCase().includes(hintLower) ? 0 : 1;
          if (am !== bm) return am - bm;
        }
        return 0;
      });
  }, [projects, hintLower, filterLower]);

  const filteredObjectives = useMemo(() => {
    return objectives
      .filter((o) => !filterLower
        || o.text.toLowerCase().includes(filterLower)
        || (o.category ?? "").toLowerCase().includes(filterLower))
      .sort((a, b) => {
        if (hintLower) {
          const am = a.text.toLowerCase().includes(hintLower) ? 0 : 1;
          const bm = b.text.toLowerCase().includes(hintLower) ? 0 : 1;
          if (am !== bm) return am - bm;
        }
        return a.text.localeCompare(b.text);
      });
  }, [objectives, hintLower, filterLower]);

  const total = filteredProjects.length + filteredObjectives.length;

  return (
    <div className="mt-2.5 ml-[18px] rounded-lg border border-border/60 bg-background/60 p-2 space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground">
          → Note sur…
        </span>
        <input
          autoFocus
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer projets + objectifs…"
          className="flex-1 text-xs font-body bg-transparent border-b border-border/40 focus:outline-none focus:border-primary/60 px-1 py-0.5"
        />
        <button
          onClick={onCancel}
          className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5"
          aria-label="Annuler"
        >
          <X size={12} />
        </button>
      </div>

      {total === 0 ? (
        <div className="text-[11px] font-body text-muted-foreground/60 italic px-2 py-2">
          Aucun résultat.
        </div>
      ) : (
        <div className="max-h-[200px] overflow-y-auto -mx-1 space-y-2">
          {filteredProjects.length > 0 && (
            <div>
              <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/60 px-2 mb-0.5">
                Projets · {filteredProjects.length}
              </p>
              <ul className="space-y-0.5">
                {filteredProjects.slice(0, 20).map((p) => (
                  <li key={`project:${p.id}`}>
                    <button
                      onClick={() => onPick({ kind: "project", project: p })}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/70 transition-colors group"
                    >
                      <FolderKanban size={11} className="text-indigo-500 shrink-0" />
                      <span className="text-xs font-body text-foreground truncate flex-1">
                        {p.title || "Sans titre"}
                      </span>
                      {p.client && (
                        <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[100px]">
                          {p.client}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {filteredObjectives.length > 0 && (
            <div>
              <p className="text-[9px] font-display font-bold uppercase tracking-wider text-muted-foreground/60 px-2 mb-0.5">
                Objectifs · {filteredObjectives.length}
              </p>
              <ul className="space-y-0.5">
                {filteredObjectives.slice(0, 20).map((o) => (
                  <li key={`objective:${o.source}:${o.id}`}>
                    <button
                      onClick={() => onPick({ kind: "objective", objective: o })}
                      className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-secondary/70 transition-colors group"
                    >
                      <Target size={11} className={o.source === "admin" ? "text-indigo-500" : "text-rose-500"} />
                      <span className="text-xs font-body text-foreground truncate flex-1">{o.text}</span>
                      {o.category && (
                        <span className="text-[10px] font-mono text-muted-foreground/50 truncate max-w-[100px]">
                          {o.category}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
