import { useCallback, useEffect, useRef, useState } from "react";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  LayoutGrid, Loader2, Plus, RotateCw, Trash2, Download, CheckCheck, Check,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { bufferFile, formatBytes, MAX_PDF_SIZE } from "./helpers";
import { SortableItem } from "./SortableItem";
import {
  openForRender, renderThumbnail, assemblePdf, downloadFile,
  type RenderDoc, type PageRef,
} from "./pdfPages";

interface PdfPageEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** PDFs to seed the editor with, already buffered into memory. May be empty —
   *  the user then adds files from inside the editor. */
  initialFiles: File[];
  /** True while the parent is still buffering the seed files. */
  preparing: boolean;
  /** Receives the single assembled PDF once the user is done. */
  onMerged: (file: File) => void;
}

interface PageEntry {
  id: string;          // stable id for dnd-kit
  srcId: string;       // which source document this page came from
  pageIndex: number;   // 0-based index within that source
  rotation: number;    // 0 / 90 / 180 / 270 applied on top of the original
  thumb: string | null;
  selected: boolean;
}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/**
 * Page-level PDF editor. Renders every page of the supplied PDF(s) as a
 * thumbnail grid, then lets the user:
 *   • reorder pages by drag (finger-friendly via dnd-kit TouchSensor),
 *   • rotate / delete individual pages or a multi-selection,
 *   • add pages from more PDFs (merge in),
 *   • extract a selection to a separate downloaded PDF (split),
 *   • finish → one assembled PDF handed back to the filing flow.
 *
 * Replaces the older file-level BatchAssembleDialog. All processing is
 * client-side (pdfjs renders, pdf-lib assembles).
 */
export function PdfPageEditorDialog({
  open, onOpenChange, initialFiles, preparing, onMerged,
}: PdfPageEditorDialogProps) {
  const { toast } = useToast();
  const [entries, setEntries] = useState<PageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const addRef = useRef<HTMLInputElement>(null);

  // In-memory state that must survive re-renders without re-triggering effects.
  const sourcesRef = useRef<Map<string, ArrayBuffer>>(new Map()); // bytes for pdf-lib
  const docsRef = useRef<Map<string, RenderDoc>>(new Map());      // pdfjs docs for rendering
  const baseNameRef = useRef<string>("");                          // output filename seed
  const pageSeq = useRef(0);
  const srcSeq = useRef(0);
  const loadedRef = useRef(false);   // have we seeded this open-cycle yet?
  const renderToken = useRef(0);     // bumped to cancel in-flight renders on close

  const busy = loading || working || preparing;

  // ── Loading / teardown ───────────────────────────────────────────
  const addSources = useCallback(async (files: File[], token: number) => {
    const fresh: PageEntry[] = [];
    const toRender: { id: string; srcId: string; pageIndex: number }[] = [];
    for (const file of files) {
      const bytes = await file.arrayBuffer();
      const srcId = `src-${++srcSeq.current}`;
      sourcesRef.current.set(srcId, bytes);
      if (!baseNameRef.current) baseNameRef.current = file.name.replace(/\.pdf$/i, "");
      const doc = await openForRender(bytes);
      docsRef.current.set(srcId, doc);
      for (let i = 0; i < doc.numPages; i++) {
        const id = `pg-${++pageSeq.current}`;
        fresh.push({ id, srcId, pageIndex: i, rotation: 0, thumb: null, selected: false });
        toRender.push({ id, srcId, pageIndex: i });
      }
    }
    if (renderToken.current !== token) return;
    setEntries((prev) => [...prev, ...fresh]);

    // Render thumbnails one at a time so the worker stays responsive and pages
    // fill in top-to-bottom. Stale renders bail out via the token check.
    for (const item of toRender) {
      if (renderToken.current !== token) return;
      const doc = docsRef.current.get(item.srcId);
      if (!doc) continue;
      try {
        const thumb = await renderThumbnail(doc, item.pageIndex + 1);
        if (renderToken.current !== token) return;
        setEntries((prev) => prev.map((e) => (e.id === item.id ? { ...e, thumb } : e)));
      } catch {
        /* leave the placeholder spinner — a single page failing isn't fatal */
      }
    }
  }, []);

  const teardown = useCallback(() => {
    renderToken.current++;
    docsRef.current.forEach((d) => { void d.destroy().catch(() => {}); });
    docsRef.current.clear();
    sourcesRef.current.clear();
    baseNameRef.current = "";
    loadedRef.current = false;
    setEntries([]);
    setLoading(false);
    setWorking(false);
  }, []);

  // Seed once the parent has finished buffering (preparing → false). Tearing
  // down on close frees the pdfjs documents.
  useEffect(() => {
    if (!open) {
      if (loadedRef.current) teardown();
      return;
    }
    if (preparing || loadedRef.current) return;
    loadedRef.current = true;
    if (initialFiles.length === 0) return;
    const token = renderToken.current;
    setLoading(true);
    void addSources(initialFiles, token)
      .catch(() => toast({ title: "Erreur", description: "Impossible d'ouvrir le PDF.", variant: "destructive" }))
      .finally(() => { if (renderToken.current === token) setLoading(false); });
  }, [open, preparing, initialFiles, addSources, teardown, toast]);

  // ── dnd ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
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

  // ── Page operations ──────────────────────────────────────────────
  const selectedCount = entries.filter((e) => e.selected).length;

  const toggleSelect = (id: string) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, selected: !e.selected } : e)));
  const selectAll = () => setEntries((prev) => prev.map((e) => ({ ...e, selected: true })));
  const clearSelection = () => setEntries((prev) => prev.map((e) => ({ ...e, selected: false })));
  const rotateOne = (id: string) =>
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, rotation: (e.rotation + 90) % 360 } : e)));
  const removeOne = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));
  const rotateSelected = () =>
    setEntries((prev) => prev.map((e) => (e.selected ? { ...e, rotation: (e.rotation + 90) % 360 } : e)));
  const removeSelected = () => setEntries((prev) => prev.filter((e) => !e.selected));

  async function addMore(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []).filter(isPdf);
    e.target.value = "";
    if (picked.length === 0) return;
    setLoading(true);
    const token = renderToken.current;
    try {
      // Buffer immediately — Android revokes the content URI after an await gap.
      const buffered = await Promise.all(picked.map(bufferFile));
      await addSources(buffered, token);
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ajouter le PDF.", variant: "destructive" });
    } finally {
      if (renderToken.current === token) setLoading(false);
    }
  }

  async function extractSelected() {
    const selected = entries.filter((e) => e.selected);
    if (selected.length === 0) return;
    setWorking(true);
    try {
      const refs: PageRef[] = selected.map((e) => ({ srcId: e.srcId, pageIndex: e.pageIndex, rotation: e.rotation }));
      const base = baseNameRef.current || "document";
      const file = await assemblePdf(refs, sourcesRef.current, `${base}-extrait.pdf`);
      downloadFile(file);
      toast({
        title: "Extrait téléchargé",
        description: `${selected.length} page${selected.length > 1 ? "s" : ""} → ${file.name}`,
      });
    } catch {
      toast({ title: "Échec de l'extraction", description: "Impossible de générer le PDF.", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  }

  async function handleFinish() {
    if (entries.length === 0) return;
    setWorking(true);
    try {
      const refs: PageRef[] = entries.map((e) => ({ srcId: e.srcId, pageIndex: e.pageIndex, rotation: e.rotation }));
      const base = baseNameRef.current || "document";
      const file = await assemblePdf(refs, sourcesRef.current, `${base}.pdf`);
      if (file.size > MAX_PDF_SIZE) {
        toast({
          title: "Document trop lourd",
          description: `Le PDF fait ${formatBytes(file.size)} (max 25 Mo).`,
          variant: "destructive",
        });
        return;
      }
      onMerged(file);
    } catch {
      toast({ title: "Échec de l'assemblage", description: "Un des PDF n'a pas pu être lu.", variant: "destructive" });
    } finally {
      setWorking(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────
  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => { if (!working) onOpenChange(v); }}>
      <ResponsiveDialogContent className="max-w-3xl font-body">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <LayoutGrid size={17} className="text-primary" />
            Éditer les pages
            {entries.length > 0 && (
              <span className="text-muted-foreground font-normal text-sm">· {entries.length} page{entries.length > 1 ? "s" : ""}</span>
            )}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-3 py-1">
          {/* Toolbar */}
          {entries.length > 0 && (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                disabled={busy}
                onClick={selectedCount === entries.length ? clearSelection : selectAll}
              >
                <CheckCheck size={14} />
                {selectedCount === entries.length ? "Tout désélectionner" : "Tout sélectionner"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                disabled={busy}
                onClick={() => addRef.current?.click()}
              >
                <Plus size={14} /> Ajouter un PDF
              </Button>
            </div>
          )}

          {/* Selection action bar */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 flex-wrap rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-xs font-medium text-primary mr-auto">
                {selectedCount} sélectionnée{selectedCount > 1 ? "s" : ""}
              </span>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" disabled={busy} onClick={rotateSelected}>
                <RotateCw size={13} /> Pivoter
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" disabled={busy} onClick={extractSelected}>
                <Download size={13} /> Extraire
              </Button>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive" disabled={busy} onClick={removeSelected}>
                <Trash2 size={13} /> Supprimer
              </Button>
            </div>
          )}

          {/* Body */}
          {preparing || (loading && entries.length === 0) ? (
            <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">{preparing ? "Préparation des fichiers…" : "Chargement des pages…"}</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-14 space-y-3">
              <p className="text-sm text-muted-foreground">Aucune page — ajoute un PDF pour commencer.</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addRef.current?.click()}>
                <Plus size={14} /> Ajouter un PDF
              </Button>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Glisse pour réordonner · touche une page pour la sélectionner · survole pour pivoter/supprimer.
              </p>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={entries.map((e) => e.id)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[56vh] md:max-h-[50vh] overflow-y-auto p-0.5">
                    {entries.map((entry, i) => (
                      <SortableItem key={entry.id} id={entry.id}>
                        {({ handleProps, isDragging }) => (
                          <div
                            {...handleProps}
                            onClick={() => !busy && toggleSelect(entry.id)}
                            className={cn(
                              "group relative rounded-xl border bg-background overflow-hidden cursor-grab active:cursor-grabbing select-none touch-none transition-shadow",
                              entry.selected ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/40",
                              isDragging && "shadow-lg",
                            )}
                          >
                            {/* Order number */}
                            <span className="absolute top-1 left-1 z-10 w-5 h-5 rounded-md bg-foreground/75 text-background text-[10px] font-bold flex items-center justify-center">
                              {i + 1}
                            </span>
                            {/* Selected check */}
                            {entry.selected && (
                              <span className="absolute top-1 right-1 z-10 w-5 h-5 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
                                <Check size={13} />
                              </span>
                            )}
                            {/* Thumbnail */}
                            <div className="aspect-[3/4] flex items-center justify-center bg-secondary/40 overflow-hidden">
                              {entry.thumb ? (
                                <img
                                  src={entry.thumb}
                                  alt={`Page ${i + 1}`}
                                  draggable={false}
                                  className="max-h-full max-w-full object-contain transition-transform duration-200"
                                  style={{ transform: `rotate(${entry.rotation}deg)` }}
                                />
                              ) : (
                                <Loader2 size={16} className="animate-spin text-muted-foreground/60" />
                              )}
                            </div>
                            {/* Hover quick actions (desktop) */}
                            <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); if (!busy) rotateOne(entry.id); }}
                                className="w-7 h-7 rounded-lg bg-background/90 border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-primary"
                                title="Pivoter"
                                aria-label="Pivoter la page"
                              >
                                <RotateCw size={13} />
                              </button>
                              <button
                                type="button"
                                onPointerDown={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); if (!busy) removeOne(entry.id); }}
                                className="w-7 h-7 rounded-lg bg-background/90 border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-destructive"
                                title="Supprimer"
                                aria-label="Supprimer la page"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </SortableItem>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            </>
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
          <Button variant="ghost" disabled={working} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button className="gap-1.5" disabled={busy || entries.length === 0} onClick={handleFinish}>
            {working ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Terminer{entries.length > 0 ? ` (${entries.length})` : ""}
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
