import { useEffect, useState } from "react";
import { PiggyBank, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCHF } from "@/components/accounting/utils";

const RATE_KEY = "kojima-tax-provision-rate";

interface Props {
  /** Encaissé TTC sur l'année (factures payées). */
  revenueTTC: number;
  /** TVA effectivement collectée sur ces factures (à reverser). */
  tvaCollected: number;
  /** Charges de l'année. */
  expenses: number;
  year: number;
}

/**
 * "Est-ce vraiment mon argent ?" — sépare ce qui est encaissé de ce qu'il faut
 * mettre de côté (TVA due + provision impôts) pour révéler le disponible réel.
 * Le taux d'impôt est indicatif et configurable (persisté en local).
 */
export function TaxSetAside({ revenueTTC, tvaCollected, expenses, year }: Props) {
  const [rate, setRate] = useState<number>(() => {
    const raw = localStorage.getItem(RATE_KEY);
    const n = raw ? parseFloat(raw) : NaN;
    return isFinite(n) ? n : 25;
  });
  useEffect(() => { localStorage.setItem(RATE_KEY, String(rate)); }, [rate]);

  const revenueHT = Math.max(0, revenueTTC - tvaCollected);
  const profit = Math.max(0, revenueHT - expenses);
  const taxProvision = profit * (rate / 100);
  const setAside = tvaCollected + taxProvision;
  const available = revenueTTC - setAside;

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <PiggyBank size={16} className="text-primary" />
        <h2 className="font-display text-base font-semibold text-foreground">À mettre de côté {year}</h2>
      </div>

      <dl className="space-y-2 font-body text-sm">
        <div className="flex justify-between items-center">
          <dt className="text-muted-foreground">Encaissé (TTC)</dt>
          <dd className="font-medium tabular-nums">{formatCHF(revenueTTC)}</dd>
        </div>
        <div className="flex justify-between items-center text-amber-700 dark:text-amber-400">
          <dt>TVA à reverser</dt>
          <dd className="font-medium tabular-nums">−{formatCHF(tvaCollected)}</dd>
        </div>
        <div className="flex justify-between items-center gap-3 text-amber-700 dark:text-amber-400">
          <dt className="flex items-center gap-1.5">
            Provision impôts
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              (
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                max={60}
                value={rate}
                onChange={(e) => {
                  const n = parseFloat(e.target.value);
                  setRate(isFinite(n) ? Math.min(60, Math.max(0, n)) : 0);
                }}
                className="h-6 w-14 px-1.5 text-xs text-right tabular-nums"
                aria-label="Taux de provision impôts en pourcent"
              />
              % du bénéfice)
            </span>
          </dt>
          <dd className="font-medium tabular-nums shrink-0">−{formatCHF(taxProvision)}</dd>
        </div>

        <div className="flex justify-between items-center border-t border-border pt-2 mt-2 text-foreground font-bold">
          <dt>À provisionner</dt>
          <dd className="tabular-nums">{formatCHF(setAside)}</dd>
        </div>
        <div className={cn(
          "flex justify-between items-center text-base font-bold",
          available >= 0 ? "text-palette-sage" : "text-destructive",
        )}>
          <dt className="text-foreground">Disponible (estimé)</dt>
          <dd className="tabular-nums">{formatCHF(available)}</dd>
        </div>
      </dl>

      <p className="text-xs font-body text-muted-foreground flex gap-2">
        <Info size={13} className="shrink-0 mt-0.5 text-primary" />
        <span>
          Bénéfice estimé = encaissé HT ({formatCHF(revenueHT)}) − charges ({formatCHF(expenses)}).
          Le taux d'impôt est indicatif (ajuste-le selon ta situation Vaud/fédéral) — confirme avec ta fiduciaire.
        </span>
      </p>
    </div>
  );
}
