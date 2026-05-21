import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScanLine, Upload, Zap, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  uploadDoc, updateDoc, deleteDoc, getDocViewUrl, listFolders,
} from "@/api/adminDocs";
import { useAdminDocs, useInvalidateAdminDocs } from "@/hooks/useAdminDocs";
import { bufferFile, MAX_PDF_SIZE } from "./helpers";
import { ScanSortDialog } from "./ScanSortDialog";
import { BatchAssembleDialog } from "./BatchAssembleDialog";
import { TriageDocCard } from "./TriageDocCard";

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/**
 * The "À trier" scan inbox. Drop a scanned PDF, choose where it goes (a folder
 * now, or the triage queue for later), and clear the queue card by card.
 * Several PDFs at once open the assembler — order them, merge into one document.
 */
export function TriageTab() {
  const { toast } = useToast();
  const { pendingDocs, isLoading } = useAdminDocs();
  const invalidate = useInvalidateAdminDocs();
  const { data: folders = [] } = useQuery({ queryKey: ["admin-doc-folders"], queryFn: listFolders });

  const fileRef = useRef<HTMLInputElement>(null);
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

  // ── Batch-assemble dialog (several PDFs → one document) ─────
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchPreparing, setBatchPreparing] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);

  /** Routes picked/dropped files: one PDF → sort dialog, several → assembler. */
  function handleFiles(raw: File[]) {
    const pdfs = raw.filter(isPdf);
    if (pdfs.length === 0) {
      toast({ title: "Format non supporté", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
      return;
    }
    if (pdfs.some((f) => f.size > MAX_PDF_SIZE)) {
      toast({ title: "Fichier trop lourd", description: "Maximum 25 Mo par PDF.", variant: "destructive" });
      return;
    }
    if (pdfs.length === 1) void acceptSingle(pdfs[0]);
    else void acceptBatch(pdfs);
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
    // Kick off every read synchronously, then open the assembler.
    const bufferPromises = raw.map(bufferFile);
    setBatchFiles([]);
    setBatchPreparing(true);
    setBatchOpen(true);
    try {
      setBatchFiles(await Promise.all(bufferPromises));
    } catch {
      toast({ title: "Erreur", description: "Impossible de lire un des fichiers.", variant: "destructive" });
      setBatchOpen(false);
    } finally {
      setBatchPreparing(false);
    }
  }

  /** Opens the assembler empty — for adding PDFs one by one. */
  function openAssembler() {
    setBatchFiles([]);
    setBatchPreparing(false);
    setBatchOpen(true);
  }

  /** The assembler merged several PDFs — hand the result to the sort dialog. */
  function handleBatchMerged(merged: File) {
    setBatchOpen(false);
    setBatchFiles([]);
    setTitle(merged.name.replace(/\.pdf$/i, ""));
    setCategory("Général");
    setFolderId(null);
    setUrgent(false);
    setFileMeta({ name: merged.name, size: merged.size });
    setPendingFile(merged); // already an in-memory File — no buffering needed
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
            Glisse-dépose tes PDF scannés ici, ou clique pour parcourir.
            Dépose-en plusieurs d'un coup pour les assembler en un document.
          </p>
          <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-body font-medium text-primary">
            <Upload size={13} /> Choisir un ou plusieurs PDF
          </span>
        </button>
        <button
          type="button"
          onClick={openAssembler}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-body text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
        >
          <Layers size={14} className="text-primary" />
          Plusieurs PDF pour un seul document ? Assemble-les dans l'ordre
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
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
      />

      <BatchAssembleDialog
        open={batchOpen}
        onOpenChange={(v) => { if (!v) { setBatchOpen(false); setBatchFiles([]); } }}
        initialFiles={batchFiles}
        preparing={batchPreparing}
        onMerged={handleBatchMerged}
      />
    </div>
  );
}
