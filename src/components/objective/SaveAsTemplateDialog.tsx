import { useState } from "react";
import { Loader2, BookmarkPlus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { saveAsTemplate } from "@/api/objectiveTemplates";
import type { ObjectiveSource } from "@/api/objectiveSource";

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  source: ObjectiveSource;
  objectiveId: string;
  defaultName?: string;
  onSaved?: () => void;
}

export function SaveAsTemplateDialog({
  open, onOpenChange, source, objectiveId, defaultName, onSaved,
}: SaveAsTemplateDialogProps) {
  const { toast } = useToast();
  const [name, setName]     = useState(defaultName ?? "");
  const [desc, setDesc]     = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const n = name.trim();
    if (!n) return;
    setSaving(true);
    try {
      await saveAsTemplate({
        name: n,
        description: desc.trim() || undefined,
        sourceSource: source,
        sourceObjectiveId: objectiveId,
      });
      toast({ title: "Modèle enregistré" });
      setName(""); setDesc("");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Échec de l'enregistrement", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) { setName(defaultName ?? ""); setDesc(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Enregistrer comme modèle</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="text-xs font-body text-muted-foreground">
            Capture l'arborescence actuelle des étapes dans un modèle réutilisable.
          </div>
          <div>
            <label className="text-[11px] font-display font-bold text-foreground/60 uppercase tracking-wider">Nom</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex. Checklist SARL"
              autoFocus
              className="w-full mt-1 text-sm font-body bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-[11px] font-display font-bold text-foreground/60 uppercase tracking-wider">Description <span className="text-muted-foreground/50 font-normal normal-case">(facultatif)</span></label>
            <textarea
              value={desc}
              onChange={e => setDesc(e.target.value)}
              rows={3}
              placeholder="À quoi sert ce modèle ?"
              className="w-full mt-1 text-sm font-body bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving ? <Loader2 size={14} className="mr-1 animate-spin" /> : <BookmarkPlus size={14} className="mr-1" />}
            Enregistrer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
