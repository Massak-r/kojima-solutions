import { useState } from "react";
import { Upload, Check, AlertTriangle, Landmark, ArrowDownLeft, CircleHelp } from "lucide-react";
import { useQuotes } from "@/hooks/useQuotes";
import { parseCamt, reconcile, type CamtMatch } from "@/lib/camt";
import { totalQuote } from "@/types/quote";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

function chf(n: number): string {
  return new Intl.NumberFormat("fr-CH", { maximumFractionDigits: 2 }).format(n).replace(/\s/g, "'") + " CHF";
}

/**
 * Bank reconciliation: import a CAMT.05x statement (.xml) from the bank, match
 * each incoming credit to an open invoice (by the invoice number printed in the
 * payment, then by amount), and mark the confirmed ones paid in one go.
 */
export function CamtReconcile() {
  const { quotes, updateQuote } = useQuotes();
  const [matches, setMatches] = useState<CamtMatch[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same file be re-picked later
    if (!file) return;
    setError("");
    try {
      const m = reconcile(parseCamt(await file.text()), quotes);
      setMatches(m);
      setFileName(file.name);
      // Pre-select the confident ones: matched invoice AND amount lines up.
      setSelected(new Set(m.filter((x) => x.invoice && x.amountMatches).map((x) => x.invoice!.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lecture impossible.");
      setMatches(null);
    }
  }

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function markPaid() {
    const toMark = (matches ?? []).filter((m) => m.invoice && selected.has(m.invoice.id));
    for (const m of toMark) updateQuote(m.invoice!.id, { ...m.invoice!, invoiceStatus: "paid" });
    toast({ title: `${toMark.length} facture${toMark.length > 1 ? "s" : ""} marquée${toMark.length > 1 ? "s" : ""} payée${toMark.length > 1 ? "s" : ""}` });
    setMatches(null);
    setSelected(new Set());
    setFileName("");
  }

  const matchedCount = matches?.filter((m) => m.invoice).length ?? 0;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Intro / upload */}
      <div className="rounded-2xl border border-border bg-card shadow-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Landmark size={18} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-foreground">Rapprochement bancaire</h2>
            <p className="mt-1 text-sm font-body text-muted-foreground">
              Importe le relevé <span className="font-medium text-foreground">CAMT.053</span> (.xml) de ta banque — on
              rapproche les paiements reçus avec tes factures et tu marques les bons d'un clic.
            </p>
            <label className="mt-4 inline-flex">
              <input type="file" accept=".xml,application/xml,text/xml" className="hidden" onChange={onFile} />
              <span className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-primary text-primary-foreground text-sm font-body font-medium cursor-pointer hover:bg-primary/90 transition-colors">
                <Upload size={15} /> Importer un relevé CAMT
              </span>
            </label>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center gap-2 text-sm font-body text-destructive">
          <AlertTriangle size={15} className="shrink-0" /> {error}
        </div>
      )}

      {matches && (
        <div className="rounded-2xl border border-border bg-card shadow-card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border flex-wrap">
            <p className="text-sm font-body text-muted-foreground truncate">
              <span className="font-medium text-foreground">{fileName}</span>
              {" · "}{matches.length} crédit{matches.length > 1 ? "s" : ""} · {matchedCount} rapproché{matchedCount > 1 ? "s" : ""}
            </p>
            <Button size="sm" onClick={markPaid} disabled={selected.size === 0} className="gap-1.5">
              <Check size={15} /> Marquer payées ({selected.size})
            </Button>
          </div>

          {matches.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm font-body text-muted-foreground">
              Aucun paiement entrant dans ce relevé.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {matches.map((m, i) => {
                const matched = !!m.invoice;
                const checked = m.invoice ? selected.has(m.invoice.id) : false;
                return (
                  <li key={i} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                    {matched ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => m.invoice && toggle(m.invoice.id)}
                        className="h-4 w-4 shrink-0 rounded border-muted-foreground/40 accent-emerald-500 cursor-pointer"
                        aria-label="Marquer payée"
                      />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}

                    {/* Bank credit */}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-body font-semibold text-foreground tabular-nums">
                        <ArrowDownLeft size={13} className="text-emerald-600 shrink-0" />
                        {chf(m.entry.amount)}
                        {m.entry.date && <span className="text-[11px] font-normal text-muted-foreground">· {m.entry.date.slice(5)}</span>}
                      </p>
                      <p className="text-xs font-body text-muted-foreground truncate">
                        {m.entry.counterparty || "—"}
                        {m.entry.reference && <span className="text-muted-foreground/60"> · {m.entry.reference}</span>}
                      </p>
                    </div>

                    {/* Match */}
                    <div className="shrink-0 text-right">
                      {matched ? (
                        <>
                          <p className="text-xs font-body font-medium text-foreground">{m.invoice!.quoteNumber}</p>
                          {m.amountMatches ? (
                            <p className="text-[10px] font-body text-emerald-600 flex items-center gap-0.5 justify-end">
                              <Check size={10} /> montant exact
                            </p>
                          ) : (
                            <p className="text-[10px] font-body text-amber-600 flex items-center gap-0.5 justify-end" title={`Facture : ${chf(totalQuote(m.invoice!))}`}>
                              <AlertTriangle size={10} /> écart ({chf(totalQuote(m.invoice!))})
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-[11px] font-body text-muted-foreground flex items-center gap-1 justify-end">
                          <CircleHelp size={11} /> Non rapproché
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
