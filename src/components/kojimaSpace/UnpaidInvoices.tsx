import { useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useQuotes } from "@/hooks/useQuotes";
import { totalQuote } from "@/types/quote";
import { formatCHF } from "./helpers";

export function UnpaidInvoices() {
  const navigate = useNavigate();
  const { quotes } = useQuotes();

  const unpaidInvoices = useMemo(
    () => quotes
      .filter(q => q.invoiceStatus && q.invoiceStatus !== "paid" && q.invoiceStatus !== "draft" && q.invoiceStatus !== "on-hold")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8),
    [quotes],
  );

  if (unpaidInvoices.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="text-amber-500" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Factures en attente
          </h2>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700">
            {unpaidInvoices.length}
          </Badge>
        </div>
        <Link to="/quotes" className="text-xs font-body text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          Tous les docs <ChevronRight size={11} />
        </Link>
      </div>
      <div className="divide-y divide-border/30">
        {unpaidInvoices.map(q => (
          <div
            key={q.id}
            onClick={() => navigate(`/quotes/${q.id}`)}
            className="flex items-center gap-3 px-5 py-3 hover:bg-secondary/20 cursor-pointer transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-mono text-muted-foreground/60">{q.quoteNumber || "-"}</span>
                <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0",
                  q.invoiceStatus === "validated" ? "border-amber-300 text-amber-600" : "border-primary/30 text-primary",
                )}>
                  {q.invoiceStatus === "validated" ? "Validé" : q.invoiceStatus === "to-validate" ? "À valider" : q.invoiceStatus || "draft"}
                </Badge>
              </div>
              <p className="text-sm font-body font-medium text-foreground/80 truncate">{q.clientName || q.projectTitle || "-"}</p>
            </div>
            <span className="text-sm font-body font-semibold text-foreground/80 tabular-nums shrink-0">
              {formatCHF(totalQuote(q))}
            </span>
            <ChevronRight size={13} className="text-muted-foreground/20 shrink-0" />
          </div>
        ))}
      </div>
    </section>
  );
}
