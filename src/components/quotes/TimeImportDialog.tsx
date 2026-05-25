import { useEffect, useMemo, useState } from "react";
import { Clock, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { suggestQuoteLines, type SuggestedQuoteLines, type SuggestedObjectiveLine } from "@/api/timeBilling";
import { markSessionsBilled } from "@/api/objectiveSessions";
import { useClients } from "@/contexts/ClientsContext";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { toast } from "sonner";
import type { QuoteLineItem } from "@/types/quote";

interface TimeImportDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  /** Quote id when the form has been saved at least once; null otherwise.
   *  Imports are allowed only when we have an id to lock sessions against. */
  quoteId: string | null;
  /** Receives the new line items the user accepted. */
  onImport: (lines: QuoteLineItem[]) => void;
}

type SelectionKey = string; // `obj:<oid>` or `sub:<oid>:<sid>`

function pickObjectiveSelectionKey(obj: SuggestedObjectiveLine): SelectionKey {
  return `obj:${obj.objective}`;
}

function pickSubtaskSelectionKey(obj: SuggestedObjectiveLine, subIdx: number): SelectionKey {
  return `sub:${obj.objective}:${subIdx}`;
}

function lineIdFromKey(): string {
  return crypto.randomUUID?.() ?? `line-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function TimeImportDialog({
  open, onClose, projectId, quoteId, onImport,
}: TimeImportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SuggestedQuoteLines | null>(null);
  const [selected, setSelected] = useState<Set<SelectionKey>>(new Set());
  const [rateOverride, setRateOverride] = useState<string>("");
  const [importing, setImporting] = useState(false);

  const { getClient } = useClients();
  const { settings: companySettings } = useCompanySettings();

  // Effective rate: explicit override > client.hourlyRate > company default.
  const effectiveRate = useMemo(() => {
    const overrideTrim = rateOverride.trim().replace(",", ".");
    if (overrideTrim !== "") {
      const n = Number.parseFloat(overrideTrim);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const clientId = data?.clientId;
    if (clientId) {
      const c = getClient(clientId);
      if (c?.hourlyRate != null && c.hourlyRate > 0) return c.hourlyRate;
    }
    return companySettings.defaultHourlyRate || 120;
  }, [rateOverride, data, getClient, companySettings.defaultHourlyRate]);

  const rateSource: "override" | "client" | "default" = useMemo(() => {
    if (rateOverride.trim() !== "") return "override";
    const cid = data?.clientId;
    if (cid) {
      const c = getClient(cid);
      if (c?.hourlyRate != null && c.hourlyRate > 0) return "client";
    }
    return "default";
  }, [rateOverride, data, getClient]);

  useEffect(() => {
    if (!open || !projectId) return;
    setLoading(true);
    setError(null);
    setData(null);
    setSelected(new Set());
    suggestQuoteLines(projectId)
      .then((res) => {
        setData(res);
        // Pre-select every objective (most common case = bill everything).
        const next = new Set<SelectionKey>();
        for (const obj of res.breakdown) {
          if (obj.hours > 0) next.add(pickObjectiveSelectionKey(obj));
        }
        setSelected(next);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Erreur de chargement"))
      .finally(() => setLoading(false));
  }, [open, projectId]);

  /** Returns the array of session ids that the current selection covers.
   *  Subtask selection takes precedence: if any subtask is picked under an
   *  objective, only the picked subtasks contribute. Otherwise the whole
   *  objective's sessions count. */
  const selectedRows = useMemo(() => {
    if (!data) return [] as { label: string; hours: number; sessionIds: string[] }[];
    const out: { label: string; hours: number; sessionIds: string[] }[] = [];
    for (const obj of data.breakdown) {
      const objKey = pickObjectiveSelectionKey(obj);
      const subKeys = obj.subtasks.map((_, i) => pickSubtaskSelectionKey(obj, i));
      const pickedSubs = obj.subtasks.filter((_, i) => selected.has(subKeys[i]));
      if (pickedSubs.length > 0) {
        for (const st of pickedSubs) {
          out.push({
            label: `${obj.objective} — ${st.subtask}`,
            hours: st.hours,
            sessionIds: st.sessionIds,
          });
        }
      } else if (selected.has(objKey)) {
        out.push({
          label: obj.objective,
          hours: obj.hours,
          sessionIds: obj.sessionIds,
        });
      }
    }
    return out;
  }, [data, selected]);

  const totalHours = useMemo(
    () => selectedRows.reduce((sum, r) => sum + r.hours, 0),
    [selectedRows],
  );
  const totalAmount = useMemo(
    () => Math.round(totalHours * effectiveRate * 100) / 100,
    [totalHours, effectiveRate],
  );
  const allSessionIds = useMemo(
    () => Array.from(new Set(selectedRows.flatMap((r) => r.sessionIds))),
    [selectedRows],
  );

  function toggle(key: SelectionKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleImport() {
    if (!data || !quoteId || selectedRows.length === 0) return;
    setImporting(true);
    try {
      // Mark sessions billed first; if that fails, we don't push lines and the
      // user can retry without ending up double-counting.
      await markSessionsBilled(allSessionIds, quoteId);
      const newLines: QuoteLineItem[] = selectedRows.map((r) => ({
        id: lineIdFromKey(),
        description: `**${r.label}**\nTemps tracé : ${r.hours.toFixed(2)} h × ${effectiveRate} CHF/h`,
        quantity: r.hours,
        unitPrice: effectiveRate,
      }));
      onImport(newLines);
      toast.success(
        `${newLines.length} ligne${newLines.length > 1 ? "s" : ""} importée${newLines.length > 1 ? "s" : ""} — sessions verrouillées`,
      );
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import échoué");
    } finally {
      setImporting(false);
    }
  }

  const empty = data && data.breakdown.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock size={16} />
            Importer le temps tracé
          </DialogTitle>
          <DialogDescription>
            Sélectionne les objectifs / sous-tâches à facturer. Les sessions
            associées seront verrouillées pour qu'elles n'apparaissent plus dans
            une prochaine facture.
          </DialogDescription>
        </DialogHeader>

        {!quoteId && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>Enregistre le devis une fois avant l'import — il faut un identifiant pour verrouiller les sessions.</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Chargement…
          </div>
        ) : error ? (
          <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        ) : empty ? (
          <div className="text-center py-8 text-sm text-muted-foreground">
            Aucun temps tracé non facturé sur ce projet.
          </div>
        ) : data ? (
          <div className="space-y-4">
            {/* Rate override row */}
            <div className="rounded-lg border border-border bg-card/40 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Label htmlFor="time-import-rate" className="text-xs font-semibold">
                  Taux horaire (CHF/h)
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="time-import-rate"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={rateOverride}
                    onChange={(e) => setRateOverride(e.target.value)}
                    placeholder={String(effectiveRate)}
                    className="w-28 h-8 text-right tabular-nums"
                  />
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    = {effectiveRate} CHF/h
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                Source :{" "}
                {rateSource === "override" ? "saisi manuellement"
                  : rateSource === "client" ? "taux personnalisé du client"
                  : "taux par défaut (Réglages)"}
              </p>
            </div>

            {/* Breakdown rows */}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {data.breakdown.map((obj) => {
                const objKey = pickObjectiveSelectionKey(obj);
                const objSelected = selected.has(objKey);
                const anySubSelected = obj.subtasks.some((_, i) => selected.has(pickSubtaskSelectionKey(obj, i)));
                return (
                  <div key={objKey} className={cn(
                    "rounded-lg border p-3 transition-colors",
                    objSelected || anySubSelected
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card/30",
                  )}>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox
                        checked={objSelected}
                        onCheckedChange={() => toggle(objKey)}
                        aria-label={`Inclure ${obj.objective}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm font-medium text-foreground truncate">
                            {obj.objective}
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {obj.hours.toFixed(2)} h · {obj.sessions} session{obj.sessions > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </label>

                    {obj.subtasks.length > 0 && (
                      <ul className="mt-2 ml-7 space-y-1 border-l border-border/50 pl-3">
                        {obj.subtasks.map((st, i) => {
                          const stKey = pickSubtaskSelectionKey(obj, i);
                          const stSelected = selected.has(stKey);
                          return (
                            <li key={stKey}>
                              <label className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={stSelected}
                                  onCheckedChange={() => toggle(stKey)}
                                  aria-label={`Inclure la sous-tâche ${st.subtask}`}
                                />
                                <span className="text-xs text-foreground/80 truncate flex-1">
                                  {st.subtask}
                                </span>
                                <span className="text-[11px] tabular-nums text-muted-foreground">
                                  {st.hours.toFixed(2)} h
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-secondary/40 border border-border px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedRows.length} ligne{selectedRows.length > 1 ? "s" : ""} · {totalHours.toFixed(2)} h
              </span>
              <span className="font-semibold tabular-nums">
                {totalAmount.toLocaleString("fr-CH", { style: "currency", currency: "CHF" })}
              </span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Annuler</Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={!quoteId || selectedRows.length === 0 || importing}
          >
            {importing ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
            Importer {selectedRows.length > 0 ? `${selectedRows.length} ligne${selectedRows.length > 1 ? "s" : ""}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
