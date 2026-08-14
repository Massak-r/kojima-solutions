import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCHF } from "@/components/kojimaSpace/helpers";
import { listPayables } from "@/api/payables";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import { groupByCategory } from "@/lib/moneyCategories";

/**
 * Où part l'argent ce mois-ci, et ce qui rentre.
 *
 * Forme : des barres horizontales, pas un camembert. Dix parts d'un camembert
 * sur un écran de téléphone ne se comparent pas, alors qu'une liste triée du
 * plus lourd au plus léger se lit en une seconde et laisse la place d'écrire le
 * nom de chaque poste.
 *
 * Couleur : **une seule teinte**. Chaque barre porte déjà son libellé, donc une
 * couleur par catégorie n'encoderait rien — elle décorerait. Le montant encaissé
 * est un chiffre, pas une série : il ne rentre pas en concurrence visuelle avec
 * les barres, et il n'y a donc aucune paire de teintes à distinguer.
 * (Teintes vérifiées avec le validateur de palette, clair et sombre.)
 */

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export function MonthMoneyBreakdown() {
  const reduceMotion = useReducedMotion();
  const { quotes } = useQuotes();
  const { data: payables = [] } = useQuery({
    queryKey: ["admin-center", "payables"],
    queryFn: () => listPayables(),
    staleTime: 60_000,
  });

  const view = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Tout ce qui est dû ce mois-ci, payé ou non : la question est « où part
    // l'argent », pas « que reste-t-il ». Les projections et les lignes annulées
    // n'en font pas partie.
    const dueThisMonth = payables.filter(
      (p) => p.direction === "out"
        && p.commitment === "committed"
        && p.status !== "cancelled"
        && (p.dueDate ?? "").startsWith(prefix),
    );

    const { totals, total } = groupByCategory(
      dueThisMonth.map((p) => ({ category: p.category, amount: p.amount })),
    );

    const remaining = dueThisMonth
      .filter((p) => p.status !== "paid")
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);

    const cashedIn = quotes
      .filter((q) => !q.isTemplate
        && q.docType === "invoice"
        && q.invoiceStatus === "paid"
        && (q.paidAt ?? "").startsWith(prefix))
      .reduce((sum, q) => sum + totalQuote(q), 0);

    return { totals, total, remaining, cashedIn, month: MONTHS[now.getMonth()] };
  }, [payables, quotes]);

  if (view.total === 0 && view.cashedIn === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card shadow-card overflow-hidden mb-5">
      <div className="px-5 py-3.5 border-b border-border">
        <h2 className="text-eyebrow">Ce mois · {view.month}</h2>
      </div>

      <div className="p-5 space-y-5">
        {/* Deux chiffres, deux directions — le contraste se lit dans les mots et
            les flèches, jamais dans la couleur seule. */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowDownRight size={13} className="shrink-0" />
              <span className="text-[11px] font-body font-semibold uppercase tracking-wider">Sorties</span>
            </div>
            <p className="font-display text-2xl font-bold tabular-nums leading-tight mt-1">
              {formatCHF(view.total)}
            </p>
            {view.remaining > 0 && (
              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                dont {formatCHF(view.remaining)} à sortir
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpRight size={13} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="text-[11px] font-body font-semibold uppercase tracking-wider">Encaissé</span>
            </div>
            <p className="font-display text-2xl font-bold tabular-nums leading-tight mt-1">
              {formatCHF(view.cashedIn)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">factures payées</p>
          </div>
        </div>

        {view.totals.length > 0 && (
          <ul className="space-y-2.5">
            {view.totals.map((t, i) => (
              <li key={t.category}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-sm font-body text-foreground/85 truncate">{t.label}</span>
                  <span className="text-sm font-body tabular-nums text-foreground/70 shrink-0">
                    {formatCHF(t.amount)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[#3167C4] dark:bg-[#5B8AD9]"
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${Math.max(2, t.share * 100)}%` }}
                    transition={reduceMotion
                      ? { duration: 0 }
                      : { duration: 0.55, delay: 0.05 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
