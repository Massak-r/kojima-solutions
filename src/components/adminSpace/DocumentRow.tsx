import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Eye, Trash2, Pencil, Check, X, Link2, Link2Off, Folder, GripVertical, Inbox, Receipt, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminDocItem } from "@/api/adminDocs";
import { DOC_CATEGORIES, YEAR_OPTIONS, formatBytes, formatDate } from "./helpers";
import { DocPreviewSheet } from "./DocPreviewSheet";
import { DocToPayableDialog, type PayablePrefill } from "./DocToPayableDialog";
import { buildDocPayablePrefill } from "./docPayable";

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
  onSendToTriage: () => void;
  onJumpToFolder?: () => void;
}

export function DocumentRow({
  doc, isEditing, isDeleting, isSearching, folderName, handleProps, viewUrl,
  onStartEdit, onSaveEdit, onCancelEdit,
  onStartDelete, onConfirmDelete, onCancelDelete,
  onShare, onUnshare, onSendToTriage, onJumpToFolder,
}: DocumentRowProps) {
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState(doc.category);
  const [year, setYear] = useState<number | null>(doc.year);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [payableOpen, setPayableOpen] = useState(false);
  const [payablePrefill, setPayablePrefill] = useState<PayablePrefill | null>(null);
  const [payableLoading, setPayableLoading] = useState(false);

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

  async function openPayable() {
    setPayableLoading(true);
    try {
      setPayablePrefill(await buildDocPayablePrefill(doc.id, doc.title));
      setPayableOpen(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "";
      if (!message.includes("→ 401")) toast.error("Lecture du document impossible.");
    } finally {
      setPayableLoading(false);
    }
  }

  return (
    <div className="glass-card rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4 group">
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <button {...handleProps} className="p-0.5 text-muted-foreground/30 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none">
          <GripVertical size={16} />
        </button>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="w-10 h-10 rounded-xl bg-destructive/10 hover:bg-primary/10 flex items-center justify-center shrink-0 relative group/icon transition-colors"
          title="Aperçu du document"
          aria-label="Aperçu du document"
        >
          <FileText size={18} className="text-destructive/70 group-hover/icon:opacity-0 transition-opacity" />
          <Eye size={18} className="text-primary absolute opacity-0 group-hover/icon:opacity-100 transition-opacity" />
          {doc.shareToken && <Link2 size={8} className="absolute -top-0.5 -right-0.5 text-primary" />}
        </button>

        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:flex-wrap">
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="h-8 text-sm font-body w-full md:w-48"
                onKeyDown={e => e.key === "Enter" && save()}
                autoFocus
              />
              <div className="flex gap-2">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-8 w-full md:w-36 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={year != null ? String(year) : "none"} onValueChange={v => setYear(v === "none" ? null : Number(v))}>
                  <SelectTrigger className="h-8 w-full md:w-24 text-xs"><SelectValue placeholder="Année" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-</SelectItem>
                    {YEAR_OPTIONS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={save} className="text-primary hover:text-primary/80 p-1"><Check size={17} /></button>
                <button onClick={onCancelEdit} className="text-muted-foreground hover:text-foreground p-1"><X size={17} /></button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-body font-medium text-sm break-words">{doc.title}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground font-body flex-wrap">
                <Badge variant="secondary" className="text-xs">{doc.category}</Badge>
                {doc.year && <Badge variant="outline" className="text-xs">{doc.year}</Badge>}
                {doc.tags?.map((t) => (
                  <Badge key={t} variant="outline" className="text-[10px] text-violet-700 dark:text-violet-300 border-violet-300/50 dark:border-violet-500/30 bg-violet-50/40 dark:bg-violet-500/8">
                    {t}
                  </Badge>
                ))}
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
      </div>

      {/* Action toolbar — always visible on mobile (no hover), hover-revealed
          on desktop to keep the row clean. */}
      <div className="flex items-center gap-1 justify-end shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => setPreviewOpen(true)}
          className="p-2 md:p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Aperçu"
          aria-label="Aperçu du PDF"
        >
          <Eye size={16} />
        </button>
        {doc.shareToken ? (
          <button
            onClick={onUnshare}
            className="p-2 md:p-1.5 rounded-lg text-primary hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Supprimer le lien de partage"
            aria-label="Supprimer le lien de partage"
          >
            <Link2Off size={16} />
          </button>
        ) : (
          <button
            onClick={onShare}
            className="p-2 md:p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            title="Créer un lien de partage"
            aria-label="Créer un lien de partage"
          >
            <Link2 size={16} />
          </button>
        )}
        <button
          onClick={onSendToTriage}
          className="p-2 md:p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          title="Renvoyer vers À trier"
          aria-label="Renvoyer vers À trier"
        >
          <Inbox size={16} />
        </button>
        <button
          onClick={openPayable}
          disabled={payableLoading}
          className="p-2 md:p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
          title="Enregistrer comme paiement à venir"
          aria-label="Enregistrer comme paiement à venir"
        >
          {payableLoading ? <Loader2 size={16} className="animate-spin" /> : <Receipt size={16} />}
        </button>
        <button
          onClick={onStartEdit}
          className="p-2 md:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Modifier"
          aria-label="Modifier"
        >
          <Pencil size={15} />
        </button>
        {isDeleting ? (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="destructive" className="h-8 text-xs" onClick={onConfirmDelete}>Supprimer</Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={onCancelDelete}>Annuler</Button>
          </div>
        ) : (
          <button
            onClick={onStartDelete}
            className="p-2 md:p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Supprimer"
            aria-label="Supprimer"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      <DocPreviewSheet
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title={doc.title}
        viewUrl={viewUrl}
      />

      <DocToPayableDialog
        open={payableOpen}
        onOpenChange={setPayableOpen}
        prefill={payablePrefill}
        doc={{ id: doc.id, title: doc.title }}
      />
    </div>
  );
}
