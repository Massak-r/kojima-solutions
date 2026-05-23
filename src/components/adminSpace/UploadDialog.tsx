import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FileText, Folder, Upload, Loader2 } from "lucide-react";
import { DOC_CATEGORIES, YEAR_OPTIONS, formatBytes } from "./helpers";

interface UploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pendingFile: File | null;
  uploadTitle: string;
  setUploadTitle: (v: string) => void;
  uploadCat: string;
  setUploadCat: (v: string) => void;
  uploadYear: string;
  setUploadYear: (v: string) => void;
  uploading: boolean;
  currentFolderName: string | null;
  onUpload: () => void;
  onCancel: () => void;
}

export function UploadDialog({
  open, onOpenChange, pendingFile,
  uploadTitle, setUploadTitle,
  uploadCat, setUploadCat,
  uploadYear, setUploadYear,
  uploading, currentFolderName,
  onUpload, onCancel,
}: UploadDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-md font-body">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Ajouter un document</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="space-y-3 py-2">
          {pendingFile && (
            <div className="flex items-center gap-2 p-3 bg-secondary/50 rounded-xl text-sm">
              <FileText size={16} className="text-destructive/70 shrink-0" />
              <span className="truncate font-body text-xs">{pendingFile.name}</span>
              <span className="ml-auto text-muted-foreground text-xs shrink-0">{formatBytes(pendingFile.size)}</span>
            </div>
          )}
          {currentFolderName && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-secondary/30 rounded-lg">
              <Folder size={12} className="text-primary" />
              Dossier : {currentFolderName}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={onCancel}>Annuler</Button>
          <Button onClick={onUpload} disabled={uploading || !uploadTitle.trim()}>
            {uploading ? <Loader2 size={14} className="animate-spin mr-1" /> : <Upload size={14} className="mr-1" />}
            Enregistrer
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
