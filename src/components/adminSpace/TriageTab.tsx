import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScanLine, Upload, Zap, Layers, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  uploadDoc, updateDoc, deleteDoc, getDocViewUrl, listFolders,
} from "@/api/adminDocs";
import { useAdminDocs, useInvalidateAdminDocs } from "@/hooks/useAdminDocs";
import { bufferFile, MAX_PDF_SIZE, isImage, imagesToPdf } from "./helpers";
import { ScanSortDialog } from "./ScanSortDialog";
import { PdfPageEditorDialog } from "./PdfPageEditorDialog";
import { TriageDocCard } from "./TriageDocCard";

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);
const isAcceptedScan = (f: File) => isPdf(f) || isImage(f);

/**
 * The "À trier" scan inbox. Drop a scanned PDF, choose where it goes (a folder
 * now, or the triage queue for later), and clear the queue card by card.
 * Several PDFs at once open the assembler — order them, merge into one document.
 */
export function TriageTab() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { pendingDocs, isLoading } = useAdminDocs();
  const invalidate = useInvalidateAdminDocs();
  const { data: folders = [] } = useQuery({ queryKey: ["admin-doc-folders"], queryFn: listFolders });

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);

  // ── Scan-sort dialog (single document) ──────────────────────
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState({ name: "", size: 0 });
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Général");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [urgent, setUrgent] = useState(false);

  // ── Page editor (assemble + reorder / rotate / delete / extract) ──
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorFiles, setEditorFiles] = useState<File[]>([]);
  const [editorPreparing, setEditorPreparing] = useState(false);
  // True while the editor is staged from the sort dialog on an existing single
  // document — on return we keep the title/folder the user already chose.
  const editingExisting = useRef(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  /** Routes picked/dropped/captured files. PDFs flow straight through. Image
   *  captures (single photo or burst) are wrapped client-side into a PDF
   *  before joining the same pipeline — keeps the backend PDF-only without
   *  forcing the user to convert manually on their phone. */
  async function handleFiles(raw: File[]) {
    const accepted = raw.filter(isAcceptedScan);
    if (accepted.length === 0) {
      toast({
        title: "Format non supporté",
        description: "PDF, JPG, PNG ou HEIC uniquement.",
        variant: "destructive",
      });
      return;
    }
    if (accepted.some((f) => f.size > MAX_PDF_SIZE)) {
      toast({ title: "Fichier trop lourd", description: "Maximum 25 Mo par fichier.", variant: "destructive" });
      return;
    }

    // Group: pure-PDF list goes directly; mixed/image lists get folded into
    // a single PDF first (one image = 1 page, several = a multi-page scan).
    const pdfs = accepted.filter(isPdf);
    const images = accepted.filter(isImage);

    if (images.length > 0) {
      try {
        const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
        const merged = await imagesToPdf(images, `scan-${stamp}.pdf`);
        if (pdfs.length === 0 && images.length === 1) void acceptSingle(merged);
        else if (pdfs.length === 0)                    void acceptSingle(merged);
        else                                           void acceptBatch([merged, ...pdfs]);
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erreur inconnue";
        toast({ title: "Conversion image échouée", description: msg, variant: "destructive" });
        return;
      }
    }

    if (pdfs.length === 1) void acceptSingle(pdfs[0]);
    else                   void acceptBatch(pdfs);
  }

  async function acceptSingle(raw: File) {
    // Read the bytes synchronously — Android revokes the content URI once the
    // open dialog introduces an await gap.
    const bufferPromise = bufferFile(raw);
    setTitle(raw.name.replace(/\.pdf$/i, ""));
    setCategory("Général");
    setFolderId(null);
    setUrgent(false);
    setFileMeta({ name: raw.name, size: raw.size });
    setPendingFile(null);
    setPreparing(true);
    setDialogOpen(true);
    try {
      setPendingFile(await bufferPromise);
    } catch {
      toast({ title: "Erreur", description: "Impossible de lire le fichier.", variant: "destructive" });
      setDialogOpen(false);
    } finally {
      setPreparing(false);
    }
  }

  async function acceptBatch(raw: File[]) {
    // Kick off every read synchronously, then open the page editor.
    const bufferPromises = raw.map(bufferFile);
    editingExisting.current = false;
    setEditorFiles([]);
    setEditorPreparing(true);
    setEditorOpen(true);
    try {
      setEditorFiles(await Promise.all(bufferPromises));
    } catch {
      toast({ title: "Erreur", description: "Impossible de lire un des fichiers.", variant: "destructive" });
      setEditorOpen(false);
    } finally {
      setEditorPreparing(false);
    }
  }

  /** Opens the editor empty — for building a document from scratch. */
  function openEditor() {
    editingExisting.current = false;
    setEditorFiles([]);
    setEditorPreparing(false);
    setEditorOpen(true);
  }

  /** From the sort dialog: re-open the editor on the document being staged so
   *  the user can clean it up (rotate a sideways page, drop a blank, etc.). */
  function editCurrentPages() {
    if (!pendingFile) return;
    editingExisting.current = true;
    setDialogOpen(false);
    setEditorFiles([pendingFile]); // already buffered in memory
    setEditorPreparing(false);
    setEditorOpen(true);
  }

  /** The editor produced one assembled PDF — hand it to the sort dialog. When we
   *  came from an already-staged doc, keep its title/category/folder choices. */
  function handleAssembled(assembled: File) {
    const keepMeta = editingExisting.current;
    editingExisting.current = false;
    setEditorOpen(false);
    setEditorFiles([]);
    if (!keepMeta) {
      setTitle(assembled.name.replace(/\.pdf$/i, ""));
      setCategory("Général");
      setFolderId(null);
      setUrgent(false);
    }
    setFileMeta({ name: assembled.name, size: assembled.size });
    setPendingFile(assembled); // already an in-memory File — no buffering needed
    setPreparing(false);
    setDialogOpen(true);
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (list.length) handleFiles(list);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    dragCounter.current = 0;
    const list = Array.from(e.dataTransfer.files ?? []);
    if (list.length) handleFiles(list);
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

  async function handleSubmit(status: "to_sort" | "filed") {
    if (!pendingFile) return;
    setSaving(true);
    try {
      await uploadDoc(
        pendingFile,
        title.trim() || pendingFile.name,
        category,
        status === "filed" ? folderId : null,
        null,
        status,
        status === "to_sort" ? urgent : false,
      );
      await invalidate();
      setDialogOpen(false);
      setPendingFile(null);
      toast({
        title: status === "filed" ? "Document classé" : "Ajouté à la boîte de tri",
        description: status === "filed"
          ? "Il est archivé dans son dossier."
          : "Tu pourras le classer quand tu veux.",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast({ title: "Échec de l'envoi", description: msg, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function fileDoc(id: string, targetFolderId: string) {
    setBusyId(id);
    try {
      await updateDoc(id, { folderId: targetFolderId, status: "filed", urgent: false });
      await invalidate();
      const name = folders.find((f) => f.id === targetFolderId)?.name ?? "le dossier";
      toast({ title: "Document classé", description: `Archivé dans « ${name} ».` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de classer le document.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function toggleUrgent(id: string, current: boolean) {
    setBusyId(id);
    try {
      await updateDoc(id, { urgent: !current });
      await invalidate();
    } catch {
      toast({ title: "Erreur", description: "Action impossible.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function renameDoc(id: string, newTitle: string) {
    setBusyId(id);
    try {
      await updateDoc(id, { title: newTitle });
      await invalidate();
    } catch {
      toast({ title: "Erreur", description: "Impossible de renommer.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  async function removeDoc(id: string) {
    setBusyId(id);
    try {
      await deleteDoc(id);
      await invalidate();
      toast({ title: "Document supprimé" });
    } catch {
      toast({ title: "Erreur", description: "Suppression impossible.", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  }

  // Urgent first, then most-recently scanned.
  const sorted = [...pendingDocs].sort((a, b) => {
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const urgentCount = pendingDocs.filter((d) => d.urgent).length;

  return (
    <div
      className="space-y-5"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      {/* Scan drop zone */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "w-full rounded-2xl border-2 border-dashed transition-all p-8 sm:p-10 flex flex-col items-center justify-center text-center",
            dragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border hover:border-primary/50 hover:bg-secondary/30",
          )}
        >
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
            <ScanLine size={26} className="text-primary" />
          </div>
          <p className="font-display font-semibold text-base">Zone de scan</p>
          <p className="text-sm text-muted-foreground font-body mt-1 max-w-sm">
            {isMobile
              ? "Touche pour scanner avec l'appareil photo ou choisir un PDF. Plusieurs fichiers d'un coup ouvrent l'éditeur de pages."
              : "Glisse-dépose tes PDF ou photos scannés ici, ou clique pour parcourir. Plusieurs fichiers d'un coup ouvrent l'éditeur de pages."}
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-body font-medium text-primary">
            <Upload size={13} /> PDF, JPG ou PNG · scan caméra mobile pris en charge
          </span>
        </button>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {isMobile && (
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/5 py-2.5 text-xs font-body text-primary hover:bg-primary/10 transition-colors"
            >
              <Camera size={14} />
              Scanner avec l'appareil photo
            </button>
          )}
          <button
            type="button"
            onClick={openEditor}
            className={cn(
              "w-full flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-body text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors",
              !isMobile && "sm:col-span-2",
            )}
          >
            <Layers size={14} className="text-primary" />
            Éditer / assembler des pages — réorganiser, pivoter, extraire
          </button>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf,image/jpeg,image/png,image/heic,image/webp"
        multiple
        className="hidden"
        onChange={onFileInput}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFileInput}
      />

      {/* Pending queue */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-sm font-body">Aucun document en attente — boîte de tri vide 🎉</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display font-semibold text-sm">
              Documents à compléter
              <span className="text-muted-foreground font-body font-normal"> · {sorted.length}</span>
            </h2>
            {urgentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-body font-semibold text-red-600">
                <Zap size={12} /> {urgentCount} urgent{urgentCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
          {sorted.map((doc) => (
            <TriageDocCard
              key={doc.id}
              doc={doc}
              folders={folders}
              viewUrl={getDocViewUrl(doc.filename)}
              busy={busyId === doc.id}
              onFile={(fid) => fileDoc(doc.id, fid)}
              onToggleUrgent={() => toggleUrgent(doc.id, doc.urgent)}
              onRename={(t) => renameDoc(doc.id, t)}
              onChanged={() => { void invalidate(); }}
              onDelete={() => removeDoc(doc.id)}
            />
          ))}
        </div>
      )}

      <ScanSortDialog
        open={dialogOpen}
        onOpenChange={(v) => { if (!v) { setDialogOpen(false); setPendingFile(null); } }}
        fileName={fileMeta.name}
        fileSize={fileMeta.size}
        preparing={preparing}
        folders={folders}
        title={title}
        setTitle={setTitle}
        category={category}
        setCategory={setCategory}
        folderId={folderId}
        setFolderId={setFolderId}
        urgent={urgent}
        setUrgent={setUrgent}
        saving={saving}
        onSubmit={handleSubmit}
        onEditPages={pendingFile ? editCurrentPages : undefined}
      />

      <PdfPageEditorDialog
        open={editorOpen}
        onOpenChange={(v) => {
          if (v) return;
          // Cancelling an edit that came from the sort dialog returns there with
          // the document unchanged, rather than dropping the user to an empty UI.
          const backToSort = editingExisting.current && !!pendingFile;
          editingExisting.current = false;
          setEditorOpen(false);
          setEditorFiles([]);
          if (backToSort) setDialogOpen(true);
        }}
        initialFiles={editorFiles}
        preparing={editorPreparing}
        onMerged={handleAssembled}
      />
    </div>
  );
}
