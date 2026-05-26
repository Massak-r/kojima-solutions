import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  listMeetingNotes,
  createMeetingNote,
  updateMeetingNote,
  deleteMeetingNote,
  setMeetingNoteClaudeIntent,
  type MeetingNote,
} from "@/api/meetingNotes";
import {
  NotebookPen,
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  CalendarDays,
  Maximize2,
  Minimize2,
  Sparkles,
  Check,
  ListChecks,
  ScrollText,
  GitBranch,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateSwiss } from "@/lib/dateFormat";

/** Window event consumed by this drawer. Dispatch with
 *  `window.dispatchEvent(new CustomEvent("open-meeting-notes"))` from
 *  anywhere — QuickActionFAB uses it so it doesn't need a prop drill. */
export const OPEN_MEETING_NOTES_EVENT = "open-meeting-notes";

interface Props {
  projectId: string;
}

export function MeetingNoteDrawer({ projectId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(false);

  // The dedicated FAB used to live here and overlap the QuickActionFAB on
  // mobile. The drawer now opens via a window event triggered from the
  // unified "+" FAB menu (Note de réunion item, project pages only).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_MEETING_NOTES_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_MEETING_NOTES_EVENT, onOpen);
  }, []);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  /** Full-screen mode for distraction-free note-taking. */
  const [fullscreen, setFullscreen] = useState(false);
  /** Drives the inline "Demander à Claude" prompt on the currently-open
   *  note. id is the note id (or "new" while still editing a draft —
   *  in which case the user must save first). */
  const [intentPromptId, setIntentPromptId] = useState<string | null>(null);
  const [intentValue, setIntentValue] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listMeetingNotes(projectId)
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId, open]);

  function startNew() {
    setEditingId("new");
    setTitle("");
    setContent("");
    setMeetingDate(new Date().toISOString().slice(0, 10));
  }

  function startEdit(note: MeetingNote) {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setMeetingDate(note.meetingDate || new Date().toISOString().slice(0, 10));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId === "new") {
        const note = await createMeetingNote({
          projectId,
          title,
          content,
          meetingDate,
        });
        setNotes((prev) => [note, ...prev]);
        toast({ title: "Note créée" });
      } else if (editingId) {
        const updated = await updateMeetingNote(editingId, { title, content, meetingDate });
        setNotes((prev) => prev.map((n) => (n.id === editingId ? updated : n)));
        toast({ title: "Note mise à jour" });
      }
      setEditingId(null);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteMeetingNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setDeleteConfirm(null);
      if (editingId === id) setEditingId(null);
      toast({ title: "Note supprimée" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  /** Flag a note for Claude Code MCP processing. The slash command
   *  `/process-meeting-notes` picks them up via the pending_claude endpoint. */
  async function flagForClaude(id: string, intent: string) {
    const trimmed = intent.trim();
    if (!trimmed) return;
    try {
      const updated = await setMeetingNoteClaudeIntent(id, trimmed);
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      setIntentPromptId(null);
      setIntentValue("");
      // Refresh the home badge so the count updates without a page reload.
      qc.invalidateQueries({ queryKey: ["meeting-notes-pending-claude"] });
      toast({
        title: "Envoyé à Claude",
        description: "Ouvre Claude Code et lance /process-meeting-notes.",
      });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function clearClaudeFlag(id: string) {
    try {
      const updated = await setMeetingNoteClaudeIntent(id, null);
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)));
      qc.invalidateQueries({ queryKey: ["meeting-notes-pending-claude"] });
      toast({ title: "Demande annulée" });
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  return (
    <>
      {/* Drawer overlay — open via window event ("open-meeting-notes") */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={fullscreen ? { opacity: 0, scale: 0.98 } : { x: "100%" }}
              animate={fullscreen ? { opacity: 1, scale: 1 } : { x: 0 }}
              exit={fullscreen ? { opacity: 0, scale: 0.98 } : { x: "100%" }}
              transition={
                fullscreen
                  ? { duration: 0.2, ease: "easeOut" }
                  : { type: "spring", damping: 30, stiffness: 300 }
              }
              className={cn(
                "fixed z-50 bg-background border-border shadow-2xl flex flex-col",
                fullscreen
                  ? "inset-0 sm:inset-4 sm:rounded-2xl sm:border"
                  : "top-0 right-0 bottom-0 w-full sm:max-w-md border-l",
              )}
              style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <NotebookPen size={16} className="text-primary" />
                  <h2 className="font-display text-sm font-bold text-foreground">Notes de réunion</h2>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={startNew}>
                    <Plus size={13} /> Nouvelle
                  </Button>
                  <button
                    onClick={() => setFullscreen((v) => !v)}
                    className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                    title={fullscreen ? "Réduire" : "Plein écran"}
                    aria-label={fullscreen ? "Réduire" : "Plein écran"}
                  >
                    {fullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className={cn(
                "flex-1 overflow-y-auto space-y-3",
                fullscreen ? "px-6 py-5 sm:px-10 sm:py-7" : "p-4",
              )}>
                {/* Edit form */}
                {editingId && (
                  <div className={cn(
                    "bg-card border border-primary/20 rounded-xl space-y-3 flex flex-col",
                    fullscreen ? "p-6 min-h-full" : "p-4",
                  )}>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Titre de la note…"
                      className={cn("font-body", fullscreen ? "text-lg h-11 font-semibold" : "text-sm h-9")}
                    />
                    <Input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="font-body text-sm h-9 w-44"
                    />
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Compte-rendu de la réunion…"
                      className={cn(
                        "font-body resize-y",
                        fullscreen
                          ? "flex-1 min-h-[50vh] sm:min-h-[60vh] text-base leading-relaxed"
                          : "min-h-[120px] text-sm",
                      )}
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8">
                        Annuler
                      </Button>
                      <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8">
                        {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        Sauvegarder
                      </Button>
                    </div>
                  </div>
                )}

                {loading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                  </div>
                ) : notes.length === 0 && !editingId ? (
                  <div className="text-center py-12">
                    <NotebookPen size={28} className="text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground font-body mb-3">Aucune note pour ce projet.</p>
                    <Button size="sm" variant="outline" onClick={startNew} className="gap-1.5">
                      <Plus size={13} /> Créer une note
                    </Button>
                  </div>
                ) : (
                  notes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        "bg-card border border-border rounded-xl p-4 transition-colors",
                        editingId === note.id && "border-primary/30 bg-primary/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <button
                          onClick={() => (editingId === note.id ? cancelEdit() : startEdit(note))}
                          className="text-left flex-1 min-w-0"
                        >
                          <h3 className="font-display text-sm font-semibold text-foreground truncate">
                            {note.title || "Sans titre"}
                          </h3>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-body mt-0.5 flex-wrap">
                            <CalendarDays size={10} />
                            {note.meetingDate
                              ? formatDateSwiss(note.meetingDate)
                              : "-"}
                            {note.claudeIntent && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono rounded-full px-1.5 py-0.5 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                                <Sparkles size={9} />
                                Claude · {note.claudeIntent}
                              </span>
                            )}
                          </div>
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {note.claudeIntent ? (
                            <button
                              onClick={() => clearClaudeFlag(note.id)}
                              className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
                              title="Annuler la demande Claude"
                              aria-label="Annuler la demande Claude"
                            >
                              <X size={12} />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setIntentPromptId(note.id);
                                setIntentValue("");
                              }}
                              className="p-1.5 rounded-md text-muted-foreground/40 hover:text-violet-600 hover:bg-violet-50 dark:hover:text-violet-300 dark:hover:bg-violet-500/10 transition-all"
                              title="Envoyer à Claude (MCP)"
                              aria-label="Envoyer à Claude"
                            >
                              <Sparkles size={12} />
                            </button>
                          )}
                          {deleteConfirm === note.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleDelete(note.id)}
                                className="px-2 py-0.5 rounded text-[10px] bg-destructive text-white font-semibold"
                              >
                                Supprimer
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground"
                              >
                                Annuler
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(note.id)}
                              className="p-1.5 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      {note.content && editingId !== note.id && (
                        <p className="text-xs text-muted-foreground font-body mt-2 whitespace-pre-wrap line-clamp-3">
                          {note.content}
                        </p>
                      )}
                      {intentPromptId === note.id && (
                        <ClaudeIntentPrompt
                          value={intentValue}
                          onValueChange={setIntentValue}
                          onSubmit={() => flagForClaude(note.id, intentValue)}
                          onCancel={() => { setIntentPromptId(null); setIntentValue(""); }}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────────────

interface IntentPreset {
  icon: typeof ListChecks;
  label: string;
  intent: string;
}

const INTENT_PRESETS: IntentPreset[] = [
  { icon: ListChecks, label: "Extraire les actions",  intent: "Extraire les actions à faire (todos) et les pousser comme subtasks de l'objectif lié au projet" },
  { icon: ScrollText, label: "Résumer pour le client", intent: "Résumer pour le client : décisions, prochaines étapes, blockers" },
  { icon: GitBranch,  label: "Extraire les décisions", intent: "Extraire les décisions prises et les archiver comme decisions sur l'objectif lié" },
  { icon: HelpCircle, label: "Libre",                  intent: "" },
];

function ClaudeIntentPrompt({
  value, onValueChange, onSubmit, onCancel,
}: {
  value: string;
  onValueChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 rounded-lg border border-violet-200 dark:border-violet-500/30 bg-violet-50/60 dark:bg-violet-500/8 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Sparkles size={12} className="text-violet-600 dark:text-violet-400" />
        <span className="text-[10px] font-display font-bold uppercase tracking-wider text-violet-700 dark:text-violet-300">
          Envoyer à Claude (MCP)
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {INTENT_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onValueChange(p.intent)}
            className={cn(
              "inline-flex items-center gap-1 text-[10px] font-body rounded-full px-2 py-1 border transition-colors",
              value === p.intent
                ? "border-violet-400 bg-violet-100 text-violet-800 dark:border-violet-400/50 dark:bg-violet-500/20 dark:text-violet-200"
                : "border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-violet-300",
            )}
          >
            <p.icon size={10} />
            {p.label}
          </button>
        ))}
      </div>

      <Textarea
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="Décris ce que tu veux que Claude fasse avec cette note…"
        rows={3}
        className="text-xs font-body resize-none"
      />

      <p className="text-[10px] font-body text-muted-foreground/80 leading-snug">
        La note sera marquée en attente. Ouvre Claude Code et lance{" "}
        <code className="px-1 py-0.5 rounded bg-card border border-border font-mono text-[10px]">/process-meeting-notes</code>{" "}
        pour traiter la file.
      </p>

      <div className="flex items-center justify-end gap-2">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancel}>
          Annuler
        </Button>
        <Button
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={onSubmit}
          disabled={!value.trim()}
        >
          <Check size={11} />
          Envoyer
        </Button>
      </div>
    </div>
  );
}
