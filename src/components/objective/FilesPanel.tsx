import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, FileText, FileSpreadsheet, File as FileIcon, Download, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { listFiles, uploadFile, updateFile, deleteFile, type ObjectiveFile } from "@/api/objectiveFiles";
import type { ObjectiveSource } from "@/api/objectiveSource";

interface FilesPanelProps {
  source: ObjectiveSource;
  objectiveId: string;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/"))   return null; // render thumbnail instead
  if (mime === "application/pdf")  return <FileText size={28} className="text-red-500/80" />;
  if (mime.includes("sheet") || mime.includes("excel") || mime === "text/csv") return <FileSpreadsheet size={28} className="text-emerald-500/80" />;
  if (mime.startsWith("text/"))    return <FileText size={28} className="text-muted-foreground/70" />;
  return <FileIcon size={28} className="text-muted-foreground/70" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

export function FilesPanel({ source, objectiveId }: FilesPanelProps) {
  const [files,   setFiles]   = useState<ObjectiveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(0);
  const [dragOver,  setDragOver]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    listFiles(source, objectiveId)
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [source, objectiveId]);

  async function handleUpload(list: FileList | File[]) {
    setError(null);
    const arr = Array.from(list);
    setUploading(n => n + arr.length);
    for (const f of arr) {
      try {
        const uploaded = await uploadFile(source, objectiveId, f);
        setFiles(prev => [uploaded, ...prev]);
      } catch (e: any) {
        setError(e?.message ?? "Échec de l'upload");
      } finally {
        setUploading(n => n - 1);
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleUpload(e.dataTransfer.files);
  }

  async function handleDelete(id: string) {
    setFiles(prev => prev.filter(f => f.id !== id));
    setConfirmDelete(null);
    try { await deleteFile(id); } catch {}
  }

  function handleCaption(id: string, caption: string) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, caption } : f));
    updateFile(id, { caption }).catch(() => {});
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-display font-bold text-foreground/60 uppercase tracking-wider">
          {files.length === 0 ? "Aucun fichier" : `${files.length} fichier${files.length > 1 ? "s" : ""}`}
          {uploading > 0 && <span className="ml-2 text-primary">· {uploading} en cours...</span>}
        </div>
        <Button size="sm" variant="outline" onClick={() => pickerRef.current?.click()} className="h-8 rounded-full">
          <Upload size={14} className="mr-1" /> Ajouter
        </Button>
        <input
          ref={pickerRef}
          type="file"
          multiple
          hidden
          onChange={e => { if (e.target.files) { handleUpload(e.target.files); e.target.value = ""; } }}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 text-sm font-body text-destructive px-3 py-2">
          {error}
        </div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "rounded-2xl border-2 border-dashed p-5 transition-all",
          dragOver ? "border-primary bg-primary/5" : "border-border/40 hover:border-border/70",
        )}
      >
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        ) : files.length === 0 ? (
          <button onClick={() => pickerRef.current?.click()} className="w-full py-6 text-center">
            <Upload size={28} className="mx-auto text-muted-foreground/40 mb-2" />
            <div className="text-sm font-body text-muted-foreground">Glissez-déposez ou cliquez pour ajouter</div>
            <div className="text-xs font-body text-muted-foreground/50 mt-1">Images, PDF, documents, tableurs · max 25 MB</div>
          </button>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {files.map(f => (
              <FileCard
                key={f.id}
                file={f}
                onCaption={(cap) => handleCaption(f.id, cap)}
                onDelete={() => setConfirmDelete(f.id)}
                confirming={confirmDelete === f.id}
                onCancelDelete={() => setConfirmDelete(null)}
                onConfirmDelete={() => handleDelete(f.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FileCard({ file, onCaption, onDelete, confirming, onCancelDelete, onConfirmDelete }: {
  file: ObjectiveFile;
  onCaption: (caption: string) => void;
  onDelete: () => void;
  confirming: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}) {
  const [editCaption, setEditCaption] = useState(false);
  const [draft, setDraft] = useState(file.caption ?? "");
  const isImage = file.mimeType.startsWith("image/");

  return (
    <div className="rounded-xl border border-border/40 bg-card/50 overflow-hidden flex flex-col">
      <div className="aspect-video bg-muted/30 flex items-center justify-center relative">
        {isImage ? (
          <img src={file.url} alt={file.originalName} className="w-full h-full object-cover" />
        ) : (
          fileIcon(file.mimeType)
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <a
            href={file.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-0 text-sm font-body font-semibold text-foreground hover:text-primary transition-colors truncate"
            title={file.originalName}
          >
            {file.originalName}
          </a>
          <a
            href={file.url}
            download={file.originalName}
            className="p-1 rounded text-muted-foreground/60 hover:text-primary transition-colors"
            title="Télécharger"
          >
            <Download size={13} />
          </a>
          {!confirming && (
            <button
              onClick={onDelete}
              className="p-1 rounded text-muted-foreground/40 hover:text-destructive transition-colors"
              title="Supprimer"
            >
              <Trash2 size={13} />
            </button>
          )}
          {confirming && (
            <div className="flex gap-0.5">
              <Button size="sm" variant="destructive" className="h-7 px-2 text-[10px] rounded-md" onClick={onConfirmDelete}>Oui</Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] rounded-md" onClick={onCancelDelete}>Non</Button>
            </div>
          )}
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
          {formatSize(file.fileSize)} · {new Date(file.createdAt).toLocaleDateString("fr-CH")}
        </div>
        {editCaption ? (
          <div className="flex gap-1.5">
            <input
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              autoFocus
              onKeyDown={e => {
                if (e.key === "Enter") { onCaption(draft); setEditCaption(false); }
                if (e.key === "Escape") { setDraft(file.caption ?? ""); setEditCaption(false); }
              }}
              className="flex-1 text-xs font-body bg-secondary/50 border border-border/50 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button onClick={() => { onCaption(draft); setEditCaption(false); }} className="text-[10px] font-body font-semibold text-primary px-1.5">OK</button>
          </div>
        ) : file.caption ? (
          <button onClick={() => { setDraft(file.caption ?? ""); setEditCaption(true); }} className="text-xs font-body text-foreground/70 hover:text-foreground group/cap flex items-start gap-1 w-full text-left">
            <span className="flex-1 leading-relaxed">{file.caption}</span>
            <Pencil size={10} className="opacity-0 group-hover/cap:opacity-50 mt-0.5 shrink-0" />
          </button>
        ) : (
          <button onClick={() => { setDraft(""); setEditCaption(true); }} className="text-[11px] font-body text-muted-foreground/40 hover:text-muted-foreground italic transition-colors">
            + Ajouter une légende...
          </button>
        )}
      </div>
    </div>
  );
}
