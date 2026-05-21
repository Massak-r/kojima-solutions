import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  FileText, ArrowUp, ArrowDown, X, Plus, Loader2, Layers, ExternalLink,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bufferFile, mergePdfs, formatBytes, MAX_PDF_SIZE } from "./helpers";

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

/**
 * Collects several scanned PDFs, lets the user order them (page 1, 2, 3…) and
 * merges them into one document. The merged file is handed back to the parent,
 * which then runs it through the normal "where to file" flow.
 */
export function BatchAssembleDialog({
  open, onOpenChange, initialFiles, preparing, onMerged,
}: BatchAssembleDialogProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [merging, setMerging] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  // Seed the working list whenever the dialog opens with a fresh set of files.
  useEffect(() => {
    if (open) setFiles(initialFiles);
  }, [open, initialFiles]);

  const busy = merging || preparing;

  function move(index: number, dir: -1 | 1) {
    setFiles((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function remove(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function addMore(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter(
      (f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name),
    );
    e.target.value = "";
    if (picked.length === 0) return;
    try {
      const buffered = await Promise.all(picked.map(bufferFile));
      setFiles((prev) => [...prev, ...buffered]);
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
    if (files.length < 2) return;
    setMerging(true);
    try {
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
    <Dialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <DialogContent className="max-w-md font-body">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers size={17} className="text-primary" />
            Assembler un document
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-xs text-muted-foreground">
            Mets les PDF dans l'ordre des pages — ils seront fusionnés en un seul document.
          </p>

          {preparing ? (
            <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Préparation des fichiers…</span>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">
              Aucun PDF pour l'instant — ajoute-en au moins deux.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[46vh] overflow-y-auto">
              {files.map((file, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl border border-border p-2">
                  <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <FileText size={14} className="text-destructive/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</p>
                  </div>
                  <button
                    onClick={() => viewFile(file)}
                    disabled={busy}
                    className="p-1 text-muted-foreground hover:text-primary disabled:opacity-40 transition-colors"
                    title="Voir le PDF"
                  >
                    <ExternalLink size={13} />
                  </button>
                  <button
                    onClick={() => move(i, -1)}
                    disabled={busy || i === 0}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors"
                    title="Monter"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={busy || i === files.length - 1}
                    className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-25 transition-colors"
                    title="Descendre"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    onClick={() => remove(i)}
                    disabled={busy}
                    className="p-1 text-muted-foreground hover:text-destructive disabled:opacity-40 transition-colors"
                    title="Retirer"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
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

        <DialogFooter>
          <Button variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button className="gap-1.5" disabled={busy || files.length < 2} onClick={handleMerge}>
            {merging ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
            Fusionner{files.length >= 2 ? ` (${files.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
