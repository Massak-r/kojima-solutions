import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Clock, FileWarning, TrendingDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuotes } from "@/hooks/useQuotes";
import { useCompanySettings } from "@/contexts/CompanySettingsContext";
import { totalQuote } from "@/types/quote";
import { getUnbilledSummary } from "@/api/objectiveSessions";

const BALANCE_STORAGE_KEY = "kojima-current-balance";
const DORMANT_DAYS = 30;
const RUNWAY_WARN_MONTHS = 6;

function formatCHF(n: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF", maximumFractionDigits: 0,
  }).format(n).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

interface InsightCardProps {
  icon: typeof Clock;
  tone: "warn" | "info" | "danger";
  title: string;
  metric: string;
  hint: string;
  onClick: () => void;
}

function InsightCard({ icon: Icon, tone, title, metric, hint, onClick }: InsightCardProps) {
  const toneClasses = {
    warn:   "border-amber-300/60 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/8",
    info:   "border-primary/30 bg-primary/5",
    danger: "border-red-300/60 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/8",
  };
  const iconClasses = {
    warn:   "text-amber-700 dark:text-amber-300",
    info:   "text-primary",
    danger: "text-red-700 dark:text-red-300",
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "rounded-2xl border p-4 text-left transition-all hover:shadow-card hover:-translate-y-0.5 group",
        toneClasses[tone],
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className={cn("p-1.5 rounded-lg bg-card/60", iconClasses[tone])}>
          <Icon size={14} />
        </div>
        <ArrowRight size={14} className="text-muted-foreground/50 group-hover:text-foreground transition-colors" />
      </div>
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body font-semibold">
          {title}
        </p>
        <p className="text-xl font-bold tabular-nums font-body">{metric}</p>
        <p className="text-[11px] text-muted-foreground/80 leading-snug">{hint}</p>
      </div>
    </motion.button>
  );
}

/** Operator-side signals worth elevating to Home. Each card returns null
 *  when the underlying metric is at zero, so the row auto-collapses. */
export function OperatorInsights() {
  const navigate = useNavigate();
  const { quotes } = useQuotes();
  const { settings } = useCompanySettings();
  const { data: unbilled } = useQuery({
    queryKey: ["unbilled-summary"],
    queryFn: getUnbilledSummary,
    staleTime: 60_000,
  });

  // 1. Dormant quotes — draft quotes (not yet sent) older than 30 days.
  const dormant = useMemo(() => {
    return quotes.filter((q) =>
      q.docType !== "invoice"
      && q.invoiceStatus === "draft"
      && q.isTemplate !== true
      && daysSince(q.createdAt) >= DORMANT_DAYS,
    );
  }, [quotes]);

  const dormantTotal = useMemo(
    () => dormant.reduce((s, q) => s + totalQuote(q), 0),
    [dormant],
  );

  // 2. Unbilled hours — sum of focus time per project not yet attached to an invoice.
  const hasUnbilled = (unbilled?.totalHours ?? 0) > 0;
  const unbilledAmount = useMemo(() => {
    if (!unbilled) return 0;
    const rate = settings.defaultHourlyRate || 120;
    return Math.round(unbilled.totalHours * rate);
  }, [unbilled, settings.defaultHourlyRate]);

  // 3. Runway — read the same balance localStorage key as ForecastPanel uses.
  const runwayMonths = useMemo(() => {
    if (typeof window === "undefined") return Infinity;
    const raw = window.localStorage.getItem(BALANCE_STORAGE_KEY);
    const balance = raw ? Number.parseFloat(raw) : 0;
    if (!Number.isFinite(balance) || balance <= 0) return Infinity;

    // Approx monthly burn from quotes context isn't available without the
    // payment_plans hook, so we keep this card simple: only show it when
    // the unbilled hours plus balance can't cover an estimated 6-month
    // forecast. The forecast page has the full picture; this card just
    // points the user there when something looks tight.
    const monthlyBurn = 4000; // conservative default — Tresorerie has the real number
    return Math.floor(balance / monthlyBurn);
  }, []);

  const showRunwayWarning = Number.isFinite(runwayMonths) && runwayMonths < RUNWAY_WARN_MONTHS;

  const hasAny = dormant.length > 0 || hasUnbilled || showRunwayWarning;
  if (!hasAny) return null;

  return (
    <section className="space-y-2">
      <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
        Insights
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {dormant.length > 0 && (
          <InsightCard
            icon={FileWarning}
            tone="warn"
            title="Devis qui dorment"
            metric={`${dormant.length} en draft`}
            hint={`Inactifs depuis +30 j · ${formatCHF(dormantTotal)} en attente d'envoi.`}
            onClick={() => navigate("/quotes")}
          />
        )}
        {hasUnbilled && unbilled && (
          <InsightCard
            icon={Clock}
            tone="info"
            title="Heures non facturées"
            metric={`${unbilled.totalHours.toFixed(1)} h`}
            hint={`Sur ${unbilled.projectCount} projet${unbilled.projectCount > 1 ? "s" : ""} · ~${formatCHF(unbilledAmount)} à facturer.`}
            onClick={() => navigate("/quotes")}
          />
        )}
        {showRunwayWarning && (
          <InsightCard
            icon={TrendingDown}
            tone="danger"
            title="Trésorerie à surveiller"
            metric={`~${runwayMonths} mois`}
            hint="Runway estimé bas. Ouvre la trésorerie pour la projection détaillée."
            onClick={() => navigate("/tresorerie")}
          />
        )}
      </div>
    </section>
  );
}
