import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  FileText, ExternalLink, Trash2, Zap, FolderInput, Check, X, Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdminDocItem, DocFolder } from "@/api/adminDocs";
import { folderOptions, formatBytes, formatDate } from "./helpers";

interface TriageDocCardProps {
  doc: AdminDocItem;
  folders: DocFolder[];
  viewUrl: string;
  /** True while a mutation for this specific card is in flight. */
  busy: boolean;
  onFile: (folderId: string) => void;
  onToggleUrgent: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}

/** A single pending (to-sort) document in the triage queue. */
export function TriageDocCard({
  doc, folders, viewUrl, busy, onFile, onToggleUrgent, onRename, onDelete,
}: TriageDocCardProps) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(doc.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const opts = folderOptions(folders);

  function saveTitle() {
    const trimmed = title.trim();
    if (trimmed && trimmed !== doc.title) onRename(trimmed);
    setEditing(false);
  }
  function cancelEdit() {
    setTitle(doc.title);
    setEditing(false);
  }

  return (
    <div className={cn(
      "glass-card rounded-2xl p-4 flex flex-col gap-3 transition-colors",
      doc.urgent && "border-red-300 bg-red-50/50",
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          doc.urgent ? "bg-red-100" : "bg-destructive/10",
        )}>
          <FileText size={18} className={doc.urgent ? "text-red-500" : "text-destructive/70"} />
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex gap-1.5 items-center">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-7 text-sm font-body"
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") cancelEdit();
                }}
                autoFocus
              />
              <button onClick={saveTitle} className="text-primary hover:text-primary/80 shrink-0">
                <Check size={15} />
              </button>
              <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground shrink-0">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <p className="font-body font-medium text-sm break-words">{doc.title}</p>
              <button
                onClick={() => { setTitle(doc.title); setEditing(true); }}
                className="text-muted-foreground/40 hover:text-foreground shrink-0"
                title="Renommer"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground font-body">
            {doc.urgent && (
              <Badge className="bg-red-500 hover:bg-red-500 text-white gap-1 text-[10px]">
                <Zap size={9} /> Urgent
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">{doc.category}</Badge>
            <span>{formatBytes(doc.fileSize)}</span>
            <span>·</span>
            <span>{formatDate(doc.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onToggleUrgent}
            disabled={busy}
            className={cn(
              "p-1.5 rounded-lg transition-colors disabled:opacity-50",
              doc.urgent
                ? "text-red-500 bg-red-100 hover:bg-red-200"
                : "text-muted-foreground hover:text-red-500 hover:bg-red-50",
            )}
            title={doc.urgent ? "Retirer l'urgence" : "Marquer comme urgent"}
          >
            <Zap size={14} />
          </button>
          <a
            href={viewUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Ouvrir le PDF"
          >
            <ExternalLink size={14} />
          </a>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={onDelete}
                disabled={busy}
              >
                Supprimer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => setConfirmDelete(false)}
              >
                Annuler
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="Supprimer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* File-it row — picking a folder archives the document. */}
      <div className="flex items-center gap-2 border-t border-border/60 pt-3">
        <FolderInput size={15} className="text-primary shrink-0" />
        <Select
          disabled={busy || opts.length === 0}
          onValueChange={(v) => onFile(v)}
        >
          <SelectTrigger className="h-8 text-xs font-body flex-1">
            <SelectValue placeholder={
              opts.length === 0
                ? "Aucun dossier — créez-en dans l'onglet Documents"
                : "Classer dans un dossier…"
            } />
          </SelectTrigger>
          <SelectContent>
            {opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
