import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  FileText, X, Plus, Loader2, Layers, ExternalLink, GripVertical,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { useToast } from "@/hooks/use-toast";
import { bufferFile, mergePdfs, formatBytes, MAX_PDF_SIZE } from "./helpers";
import { SortableItem } from "./SortableItem";

interface BatchAssembleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PDFs dropped together, already buffered into memory. */
  initialFiles: File[];
  /** True while the parent is still buffering the dropped files. */
  preparing: boolean;
  /** Called with the single merged PDF once the user confirms. */
  onMerged: (file: File) => void;
}

/** Stable client-side IDs for in-memory files (kept separately so re-renders
 * don't reshuffle dnd-kit's identity). */
type Entry = { id: string; file: File };

let entrySeq = 0;
const wrap = (file: File): Entry => ({ id: `pdf-${++entrySeq}`, file });

/**
 * Collects several scanned PDFs, lets the user order them (page 1, 2, 3…) and
 * merges them into one document. The merged file is handed back to the parent,
 * which then runs it through the normal "where to file" flow.
 *
 * Reorder is finger-friendly: drag handle on the left, dnd-kit handles touch
 * via TouchSensor so it works equally well in the PWA on mobile.
 */
export function BatchAssembleDialog({
  open, onOpenChange, initialFiles, preparing, onMerged,
}: BatchAssembleDialogProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [merging, setMerging] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  // Seed working list whenever the dialog opens with a fresh set of files.
  useEffect(() => {
    if (open) setEntries(initialFiles.map(wrap));
  }, [open, initialFiles]);

  const busy = merging || preparing;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEntries((prev) => {
      const oldIndex = prev.findIndex((e) => e.id === active.id);
      const newIndex = prev.findIndex((e) => e.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  function remove(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  async function addMore(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter(
      (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
    );
    e.target.value = "";
    if (picked.length === 0) return;
    try {
      const buffered = await Promise.all(picked.map(bufferFile));
      setEntries((prev) => [...prev, ...buffered.map(wrap)]);
    } catch {
      toast({ title: "Erreur", description: "Impossible de lire le fichier.", variant: "destructive" });
    }
  }

  function viewFile(file: File) {
    const url = URL.createObjectURL(file);
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function handleMerge() {
    if (entries.length < 2) return;
    setMerging(true);
    try {
      const files = entries.map((e) => e.file);
      const base = files[0].name.replace(/\.pdf$/i, "").trim() || "document";
      const merged = await mergePdfs(files, `${base}.pdf`);
      if (merged.size > MAX_PDF_SIZE) {
        toast({
          title: "Document trop lourd",
          description: `Le PDF fusionné fait ${formatBytes(merged.size)} (max 25 Mo).`,
          variant: "destructive",
        });
        return;
      }
      onMerged(merged);
    } catch {
      toast({
        title: "Échec de la fusion",
        description: "Un des PDF n'a pas pu être lu. Vérifie qu'ils sont valides.",
        variant: "destructive",
      });
    } finally {
      setMerging(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <ResponsiveDialogContent className="max-w-md font-body">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Layers size={17} className="text-primary" />
            Assembler un document
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground">
            Mets les PDF dans l'ordre des pages — ils seront fusionnés en un seul document.
            Glisse la poignée à gauche pour réordonner.
          </p>

          {preparing ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Préparation des fichiers…</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Aucun PDF pour l'instant — ajoute-en au moins deux.
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={entries.map((e) => e.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5 max-h-[55vh] md:max-h-[46vh] overflow-y-auto">
                  {entries.map((entry, i) => (
                    <SortableItem key={entry.id} id={entry.id}>
                      {({ handleProps }) => (
                        <div className="flex items-center gap-2 rounded-xl border border-border p-2 bg-background">
                          <button
                            {...handleProps}
                            disabled={busy}
                            className="p-2 -m-1 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing touch-none disabled:opacity-30"
                            title="Glisser pour réordonner"
                            aria-label="Glisser pour réordonner"
                          >
                            <GripVertical size={16} />
                          </button>
                          <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                            {i + 1}
                          </span>
                          <FileText size={14} className="text-destructive/60 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{entry.file.name}</p>
                            <p className="text-[10px] text-muted-foreground">{formatBytes(entry.file.size)}</p>
                          </div>
                          <button
                            onClick={() => viewFile(entry.file)}
                            disabled={busy}
                            className="p-2 -m-1 text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors"
                            title="Voir le PDF"
                            aria-label="Voir le PDF"
                          >
                            <ExternalLink size={15} />
                          </button>
                          <button
                            onClick={() => remove(entry.id)}
                            disabled={busy}
                            className="p-2 -m-1 text-muted-foreground hover:text-destructive disabled:opacity-40 transition-colors"
                            title="Retirer"
                            aria-label="Retirer du document"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {!preparing && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              disabled={busy}
              onClick={() => addRef.current?.click()}
            >
              <Plus size={14} /> Ajouter un PDF
            </Button>
          )}
          <input
            ref={addRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="hidden"
            onChange={addMore}
          />
        </div>

        <ResponsiveDialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button className="gap-1.5" disabled={busy || entries.length < 2} onClick={handleMerge}>
            {merging ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
            Fusionner{entries.length >= 2 ? ` (${entries.length})` : ""}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
