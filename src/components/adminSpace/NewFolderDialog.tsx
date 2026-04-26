import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm font-body">
        <DialogHeader>
          <DialogTitle>Nouveau dossier</DialogTitle>
        </DialogHeader>
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
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Annuler</Button>
          <Button onClick={onCreate} disabled={!name.trim()}>
            <FolderPlus size={14} className="mr-1" /> Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
