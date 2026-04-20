import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Trash2, Plus, FileText, Upload, ExternalLink,
  Loader2, FolderOpen, Archive, X, Pencil, Check,
  Search, FolderPlus, ChevronRight, Home, Link2, Link2Off, Folder, GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  listDocs, uploadDoc, deleteDoc, updateDoc, getDocViewUrl,
  shareDoc, unshareDoc, getShareUrl,
  listFolders, createFolder, updateFolder, deleteFolder,
  shareFolder, unshareFolder, getFolderShareUrl,
  type DocFolderLink,
} from "@/api/adminDocs";
import type { AdminDocItem, DocFolder } from "@/api/adminDocs";

import { RegistreTab } from "@/components/admin/RegistreTab";

// ── Constants ──────────────────────────────────────────────────────────────────

const DOC_CATEGORIES = [
  "Général", "Contrats", "Comptabilité", "Impôts", "Assurances", "RH", "Juridique", "Divers",
];

const YEAR_OPTIONS = (() => {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= current - 6; y--) years.push(y);
  return years;
})();

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " o";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " Ko";
  return (bytes / 1024 / 1024).toFixed(1) + " Mo";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Sortable wrapper ──────────────────────────────────────────────────────────

function SortableItem({ id, children }: { id: string; children: (props: { handleProps: Record<string, unknown>; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: "relative" as const, zIndex: isDragging ? 50 : undefined };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ handleProps: { ...attributes, ...listeners }, isDragging })}
    </div>
  );
}

/** Render text with **bold** and line breaks */
function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
        }
        return part.split("\n").map((line, j, arr) => (
          <span key={`${i}-${j}`}>{line}{j < arr.length - 1 && <br />}</span>
        ));
      })}
    </span>
  );
}

// ── Documents Tab ─────────────────────────────────────────────────────────────

function DocumentsTab({ defaultFolder }: { defaultFolder?: string | null }) {
  const { toast } = useToast();
  const [docs,        setDocs]        = useState<AdminDocItem[]>([]);
  const [folders,     setFolders]     = useState<DocFolder[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [catFilter,   setCatFilter]   = useState("all");
  const [yearFilter,  setYearFilter]  = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading,   setUploading]   = useState(false);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [editId,      setEditId]      = useState<string | null>(null);
  const [editTitle,   setEditTitle]   = useState("");
  const [editCat,     setEditCat]     = useState("");
  const [editYear,    setEditYear]    = useState<number | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [editFolderSummary, setEditFolderSummary] = useState("");
  const [editFolderLinks, setEditFolderLinks] = useState<DocFolderLink[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Folder navigation
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  useEffect(() => { if (defaultFolder) setCurrentFolderId(defaultFolder); }, [defaultFolder]);

  // Upload dialog state
  const [uploadOpen,  setUploadOpen]  = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCat,   setUploadCat]   = useState("Général");
  const [uploadYear,  setUploadYear]  = useState<string>("none");

  // Drag & drop
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  // New folder dialog
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    Promise.all([listDocs(), listFolders()])
      .then(([d, f]) => { setDocs(d); setFolders(f); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Folder helpers ──
  function getFolderPath(folderId: string | null): DocFolder[] {
    const path: DocFolder[] = [];
    let current = folderId;
    while (current) {
      const folder = folders.find(f => f.id === current);
      if (!folder) break;
      path.unshift(folder);
      current = folder.parentId;
    }
    return path;
  }

  function getFolderName(folderId: string | null): string {
    if (!folderId) return "Racine";
    return folders.find(f => f.id === folderId)?.name ?? "-";
  }

  const subFolders = useMemo(() =>
    folders.filter(f => f.parentId === currentFolderId).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [folders, currentFolderId]
  );

  const breadcrumb = useMemo(() => getFolderPath(currentFolderId), [currentFolderId, folders]);

  // ── Search & filter ──
  const isSearching = searchQuery.trim().length > 0;
  const searchLower = searchQuery.toLowerCase();

  const visibleDocs = useMemo(() => {
    let result = docs;
    // When searching, show across all folders
    if (!isSearching) {
      result = result.filter(d => (d.folderId ?? null) === currentFolderId);
    } else {
      result = result.filter(d => d.title.toLowerCase().includes(searchLower));
    }
    if (catFilter !== "all") result = result.filter(d => d.category === catFilter);
    if (yearFilter !== "all") result = result.filter(d => d.year === yearFilter);
    return result;
  }, [docs, currentFolderId, isSearching, searchLower, catFilter, yearFilter]);

  const years = useMemo(() => {
    const s = new Set(docs.map(d => d.year).filter((y): y is number => y != null));
    return Array.from(s).sort((a, b) => b - a);
  }, [docs]);

  const categories = useMemo(() => {
    const cats = new Set(docs.map(d => d.category));
    return Array.from(cats).sort();
  }, [docs]);

  // Group visible docs by category
  const grouped = useMemo(() => {
    const map: Record<string, AdminDocItem[]> = {};
    visibleDocs.forEach(d => {
      if (!map[d.category]) map[d.category] = [];
      map[d.category].push(d);
    });
    return map;
  }, [visibleDocs]);

  // ── Handlers ──
  function acceptFile(file: File) {
    if (file.type !== "application/pdf") {
      toast({ title: "Erreur", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
      return;
    }
    setPendingFile(file);
    setUploadTitle(file.name.replace(/\.pdf$/i, ""));
    setUploadCat("Général");
    setUploadYear("none");
    setUploadOpen(true);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    acceptFile(file);
    e.target.value = "";
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  }

  async function handleUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const doc = await uploadDoc(
        pendingFile,
        uploadTitle.trim() || pendingFile.name,
        uploadCat,
        currentFolderId,
        uploadYear !== "none" ? Number(uploadYear) : null,
      );
      setDocs(prev => [doc, ...prev]);
      setUploadOpen(false);
      setPendingFile(null);
      toast({ title: "Document ajouté", description: `"${doc.title}" a été enregistré.` });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    if (deleteId !== id) { setDeleteId(id); return; }
    setDocs(prev => prev.filter(d => d.id !== id));
    setDeleteId(null);
    try { await deleteDoc(id); } catch {}
  }

  async function handleDeleteFolder(id: string) {
    if (deleteFolderId !== id) { setDeleteFolderId(id); return; }
    setFolders(prev => prev.filter(f => f.id !== id));
    setDocs(prev => prev.map(d => d.folderId === id ? { ...d, folderId: null } : d));
    setDeleteFolderId(null);
    try { await deleteFolder(id); } catch {}
  }

  async function saveEdit(id: string) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, title: editTitle, category: editCat, year: editYear } : d));
    setEditId(null);
    try { await updateDoc(id, { title: editTitle, category: editCat, year: editYear }); } catch {}
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    try {
      const folder = await createFolder(name, currentFolderId);
      setFolders(prev => [...prev, folder]);
      setFolderDialogOpen(false);
      setNewFolderName("");
      toast({ title: "Dossier créé", description: `"${folder.name}"` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le dossier", variant: "destructive" });
    }
  }

  async function handleRenameFolder(id: string) {
    const name = editFolderName.trim();
    if (!name) return;
    const summary = editFolderSummary.trim() || null;
    const links = editFolderLinks.filter(l => l.url.trim());
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name, summary, links } : f));
    setEditFolderId(null);
    try { await updateFolder(id, { name, summary, links }); } catch {}
  }

  async function handleShare(doc: AdminDocItem) {
    try {
      const updated = await shareDoc(doc.id);
      setDocs(prev => prev.map(d => d.id === doc.id ? updated : d));
      if (updated.shareToken) {
        const url = getShareUrl(updated.shareToken);
        await navigator.clipboard.writeText(url);
        toast({ title: "Lien copié", description: "Le lien de partage a été copié dans le presse-papier." });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer le lien", variant: "destructive" });
    }
  }

  async function handleUnshare(doc: AdminDocItem) {
    try {
      const updated = await unshareDoc(doc.id);
      setDocs(prev => prev.map(d => d.id === doc.id ? updated : d));
      toast({ title: "Lien supprimé", description: "Le document n'est plus partagé." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer le lien", variant: "destructive" });
    }
  }

  async function handleShareFolder(f: DocFolder) {
    try {
      const updated = await shareFolder(f.id);
      setFolders(prev => prev.map(x => x.id === f.id ? updated : x));
      if (updated.shareToken) {
        const url = getFolderShareUrl(updated.shareToken);
        await navigator.clipboard.writeText(url);
        toast({ title: "Lien copié", description: "Le lien du dossier partagé a été copié." });
      }
    } catch {
      toast({ title: "Erreur", description: "Impossible de générer le lien", variant: "destructive" });
    }
  }

  async function handleUnshareFolder(f: DocFolder) {
    try {
      const updated = await unshareFolder(f.id);
      setFolders(prev => prev.map(x => x.id === f.id ? updated : x));
      toast({ title: "Lien supprimé", description: "Le dossier n'est plus partagé." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer le lien", variant: "destructive" });
    }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleFolderDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = subFolders.findIndex(f => f.id === active.id);
    const newIndex = subFolders.findIndex(f => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(subFolders, oldIndex, newIndex);
    // Update sort orders
    const updates = reordered.map((f, i) => ({ ...f, sortOrder: i }));
    setFolders(prev => {
      const updated = new Map(updates.map(u => [u.id, u.sortOrder]));
      return prev.map(f => updated.has(f.id) ? { ...f, sortOrder: updated.get(f.id)! } : f);
    });
    updates.forEach(f => updateFolder(f.id, { sortOrder: f.sortOrder }).catch(() => {}));
  }, [subFolders]);

  const handleDocDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    // Find in visibleDocs sorted
    const sorted = [...visibleDocs].sort((a, b) => a.sortOrder - b.sortOrder);
    const oldIndex = sorted.findIndex(d => d.id === active.id);
    const newIndex = sorted.findIndex(d => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    const updates = reordered.map((d, i) => ({ id: d.id, sortOrder: i }));
    setDocs(prev => {
      const updated = new Map(updates.map(u => [u.id, u.sortOrder]));
      return prev.map(d => updated.has(d.id) ? { ...d, sortOrder: updated.get(d.id)! } : d);
    });
    updates.forEach(u => updateDoc(u.id, { sortOrder: u.sortOrder }).catch(() => {}));
  }, [visibleDocs]);

  return (
    <div
      className="space-y-5 relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Drop overlay */}
      {dragging && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload size={32} className="mx-auto mb-2 text-primary" />
            <p className="font-body text-sm font-semibold text-primary">Déposer le PDF ici</p>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm font-body text-muted-foreground flex-wrap">
        <button onClick={() => setCurrentFolderId(null)} className="hover:text-primary transition-colors flex items-center gap-1">
          <Home size={13} /> Racine
        </button>
        {breadcrumb.map(f => (
          <span key={f.id} className="flex items-center gap-1">
            <ChevronRight size={12} className="opacity-40" />
            <button onClick={() => setCurrentFolderId(f.id)} className="hover:text-primary transition-colors">
              {f.name}
            </button>
          </span>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un document..."
            className="pl-9 h-9 text-sm font-body"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setNewFolderName(""); setFolderDialogOpen(true); }} className="gap-1.5 text-xs">
            <FolderPlus size={14} />
            Dossier
          </Button>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
            <Upload size={14} />
            Ajouter un PDF
          </Button>
        </div>
        <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={onFileChange} />
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setCatFilter("all")}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-body transition-all border",
            catFilter === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          Tous
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            className={cn("px-3 py-1.5 rounded-lg text-xs font-body transition-all border",
              catFilter === cat
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
        {years.length > 0 && (
          <>
            <div className="w-px h-6 bg-border self-center mx-1" />
            <button
              onClick={() => setYearFilter("all")}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-body transition-all border",
                yearFilter === "all"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              Toutes années
            </button>
            {years.map(y => (
              <button
                key={y}
                onClick={() => setYearFilter(y)}
                className={cn("px-3 py-1.5 rounded-lg text-xs font-body transition-all border",
                  yearFilter === y
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                )}
              >
                {y}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {/* Subfolders */}
          {!isSearching && subFolders.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFolderDragEnd}>
              <SortableContext items={subFolders.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {subFolders.map(f => (
                    <SortableItem key={f.id} id={f.id}>
                      {({ handleProps }) => (
                        <div className="glass-card rounded-xl p-4 group cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all">
                          {editFolderId === f.id ? (
                            <div className="space-y-2" onClick={e => e.stopPropagation()}>
                              <Input
                                value={editFolderName}
                                onChange={e => setEditFolderName(e.target.value)}
                                placeholder="Nom du dossier"
                                className="h-8 text-sm font-body"
                                autoFocus
                              />
                              <textarea
                                value={editFolderSummary}
                                onChange={e => setEditFolderSummary(e.target.value)}
                                placeholder="Résumé (optionnel)"
                                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-body resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                                rows={2}
                              />
                              <div className="space-y-1.5">
                                <p className="text-[10px] text-muted-foreground font-body">Liens externes</p>
                                {editFolderLinks.map((link, i) => (
                                  <div key={i} className="flex gap-1.5 items-center">
                                    <Input
                                      value={link.label}
                                      onChange={e => setEditFolderLinks(prev => prev.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                                      placeholder="Libellé"
                                      className="h-7 text-xs font-body flex-1"
                                    />
                                    <Input
                                      value={link.url}
                                      onChange={e => setEditFolderLinks(prev => prev.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                                      placeholder="https://..."
                                      className="h-7 text-xs font-body flex-[2]"
                                    />
                                    <button onClick={() => setEditFolderLinks(prev => prev.filter((_, j) => j !== i))} className="p-1 text-muted-foreground hover:text-destructive shrink-0">
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                ))}
                                <button
                                  onClick={() => setEditFolderLinks(prev => [...prev, { label: "", url: "" }])}
                                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1 font-body"
                                >
                                  <Plus size={11} /> Ajouter un lien
                                </button>
                              </div>
                              <div className="flex gap-1.5 pt-1">
                                <Button size="sm" className="h-7 text-xs px-3" onClick={() => handleRenameFolder(f.id)}>Enregistrer</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs px-3" onClick={() => setEditFolderId(null)}>Annuler</Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-3">
                                <button {...handleProps} className="p-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0" onClick={e => e.stopPropagation()}>
                                  <GripVertical size={14} />
                                </button>
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 relative" onClick={() => setCurrentFolderId(f.id)}>
                                  <Folder size={20} className="text-primary" />
                                  {f.shareToken && <Link2 size={7} className="absolute -top-0.5 -right-0.5 text-primary" />}
                                </div>
                                <span className="font-body text-sm font-medium flex-1 break-words" onClick={() => setCurrentFolderId(f.id)}>{f.name}</span>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                  {f.shareToken ? (
                                    <button onClick={e => { e.stopPropagation(); handleUnshareFolder(f); }} className="p-1 text-primary hover:text-destructive" title="Supprimer le partage"><Link2Off size={11} /></button>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); handleShareFolder(f); }} className="p-1 text-muted-foreground hover:text-primary" title="Partager le dossier"><Link2 size={11} /></button>
                                  )}
                                  <button onClick={e => { e.stopPropagation(); setEditFolderId(f.id); setEditFolderName(f.name); setEditFolderSummary(f.summary ?? ""); setEditFolderLinks(f.links?.length ? [...f.links] : []); }} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={11} /></button>
                                  {deleteFolderId === f.id ? (
                                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                      <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => handleDeleteFolder(f.id)}>OK</Button>
                                      <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setDeleteFolderId(null)}>Non</Button>
                                    </div>
                                  ) : (
                                    <button onClick={e => { e.stopPropagation(); handleDeleteFolder(f.id); }} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={11} /></button>
                                  )}
                                </div>
                              </div>
                              {f.summary && (
                                <div className="text-xs text-muted-foreground font-body mt-2 ml-[3.25rem]">
                                  <RichText text={f.summary} />
                                </div>
                              )}
                              {f.links && f.links.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1.5 ml-[3.25rem]">
                                  {f.links.map((link, i) => (
                                    <a
                                      key={i}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={e => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-primary/8 text-primary hover:bg-primary/15 transition-colors font-body"
                                    >
                                      <ExternalLink size={9} /> {link.label || link.url}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {/* Documents */}
          {visibleDocs.length === 0 && subFolders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-body">{isSearching ? "Aucun résultat." : "Dossier vide. Ajoutez un document ou créez un sous-dossier."}</p>
            </div>
          ) : visibleDocs.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDocDragEnd}>
              <SortableContext items={[...visibleDocs].sort((a, b) => a.sortOrder - b.sortOrder).map(d => d.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {[...visibleDocs].sort((a, b) => a.sortOrder - b.sortOrder).map(doc => (
                    <SortableItem key={doc.id} id={doc.id}>
                      {({ handleProps }) => (
                        <div className="glass-card rounded-2xl p-4 flex items-center gap-4 group">
                          <button {...handleProps} className="p-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
                            <GripVertical size={16} />
                          </button>
                          <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 relative">
                            <FileText size={18} className="text-destructive/70" />
                            {doc.shareToken && <Link2 size={8} className="absolute -top-0.5 -right-0.5 text-primary" />}
                          </div>

                          <div className="flex-1 min-w-0">
                            {editId === doc.id ? (
                              <div className="flex gap-2 items-center flex-wrap">
                                <Input
                                  value={editTitle}
                                  onChange={e => setEditTitle(e.target.value)}
                                  className="h-7 text-sm font-body w-48"
                                  onKeyDown={e => e.key === "Enter" && saveEdit(doc.id)}
                                  autoFocus
                                />
                                <Select value={editCat} onValueChange={setEditCat}>
                                  <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <Select value={editYear != null ? String(editYear) : "none"} onValueChange={v => setEditYear(v === "none" ? null : Number(v))}>
                                  <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Année" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">-</SelectItem>
                                    {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                                  </SelectContent>
                                </Select>
                                <button onClick={() => saveEdit(doc.id)} className="text-primary hover:text-primary/80"><Check size={15} /></button>
                                <button onClick={() => setEditId(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
                              </div>
                            ) : (
                              <>
                                <p className="font-body font-medium text-sm break-words">{doc.title}</p>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-body flex-wrap">
                                  <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                                  {doc.year && <Badge variant="outline" className="text-xs">{doc.year}</Badge>}
                                  {isSearching && doc.folderId && (
                                    <button onClick={() => { setCurrentFolderId(doc.folderId); setSearchQuery(""); }} className="flex items-center gap-1 text-primary/70 hover:text-primary">
                                      <Folder size={10} /> {getFolderName(doc.folderId)}
                                    </button>
                                  )}
                                  <span>{formatBytes(doc.fileSize)}</span>
                                  <span>·</span>
                                  <span>{formatDate(doc.createdAt)}</span>
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={getDocViewUrl(doc.filename)}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              title="Ouvrir"
                            >
                              <ExternalLink size={14} />
                            </a>
                            {doc.shareToken ? (
                              <button
                                onClick={() => handleUnshare(doc)}
                                className="p-1.5 rounded-lg text-primary hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Supprimer le lien de partage"
                              >
                                <Link2Off size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() => handleShare(doc)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Créer un lien de partage"
                              >
                                <Link2 size={14} />
                              </button>
                            )}
                            <button
                              onClick={() => { setEditId(doc.id); setEditTitle(doc.title); setEditCat(doc.category); setEditYear(doc.year); }}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={13} />
                            </button>
                            {deleteId === doc.id ? (
                              <>
                                <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => handleDelete(doc.id)}>Supprimer</Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDeleteId(null)}>Annuler</Button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleDelete(doc.id)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                title="Supprimer"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={v => { if (!v) { setUploadOpen(false); setPendingFile(null); } }}>
        <DialogContent className="max-w-md font-body">
          <DialogHeader>
            <DialogTitle>Ajouter un document</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {pendingFile && (
              <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl text-sm">
                <FileText size={16} className="text-destructive/70 shrink-0" />
                <span className="truncate font-body text-xs">{pendingFile.name}</span>
                <span className="ml-auto text-muted-foreground text-xs shrink-0">{formatBytes(pendingFile.size)}</span>
              </div>
            )}
            {currentFolderId && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-secondary/30 rounded-lg">
                <Folder size={12} className="text-primary" />
                Dossier : {getFolderName(currentFolderId)}
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-body">Titre</p>
              <Input
                value={uploadTitle}
                onChange={e => setUploadTitle(e.target.value)}
                placeholder="Nom du document"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-body">Catégorie</p>
                <Select value={uploadCat} onValueChange={setUploadCat}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1.5 font-body">Année (optionnel)</p>
                <Select value={uploadYear} onValueChange={setUploadYear}>
                  <SelectTrigger><SelectValue placeholder="-" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setUploadOpen(false); setPendingFile(null); }}>Annuler</Button>
            <Button onClick={handleUpload} disabled={uploading || !uploadTitle.trim()}>
              {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-sm font-body">
          <DialogHeader>
            <DialogTitle>Nouveau dossier</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {currentFolderId && (
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <Folder size={12} className="text-primary" />
                Dans : {getFolderName(currentFolderId)}
              </p>
            )}
            <Input
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              placeholder="Nom du dossier"
              onKeyDown={e => e.key === "Enter" && handleCreateFolder()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFolderDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
              <FolderPlus size={14} className="mr-1" /> Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSpace() {
  const [activeTab,     setActiveTab]     = useState('registre');
  const [defaultFolder, setDefaultFolder] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-12 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
            Documents <span className="text-primary">&amp;</span> Registre
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            Gestion documentaire et registre administratif.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={v => { if (v !== 'documents') setDefaultFolder(null); setActiveTab(v); }} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="registre" className="font-body gap-1.5">
              <Archive size={14} /> Registre
            </TabsTrigger>
            <TabsTrigger value="documents" className="font-body gap-1.5">
              <FileText size={14} /> Documents
            </TabsTrigger>
          </TabsList>
          <TabsContent value="registre">
            <RegistreTab onOpenFolder={(fid) => { setDefaultFolder(fid); setActiveTab('documents'); }} />
          </TabsContent>
          <TabsContent value="documents"><DocumentsTab defaultFolder={defaultFolder} /></TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
