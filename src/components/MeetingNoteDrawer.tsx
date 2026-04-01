import { useState, useEffect } from "react";
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
  type MeetingNote,
} from "@/api/meetingNotes";
import {
  NotebookPen,
  X,
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string;
}

export function MeetingNoteDrawer({ projectId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  return (
    <>
      {/* FAB trigger */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 md:bottom-6 md:right-6 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center no-print"
        title="Notes de réunion"
      >
        <NotebookPen size={20} />
      </button>

      {/* Drawer overlay */}
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
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col"
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
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Edit form */}
                {editingId && (
                  <div className="bg-card border border-primary/20 rounded-xl p-4 space-y-3">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Titre de la note…"
                      className="font-body text-sm h-9"
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
                      className="min-h-[120px] resize-y font-body text-sm"
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
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-body mt-0.5">
                            <CalendarDays size={10} />
                            {note.meetingDate
                              ? new Date(note.meetingDate).toLocaleDateString("fr-CH")
                              : "-"}
                          </div>
                        </button>
                        <div className="flex items-center gap-0.5 shrink-0">
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
