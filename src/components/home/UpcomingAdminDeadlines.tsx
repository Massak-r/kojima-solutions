import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { listDeadlines } from "@/api/adminDeadlines";
import { SectionCard } from "@/components/ui/section-card";

/** Upcoming (≤30 days) or overdue admin/fiscal deadlines, on the home alerts
 *  zone. Collapses to null when there's nothing pending. Complements the
 *  cron's push notifications with a glanceable dashboard surface. */
export function UpcomingAdminDeadlines() {
  const { data } = useQuery({ queryKey: ["admin-deadlines"], queryFn: listDeadlines, staleTime: 60_000 });

  const items = useMemo(() => {
    const in30 = Date.now() + 30 * 86400000;
    return (data ?? [])
      .filter((d) => !d.completed && d.dueDate)
      .map((d) => ({ ...d, ts: new Date(d.dueDate + "T00:00:00").getTime() }))
      .filter((d) => d.ts <= in30)
      .sort((a, b) => a.ts - b.ts)
      .slice(0, 6);
  }, [data]);

  if (items.length === 0) return null;

  return (
    <SectionCard
      icon={CalendarClock}
      title="Échéances"
      iconClassName="text-indigo-500"
      bodyClassName="p-0"
    >
      <div className="divide-y divide-border/30">
        {items.map((d) => {
          const daysLeft = Math.ceil((d.ts - Date.now()) / 86400000);
          return (
            <div key={d.id} className="flex items-center justify-between px-5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-body font-medium text-foreground truncate">{d.title}</p>
                <p className="text-[10px] text-muted-foreground font-body">{d.category}</p>
              </div>
              <span className={cn(
                "text-xs font-mono font-semibold shrink-0 ml-2",
                daysLeft < 0 ? "text-red-600" : daysLeft <= 3 ? "text-red-600" : daysLeft <= 7 ? "text-amber-600" : "text-muted-foreground",
              )}>
                {daysLeft < 0 ? `+${Math.abs(daysLeft)}j` : daysLeft === 0 ? "Auj." : `${daysLeft}j`}
              </span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
