import { useEffect, useMemo, useRef, useState } from "react";
import { Pin, PinOff, Trash2, Plus, Pencil, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { listNotes, createNote, updateNote, deleteNote, type ObjectiveNote } from "@/api/objectiveNotes";
import type { ObjectiveSource } from "@/api/objectiveSource";

interface NotesPanelProps {
  source: ObjectiveSource;
  objectiveId: string;
}

export function NotesPanel({ source, objectiveId }: NotesPanelProps) {
  const [notes,   setNotes]   = useState<ObjectiveNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    listNotes(source, objectiveId)
      .then(setNotes)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [source, objectiveId]);

  const sorted = useMemo(
    () => [...notes].sort((a, b) => (b.pinned === a.pinned ? (b.updatedAt.localeCompare(a.updatedAt)) : (b.pinned ? 1 : -1))),
    [notes],
  );

  async function handleAdd() {
    const temp: ObjectiveNote = {
      id: crypto.randomUUID(),
      source, objectiveId,
      title: "",
      content: "",
      pinned: notes.length === 0,  // auto-pin the first note
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setNotes(prev => [temp, ...prev]);
    try {
      const real = await createNote({ source, objectiveId, title: "", content: "", pinned: temp.pinned });
      setNotes(prev => prev.map(n => n.id === temp.id ? real : n));
    } catch {}
  }

  function handlePatch(id: string, patch: Partial<Pick<ObjectiveNote, 'title'|'content'|'pinned'>>) {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n));
    updateNote(id, patch).catch(() => {});
  }

  async function handleDelete(id: string) {
    setNotes(prev => prev.filter(n => n.id !== id));
    setConfirmDelete(null);
    try { await deleteNote(id); } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-display font-bold text-foreground/60 uppercase tracking-wider">
          {notes.length === 0 ? "Aucune note" : `${notes.length} note${notes.length > 1 ? "s" : ""}`}
        </div>
        <Button size="sm" variant="outline" onClick={handleAdd} className="h-8 rounded-full">
          <Plus size={14} className="mr-1" /> Nouvelle note
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : sorted.length === 0 ? (
        <button
          onClick={handleAdd}
          className="w-full rounded-2xl border border-dashed border-border/40 hover:border-border/70 hover:bg-card/40 p-6 sm:p-8 text-center transition-all"
        >
          <div className="text-sm font-body text-muted-foreground">
            Cliquez pour ajouter votre première note.
          </div>
          <div className="text-xs font-body text-muted-foreground/50 mt-1">
            Contexte, idées, notes de réunion, décisions…
          </div>
        </button>
      ) : (
        <div className="space-y-3">
          {sorted.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              onPatch={patch => handlePatch(note.id, patch)}
              onDelete={() => setConfirmDelete(note.id)}
              confirming={confirmDelete === note.id}
              onCancelDelete={() => setConfirmDelete(null)}
              onConfirmDelete={() => handleDelete(note.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onPatch, onDelete, confirming, onCancelDelete, onConfirmDelete }: {
  note: ObjectiveNote;
  onPatch: (patch: Partial<Pick<ObjectiveNote, 'title'|'content'|'pinned'>>) => void;
  onDelete: () => void;
  confirming: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const [title,   setTitle]   = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [editing, setEditing] = useState(note.content.length === 0); // auto-edit empty notes
  const titleTimer = useRef<number | null>(null);
  const contentTimer = useRef<number | null>(null);

  useEffect(() => { setTitle(note.title); }, [note.title]);
  useEffect(() => { setContent(note.content); }, [note.content]);

  function scheduleTitleSave(value: string) {
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(() => {
      if (value !== note.title) onPatch({ title: value });
    }, 500);
  }
  function scheduleContentSave(value: string) {
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = window.setTimeout(() => {
      if (value !== note.content) onPatch({ content: value });
    }, 500);
  }

  return (
    <div className={cn(
      "rounded-2xl border bg-card/40 p-4 transition-all",
      note.pinned ? "border-amber-400/40 bg-amber-50/30 dark:bg-amber-500/5" : "border-border/40",
    )}>
      <div className="flex items-center gap-2 mb-2">
        <input
          type="text"
          placeholder="Titre de la note (optionnel)"
          value={title}
          onChange={e => { setTitle(e.target.value); scheduleTitleSave(e.target.value); }}
          onBlur={() => { if (title !== note.title) onPatch({ title }); }}
          className="flex-1 text-sm font-display font-bold bg-transparent border-none px-0 py-1 focus:outline-none placeholder:text-muted-foreground/40 text-foreground"
        />
        <button
          onClick={() => setEditing(v => !v)}
          className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground transition-colors"
          title={editing ? "Aperçu" : "Éditer"}
        >
          {editing ? <Eye size={13} /> : <Pencil size={13} />}
        </button>
        <button
          onClick={() => onPatch({ pinned: !note.pinned })}
          className={cn(
            "p-1.5 rounded-lg transition-all",
            note.pinned ? "text-amber-600 hover:text-amber-700" : "text-muted-foreground/40 hover:text-amber-500",
          )}
          title={note.pinned ? "Détacher" : "Épingler"}
        >
          {note.pinned ? <Pin size={14} className="fill-current" /> : <PinOff size={14} />}
        </button>
        {confirming ? (
          <div className="flex gap-1">
            <Button size="sm" variant="destructive" className="h-7 px-2.5 text-[11px] rounded-md" onClick={onConfirmDelete}>Supprimer</Button>
            <Button size="sm" variant="ghost" className="h-7 px-2.5 text-[11px] rounded-md" onClick={onCancelDelete}>Annuler</Button>
          </div>
        ) : (
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive transition-colors"
            title="Supprimer"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {editing ? (
        <textarea
          placeholder="Écrivez vos notes… (markdown supporté : **gras**, *italique*, # titres, - listes, [liens](url))"
          value={content}
          onChange={e => { setContent(e.target.value); scheduleContentSave(e.target.value); }}
          onBlur={() => { if (content !== note.content) onPatch({ content }); }}
          autoFocus={content.length === 0}
          className="w-full text-sm font-body bg-transparent border-none px-0 py-1 focus:outline-none resize-none text-foreground/80 leading-relaxed"
          rows={Math.max(3, Math.min(24, content.split("\n").length + 1))}
        />
      ) : content.trim() ? (
        <div
          className="prose prose-sm dark:prose-invert max-w-none text-foreground/85 font-body cursor-text"
          onClick={() => setEditing(true)}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="text-xs font-body text-muted-foreground/50 hover:text-muted-foreground italic"
        >
          Note vide — cliquez pour éditer…
        </button>
      )}

      <div className="text-[10px] font-mono text-muted-foreground/50 tabular-nums mt-2">
        {new Date(note.updatedAt).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })}
      </div>
    </div>
  );
}
