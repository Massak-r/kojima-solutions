import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Receipt, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import { formatCHF } from "@/components/kojimaSpace/helpers";

/**
 * Validated quotes (docType=quote, status=validated) waiting to be turned
 * into invoices — accepted by the client but not yet billed. Direct revenue
 * leak surface. Returns null when there's nothing to bill.
 */
export function QuotesToInvoice() {
  const navigate = useNavigate();
  const { quotes } = useQuotes();

  const items = useMemo(
    () => quotes
      .filter((q) => !q.isTemplate && q.docType !== "invoice" && q.invoiceStatus === "validated")
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, 8),
    [quotes],
  );

  if (items.length === 0) return null;

  const total = items.reduce((s, q) => s + totalQuote(q), 0);

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Receipt size={14} className="text-emerald-600" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            À facturer
          </h2>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700"
          >
            {items.length}
          </Badge>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
          {formatCHF(total)}
        </span>
      </div>
      <div className="divide-y divide-border/30">
        {items.map((q) => {
          const days = Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 86400000);
          const isStale = days >= 7;
          const target = q.projectId
            ? `/project/${q.projectId}/documents`
            : `/quotes/${q.id}`;
          return (
            <button
              key={q.id}
              onClick={() => navigate(target)}
              className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/30 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs font-mono text-muted-foreground/60">
                    {q.quoteNumber || "—"}
                  </span>
                  {isStale && (
                    <Badge
                      variant="secondary"
                      className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700"
                    >
                      {days}j
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-body font-medium text-foreground/80 truncate">
                  {q.clientName || q.projectTitle || "—"}
                </p>
              </div>
              <span className="text-sm font-body font-semibold text-foreground/80 tabular-nums shrink-0">
                {formatCHF(totalQuote(q))}
              </span>
              <ChevronRight
                size={13}
                className="text-muted-foreground/30 group-hover:text-foreground transition-colors shrink-0"
              />
            </button>
          );
        })}
      </div>
      <div className="px-5 py-2 border-t border-border/40 bg-secondary/20">
        <Link
          to="/quotes"
          className="text-[10px] font-body text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          Voir tous les devis
          <ChevronRight size={10} />
        </Link>
      </div>
    </section>
  );
}
