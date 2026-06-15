import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellRing, AlertTriangle, Receipt, FileClock, Snowflake,
  ChevronRight, CheckCircle2,
} from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/contexts/ClientsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { computeRelances, type RelanceItem, type RelanceTone } from "@/lib/relances";
import { formatCHF } from "@/components/kojimaSpace/helpers";
import { cn } from "@/lib/utils";

const DAY_BADGE: Record<RelanceTone, string> = {
  danger: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
  warn: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  info: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
};

function RelanceRow({ item }: { item: RelanceItem }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(item.href)}
      className="w-full flex items-center gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors text-left group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          {item.ref && (
            <span className="text-xs font-mono text-muted-foreground/60">{item.ref}</span>
          )}
          <span className={cn("text-[10px] font-semibold px-1.5 py-0 rounded-full leading-relaxed", DAY_BADGE[item.tone])}>
            {item.days}j
          </span>
        </div>
        <p className="text-sm font-body font-medium text-foreground/90 truncate">{item.client}</p>
        <p className="text-[11px] font-body text-muted-foreground/70 truncate">{item.reason}</p>
      </div>
      {item.amount != null && (
        <span className="text-sm font-body font-semibold text-foreground/90 tabular-nums shrink-0">
          {formatCHF(item.amount)}
        </span>
      )}
      <ChevronRight size={14} className="text-muted-foreground/30 group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}

export default function Relances() {
  const { quotes } = useQuotes();
  const { clients } = useClients();
  const { projects } = useProjects();

  const r = useMemo(
    () => computeRelances(quotes, clients, projects, new Date()),
    [quotes, clients, projects],
  );

  const sections = [
    {
      items: r.overdueInvoices, icon: AlertTriangle, iconClassName: "text-destructive",
      title: "Factures en retard", money: true,
    },
    {
      items: r.toInvoice, icon: Receipt, iconClassName: "text-emerald-600",
      title: "À facturer", money: true,
    },
    {
      items: r.expiredDevis, icon: FileClock, iconClassName: "text-amber-600",
      title: "Devis à relancer", money: false,
    },
    {
      items: r.coldClients, icon: Snowflake, iconClassName: "text-blue-500",
      title: "Clients à reprendre", money: false,
    },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground py-8 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <BellRing size={22} className="text-accent" />
            <span className="font-body text-sm font-semibold tracking-widest uppercase text-primary-foreground/60">
              Relances
            </span>
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-bold leading-tight">À relancer</h1>
          <p className="font-body text-primary-foreground/65 mt-1 text-sm">
            Argent à encaisser, devis en attente, clients à reprendre — au même endroit.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 md:px-12 py-8 space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              À encaisser
            </div>
            <div className="text-2xl font-display font-bold tabular-nums leading-tight text-foreground">
              {formatCHF(r.atStake)}
            </div>
            <div className="text-[11px] font-body text-muted-foreground/70">factures + devis validés</div>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Actions
            </div>
            <div className={cn(
              "text-2xl font-display font-bold tabular-nums leading-tight",
              r.count > 0 ? "text-foreground" : "text-emerald-600",
            )}>
              {r.count}
            </div>
            <div className="text-[11px] font-body text-muted-foreground/70">en attente aujourd'hui</div>
          </div>
        </div>

        {r.count === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 flex flex-col items-center text-center gap-2">
            <CheckCircle2 size={32} className="text-emerald-500" />
            <p className="font-display text-base font-bold text-foreground">Rien à relancer</p>
            <p className="font-body text-sm text-muted-foreground">
              Tout est à jour — aucune facture en retard, aucun devis qui traîne. 🎉
            </p>
          </div>
        ) : (
          sections.map((s) => {
            const total = s.items.reduce((sum, it) => sum + (it.amount ?? 0), 0);
            return (
              <SectionCard
                key={s.title}
                icon={s.icon}
                iconClassName={s.iconClassName}
                title={s.title}
                action={
                  <span className="text-[11px] font-body text-muted-foreground tabular-nums shrink-0">
                    {s.items.length}{s.money && total > 0 ? ` · ${formatCHF(total)}` : ""}
                  </span>
                }
                bodyClassName="p-0"
              >
                <div className="divide-y divide-border/30">
                  {s.items.map((it) => (
                    <RelanceRow key={`${it.kind}-${it.id}`} item={it} />
                  ))}
                </div>
              </SectionCard>
            );
          })
        )}
      </div>
    </div>
  );
}
