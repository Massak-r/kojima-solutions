import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Folder, FolderPlus } from "lucide-react";

interface NewFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  setName: (v: string) => void;
  parentFolderName: string | null;
  onCreate: () => void;
  onCancel: () => void;
}

export function NewFolderDialog({
  open, onOpenChange, name, setName, parentFolderName, onCreate, onCancel,
}: NewFolderDialogProps) {
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-sm font-body">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Nouveau dossier</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <div className="py-2">
          {parentFolderName && (
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
              <Folder size={12} className="text-primary" />
              Dans : {parentFolderName}
            </p>
          )}
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Nom du dossier"
            onKeyDown={e => e.key === "Enter" && onCreate()}
            autoFocus
          />
        </div>
        <ResponsiveDialogFooter>
          <Button variant="ghost" onClick={onCancel}>Annuler</Button>
          <Button onClick={onCreate} disabled={!name.trim()}>
            <FolderPlus size={14} className="mr-1" /> Créer
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
