import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, ExternalLink, Trash2, Pencil, Check, X, Link2, Link2Off, Folder, GripVertical,
} from "lucide-react";
import type { AdminDocItem } from "@/api/adminDocs";
import { DOC_CATEGORIES, YEAR_OPTIONS, formatBytes, formatDate } from "./helpers";

interface DocumentRowProps {
  doc: AdminDocItem;
  isEditing: boolean;
  isDeleting: boolean;
  isSearching: boolean;
  folderName: string | null;
  handleProps: Record<string, unknown>;
  viewUrl: string;
  onStartEdit: () => void;
  onSaveEdit: (patch: { title: string; category: string; year: number | null }) => void;
  onCancelEdit: () => void;
  onStartDelete: () => void;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  onShare: () => void;
  onUnshare: () => void;
  onJumpToFolder?: () => void;
}

export function DocumentRow({
  doc, isEditing, isDeleting, isSearching, folderName, handleProps, viewUrl,
  onStartEdit, onSaveEdit, onCancelEdit,
  onStartDelete, onConfirmDelete, onCancelDelete,
  onShare, onUnshare, onJumpToFolder,
}: DocumentRowProps) {
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState(doc.category);
  const [year, setYear] = useState<number | null>(doc.year);

  useEffect(() => {
    if (isEditing) {
      setTitle(doc.title);
      setCategory(doc.category);
      setYear(doc.year);
    }
  }, [isEditing, doc]);

  function save() {
    onSaveEdit({ title, category, year });
  }

  return (
    <div className="glass-card rounded-2xl p-4 flex items-center gap-4 group">
      <button {...handleProps} className="p-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0">
        <GripVertical size={16} />
      </button>
      <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0 relative">
        <FileText size={18} className="text-destructive/70" />
        {doc.shareToken && <Link2 size={8} className="absolute -top-0.5 -right-0.5 text-primary" />}
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex gap-2 items-center flex-wrap">
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="h-7 text-sm font-body w-48"
              onKeyDown={e => e.key === "Enter" && save()}
              autoFocus
            />
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={year != null ? String(year) : "none"} onValueChange={v => setYear(v === "none" ? null : Number(v))}>
              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Année" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-</SelectItem>
                {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
            <button onClick={save} className="text-primary hover:text-primary/80"><Check size={15} /></button>
            <button onClick={onCancelEdit} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
          </div>
        ) : (
          <>
            <p className="font-body font-medium text-sm break-words">{doc.title}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-body flex-wrap">
              <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
              {doc.year && <Badge variant="outline" className="text-xs">{doc.year}</Badge>}
              {isSearching && doc.folderId && folderName && (
                <button onClick={onJumpToFolder} className="flex items-center gap-1 text-primary/70 hover:text-primary">
                  <Folder size={10} /> {folderName}
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
          href={viewUrl}
          target="_blank"
          rel="noreferrer"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Ouvrir"
        >
          <ExternalLink size={14} />
        </a>
        {doc.shareToken ? (
          <button
            onClick={onUnshare}
            className="p-1.5 rounded-lg text-primary hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Supprimer le lien de partage"
          >
            <Link2Off size={14} />
          </button>
        ) : (
          <button
            onClick={onShare}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Créer un lien de partage"
          >
            <Link2 size={14} />
          </button>
        )}
        <button
          onClick={onStartEdit}
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Modifier"
        >
          <Pencil size={13} />
        </button>
        {isDeleting ? (
          <>
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onConfirmDelete}>Supprimer</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelDelete}>Annuler</Button>
          </>
        ) : (
          <button
            onClick={onStartDelete}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
