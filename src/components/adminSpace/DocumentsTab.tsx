import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Search, X, Upload, FolderPlus, FolderOpen, Home, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import {
  listDocs, uploadDoc, deleteDoc, updateDoc, getDocViewUrl,
  shareDoc, unshareDoc, getShareUrl,
  listFolders, createFolder, updateFolder, deleteFolder,
  shareFolder, unshareFolder, getFolderShareUrl,
  type DocFolderLink,
  type AdminDocItem, type DocFolder,
} from "@/api/adminDocs";
import { SortableItem } from "./SortableItem";
import { FolderCard } from "./FolderCard";
import { DocumentRow } from "./DocumentRow";
import { UploadDialog } from "./UploadDialog";
import { NewFolderDialog } from "./NewFolderDialog";

export function DocumentsTab({ defaultFolder }: { defaultFolder?: string | null }) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<AdminDocItem[]>([]);
  const [folders, setFolders] = useState<DocFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState<number | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  useEffect(() => { if (defaultFolder) setCurrentFolderId(defaultFolder); }, [defaultFolder]);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadCat, setUploadCat] = useState("Général");
  const [uploadYear, setUploadYear] = useState<string>("none");

  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    Promise.all([listDocs(), listFolders()])
      .then(([d, f]) => { setDocs(d); setFolders(f); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
    [folders, currentFolderId],
  );

  const breadcrumb = useMemo(() => getFolderPath(currentFolderId), [currentFolderId, folders]);

  const isSearching = searchQuery.trim().length > 0;
  const searchLower = searchQuery.toLowerCase();

  const visibleDocs = useMemo(() => {
    let result = docs;
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

  async function saveDocEdit(id: string, patch: { title: string; category: string; year: number | null }) {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d));
    setEditId(null);
    try { await updateDoc(id, patch); } catch {}
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

  async function saveFolderEdit(id: string, patch: { name: string; summary: string | null; links: DocFolderLink[] }) {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, ...patch } : f));
    setEditFolderId(null);
    try { await updateFolder(id, patch); } catch {}
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

  const sortedVisibleDocs = useMemo(
    () => [...visibleDocs].sort((a, b) => a.sortOrder - b.sortOrder),
    [visibleDocs],
  );

  return (
    <div
      className="space-y-5 relative"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dragging && (
        <div className="absolute inset-0 z-50 bg-primary/5 border-2 border-dashed border-primary rounded-2xl flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <Upload size={32} className="mx-auto mb-2 text-primary" />
            <p className="font-body text-sm font-semibold text-primary">Déposer le PDF ici</p>
          </div>
        </div>
      )}

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

      <div className="flex flex-wrap gap-2 items-center justify-between">
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

      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setCatFilter("all")}
          className={cn("px-3 py-1.5 rounded-lg text-xs font-body transition-all border",
            catFilter === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
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
                : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
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
                  : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
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
                    : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                {y}
              </button>
            ))}
          </>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          {!isSearching && subFolders.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleFolderDragEnd}>
              <SortableContext items={subFolders.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {subFolders.map(f => (
                    <SortableItem key={f.id} id={f.id}>
                      {({ handleProps }) => (
                        <FolderCard
                          folder={f}
                          isEditing={editFolderId === f.id}
                          isDeleting={deleteFolderId === f.id}
                          handleProps={handleProps}
                          onSelect={setCurrentFolderId}
                          onShare={handleShareFolder}
                          onUnshare={handleUnshareFolder}
                          onStartEdit={() => setEditFolderId(f.id)}
                          onSaveEdit={(patch) => saveFolderEdit(f.id, patch)}
                          onCancelEdit={() => setEditFolderId(null)}
                          onStartDelete={() => setDeleteFolderId(f.id)}
                          onConfirmDelete={() => handleDeleteFolder(f.id)}
                          onCancelDelete={() => setDeleteFolderId(null)}
                        />
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}

          {visibleDocs.length === 0 && subFolders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-body">{isSearching ? "Aucun résultat." : "Dossier vide. Ajoutez un document ou créez un sous-dossier."}</p>
            </div>
          ) : visibleDocs.length > 0 && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDocDragEnd}>
              <SortableContext items={sortedVisibleDocs.map(d => d.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {sortedVisibleDocs.map(doc => (
                    <SortableItem key={doc.id} id={doc.id}>
                      {({ handleProps }) => (
                        <DocumentRow
                          doc={doc}
                          isEditing={editId === doc.id}
                          isDeleting={deleteId === doc.id}
                          isSearching={isSearching}
                          folderName={doc.folderId ? getFolderName(doc.folderId) : null}
                          handleProps={handleProps}
                          viewUrl={getDocViewUrl(doc.filename)}
                          onStartEdit={() => setEditId(doc.id)}
                          onSaveEdit={(patch) => saveDocEdit(doc.id, patch)}
                          onCancelEdit={() => setEditId(null)}
                          onStartDelete={() => setDeleteId(doc.id)}
                          onConfirmDelete={() => handleDelete(doc.id)}
                          onCancelDelete={() => setDeleteId(null)}
                          onShare={() => handleShare(doc)}
                          onUnshare={() => handleUnshare(doc)}
                          onJumpToFolder={isSearching && doc.folderId ? () => { setCurrentFolderId(doc.folderId); setSearchQuery(""); } : undefined}
                        />
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      <UploadDialog
        open={uploadOpen}
        onOpenChange={v => { if (!v) { setUploadOpen(false); setPendingFile(null); } }}
        pendingFile={pendingFile}
        uploadTitle={uploadTitle}
        setUploadTitle={setUploadTitle}
        uploadCat={uploadCat}
        setUploadCat={setUploadCat}
        uploadYear={uploadYear}
        setUploadYear={setUploadYear}
        uploading={uploading}
        currentFolderName={currentFolderId ? getFolderName(currentFolderId) : null}
        onUpload={handleUpload}
        onCancel={() => { setUploadOpen(false); setPendingFile(null); }}
      />

      <NewFolderDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        name={newFolderName}
        setName={setNewFolderName}
        parentFolderName={currentFolderId ? getFolderName(currentFolderId) : null}
        onCreate={handleCreateFolder}
        onCancel={() => setFolderDialogOpen(false)}
      />
    </div>
  );
}
