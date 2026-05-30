import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader,
  ResponsiveDialogTitle, ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowDownRight, ArrowUpRight, Lock, CircleDashed, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { createPayable } from "@/api/payables";
import type { PayableCommitment, PayableDirection } from "@/types/payable";

export interface PayablePrefill {
  label: string;
  amount: string;
  dueDate: string;
  category: string;
  notes: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefill: PayablePrefill | null;
  onCreated?: () => void;
}

export function DocToPayableDialog({ open, onOpenChange, prefill, onCreated }: Props) {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState<PayableDirection>("out");
  const [commitment, setCommitment] = useState<PayableCommitment>("committed");
  const [dueDate, setDueDate] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed the form each time the dialog opens with a fresh extraction.
  useEffect(() => {
    if (open && prefill) {
      setLabel(prefill.label);
      setAmount(prefill.amount);
      setDirection("out");
      setCommitment("committed");
      setDueDate(prefill.dueDate);
      setCategory(prefill.category);
      setNotes(prefill.notes);
    }
  }, [open, prefill]);

  async function handleCreate() {
    if (!label.trim()) { toast.error("Libellé requis"); return; }
    const amt = parseFloat(amount.replace(",", "."));
    if (!isFinite(amt)) { toast.error("Montant invalide"); return; }
    setSaving(true);
    try {
      await createPayable({
        label: label.trim(),
        amount: amt,
        currency: "CHF",
        direction,
        commitment,
        dueDate: dueDate || null,
        status: "pending",
        category: category.trim() || null,
        notes: notes.trim() || null,
        recurrence: "none",
      });
      toast.success("Payable créé", { description: "À vérifier dans Trésorerie → À payer." });
      onCreated?.();
      onOpenChange(false);
    } catch {
      toast.error("Échec de la création du payable");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Receipt size={16} className="text-primary" /> Créer un payable
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-3 py-1">
          <p className="text-[11px] text-muted-foreground font-body">
            Champs extraits automatiquement (estimation) — vérifie avant de créer.
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection("out")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                direction === "out"
                  ? "border-red-500/60 bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowDownRight className="h-4 w-4" /> Sortie
            </button>
            <button
              type="button"
              onClick={() => setDirection("in")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                direction === "in"
                  ? "border-emerald-500/60 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowUpRight className="h-4 w-4" /> Entrée
            </button>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Libellé</label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="ex. Facture Infomaniak" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Montant (CHF)</label>
              <Input type="text" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Échéance</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setCommitment("committed")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                  commitment === "committed"
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Lock className="h-4 w-4" /> Obligatoire
              </button>
              <button
                type="button"
                onClick={() => setCommitment("forecast")}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition",
                  commitment === "forecast"
                    ? "border-amber-500/60 bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <CircleDashed className="h-4 w-4" /> Prévision
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Catégorie</label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="Logiciel, Hébergement, Sous-traitance…" />
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Notes</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Annuler</Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Créer le payable
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
