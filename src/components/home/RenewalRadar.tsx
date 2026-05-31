import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { listRenewals, RENEWAL_RECURRENCE_LABELS } from "@/api/renewals";

function daysUntil(iso: string): number {
  const t = new Date(iso + "T00:00:00").getTime();
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((t - today) / 86_400_000);
}

/** AlertsZone card — renewals expiring within 60 days (or overdue). Returns null
 *  when nothing's due so the zone auto-collapses. Shares the ["renewals"] query
 *  cache with the Trésorerie tab, so edits there reflect here. */
export function RenewalRadar() {
  const navigate = useNavigate();
  const { data: renewals = [] } = useQuery({
    queryKey: ["renewals"],
    queryFn: () => listRenewals(),
    staleTime: 60_000,
  });

  const due = useMemo(
    () =>
      renewals
        .map((r) => ({ ...r, days: daysUntil(r.expiryDate) }))
        .filter((r) => r.days <= 60)
        .sort((a, b) => a.days - b.days)
        .slice(0, 6),
    [renewals],
  );

  if (due.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <CalendarClock size={14} className="text-amber-500" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Renouvellements
        </h2>
      </div>
      <div className="divide-y divide-border/30">
        {due.map((r) => (
          <div
            key={r.id}
            onClick={() => navigate("/tresorerie?tab=renewals")}
            className="flex items-center justify-between px-5 py-2.5 hover:bg-secondary/30 cursor-pointer transition-colors"
          >
            <div className="min-w-0">
              <p className="text-sm font-body font-medium text-foreground truncate">{r.label}</p>
              <p className="text-[10px] text-muted-foreground font-body">
                {r.category || RENEWAL_RECURRENCE_LABELS[r.recurrence]}
              </p>
            </div>
            <span
              className={cn(
                "text-xs font-mono font-semibold shrink-0 ml-2",
                r.days < 0 ? "text-red-600" : r.days <= 7 ? "text-amber-600" : "text-muted-foreground",
              )}
            >
              {r.days < 0 ? `−${Math.abs(r.days)}j` : r.days === 0 ? "Auj." : `${r.days}j`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
