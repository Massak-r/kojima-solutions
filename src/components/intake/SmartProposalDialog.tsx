import { useEffect, useMemo, useState } from "react";
import { Sparkles, FileText, User, RotateCcw, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useClients } from "@/contexts/ClientsContext";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import type { IntakeResponse } from "@/api/funnels";
import { generateProposal, type ProposalDraft } from "@/lib/proposalGenerator";

function formatCHF(n: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF", maximumFractionDigits: 0,
  }).format(n).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
}

interface SmartProposalDialogProps {
  open: boolean;
  intake: IntakeResponse | null;
  onClose: () => void;
  /** Called with the (possibly edited) proposal when the user confirms. */
  onConfirm: (proposal: ProposalDraft) => Promise<void> | void;
}

export function SmartProposalDialog({
  open, intake, onClose, onConfirm,
}: SmartProposalDialogProps) {
  const { clients } = useClients();
  const { settings } = useCompanySettings();
  const [working, setWorking] = useState(false);

  // Source proposal — regenerated each time the intake changes. Then we
  // keep the user's edits in `draft` while keeping `original` around for
  // the "Réinitialiser" button.
  const original = useMemo<ProposalDraft | null>(
    () => (open && intake ? generateProposal(intake, clients, settings) : null),
    [open, intake, clients, settings],
  );

  const [draft, setDraft] = useState<ProposalDraft | null>(null);

  // Sync local edits when the source intake changes (next dialog open, or
  // user switches intakes without closing). Effect not render — keeps React
  // happy and avoids the "setState during render" warning.
  useEffect(() => {
    if (original) setDraft(original);
  }, [original]);

  if (!draft || !original) return null;

  async function handleConfirm() {
    if (!draft) return;
    setWorking(true);
    try {
      await onConfirm(draft);
    } finally {
      setWorking(false);
    }
  }

  function handleReset() {
    if (original) setDraft(original);
  }

  function patchLine(idx: number, patch: Partial<{ description: string; quantity: number; unitPrice: number }>) {
    setDraft((d) => {
      if (!d) return d;
      const next = [...d.lineItems];
      next[idx] = { ...next[idx], ...patch };
      return { ...d, lineItems: next };
    });
  }

  function removeLine(idx: number) {
    setDraft((d) => {
      if (!d) return d;
      const next = d.lineItems.filter((_, i) => i !== idx);
      return { ...d, lineItems: next.length === 0 ? d.lineItems : next };
    });
  }

  const lineTotal = draft.lineItems.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !working) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Devis pré-rempli depuis l'intake
          </DialogTitle>
          <DialogDescription>
            Revois la proposition avant de créer le projet et le devis. Les conditions, les paiements et les lignes sont déjà adaptés au type de projet et au budget.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 -mx-6 px-6 space-y-5 py-1">
          {/* Client + project */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User size={11} /> Client &amp; projet
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom client</Label>
                <Input
                  value={draft.clientName}
                  onChange={(e) => setDraft((d) => d ? { ...d, clientName: e.target.value } : d)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  value={draft.clientEmail}
                  onChange={(e) => setDraft((d) => d ? { ...d, clientEmail: e.target.value } : d)}
                  className="h-9 text-sm"
                  type="email"
                  inputMode="email"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Titre du projet</Label>
                <Input
                  value={draft.projectTitle}
                  onChange={(e) => setDraft((d) => d ? { ...d, projectTitle: e.target.value } : d)}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Description (incluse dans le devis)</Label>
                <Textarea
                  value={draft.projectDescription}
                  onChange={(e) => setDraft((d) => d ? { ...d, projectDescription: e.target.value } : d)}
                  rows={4}
                  className="text-sm resize-none"
                />
              </div>
            </div>
            {draft.existingClientId && (
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                Client existant détecté — pas de doublon créé.
              </p>
            )}
          </section>

          {/* Line items */}
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <FileText size={11} /> Lignes du devis
            </h3>
            <div className="space-y-1.5">
              {draft.lineItems.map((line, idx) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 rounded-lg bg-secondary/30">
                  <Input
                    value={line.description}
                    onChange={(e) => patchLine(idx, { description: e.target.value })}
                    className="col-span-12 sm:col-span-7 h-8 text-xs"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => patchLine(idx, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                    className="col-span-3 sm:col-span-2 h-8 text-xs tabular-nums"
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="1"
                    value={line.unitPrice}
                    onChange={(e) => patchLine(idx, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                    className="col-span-6 sm:col-span-2 h-8 text-xs tabular-nums"
                  />
                  <button
                    onClick={() => removeLine(idx)}
                    className="col-span-3 sm:col-span-1 text-[11px] text-muted-foreground hover:text-destructive transition-colors"
                    title="Retirer cette ligne"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {draft.lineItems.length} ligne{draft.lineItems.length > 1 ? "s" : ""}
              </span>
              <span className="text-sm font-semibold tabular-nums">{formatCHF(lineTotal)}</span>
            </div>
            {draft.yearlyTotal > 0 && (
              <p className="text-[11px] text-muted-foreground/80">
                Inclut <strong>{formatCHF(draft.yearlyTotal)}</strong> de frais annuels récurrents (hébergement + maintenance).
              </p>
            )}
            {draft.estimateBand && (
              <p className="text-[11px] text-muted-foreground/80">
                Estimation de l'intake : {formatCHF(draft.estimateBand.low)} – {formatCHF(draft.estimateBand.high)}.
              </p>
            )}
          </section>

          {/* Conditions + payment */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Conditions (preset auto)</Label>
              <Textarea
                value={draft.conditions}
                onChange={(e) => setDraft((d) => d ? { ...d, conditions: e.target.value } : d)}
                rows={4}
                className="text-[11px] resize-none font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Modalités de paiement (preset auto)</Label>
              <Textarea
                value={draft.paymentTerms}
                onChange={(e) => setDraft((d) => d ? { ...d, paymentTerms: e.target.value } : d)}
                rows={4}
                className="text-[11px] resize-none font-mono"
              />
            </div>
          </section>

          {/* Heuristic reasons (debug, low-key) */}
          <div className="flex flex-wrap gap-1.5">
            {draft.reasons.map((r) => (
              <Badge key={r} variant="outline" className={cn("text-[10px] text-muted-foreground/70")}>{r}</Badge>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={working}
            className="text-xs gap-1"
          >
            <RotateCcw size={12} />
            Réinitialiser
          </Button>
          <Button variant="outline" size="sm" onClick={onClose} disabled={working}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={working}>
            {working ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Sparkles size={14} className="mr-1.5" />}
            Créer projet + devis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
