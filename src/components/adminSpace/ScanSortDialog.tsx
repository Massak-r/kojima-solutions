import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { FileText, FolderInput, Clock, Loader2, Zap } from "lucide-react";
import type { DocFolder } from "@/api/adminDocs";
import { DOC_CATEGORIES, folderOptions, formatBytes } from "./helpers";

interface ScanSortDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  fileSize: number;
  /** True while the dropped file is still being read into memory. */
  preparing: boolean;
  folders: DocFolder[];
  title: string;
  setTitle: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  folderId: string | null;
  setFolderId: (v: string | null) => void;
  urgent: boolean;
  setUrgent: (v: boolean) => void;
  saving: boolean;
  onSubmit: (status: "to_sort" | "filed") => void;
}

/**
 * Shown right after a PDF is dropped into the scan zone. Asks where to file the
 * document — pick a folder to archive it now ("Classer ici"), or set it aside
 * for the triage queue ("À trier plus tard").
 */
export function ScanSortDialog({
  open, onOpenChange, fileName, fileSize, preparing, folders,
  title, setTitle, category, setCategory, folderId, setFolderId,
  urgent, setUrgent, saving, onSubmit,
}: ScanSortDialogProps) {
  const opts = folderOptions(folders);
  const busy = saving || preparing;

  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => { if (!busy) onOpenChange(v); }}>
      <ResponsiveDialogContent className="max-w-md font-body">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Où classer ce document ?</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-3.5 py-2">
          {/* File chip */}
          <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl text-sm">
            <FileText size={16} className="text-destructive/70 shrink-0" />
            <span className="truncate font-body text-xs">{fileName}</span>
            <span className="ml-auto text-muted-foreground text-xs shrink-0">
              {preparing ? "préparation…" : formatBytes(fileSize)}
            </span>
          </div>

          {/* Title */}
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Titre</p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nom du document"
              autoFocus
            />
          </div>

          {/* Category + destination folder — stacked on mobile, side-by-side on ≥sm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Catégorie</p>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Dossier</p>
              <Select
                value={folderId ?? "none"}
                onValueChange={(v) => setFolderId(v === "none" ? null : v)}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— À choisir —</SelectItem>
                  {opts.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Urgent toggle */}
          <div className="flex items-start gap-3 p-3 rounded-xl border border-border">
            <Zap size={16} className={`shrink-0 mt-0.5 ${urgent ? "text-red-500" : "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Marquer comme urgent</span>
                <Switch checked={urgent} onCheckedChange={setUrgent} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reste bien visible dans la boîte de tri jusqu'à ce qu'il soit classé.
              </p>
            </div>
          </div>
        </div>

        <ResponsiveDialogFooter className="gap-2">
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={busy}
            onClick={() => onSubmit("to_sort")}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
            À trier plus tard
          </Button>
          <Button
            className="gap-1.5"
            disabled={busy || !folderId}
            onClick={() => onSubmit("filed")}
            title={!folderId ? "Choisis d'abord un dossier" : undefined}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <FolderInput size={14} />}
            Classer ici
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
