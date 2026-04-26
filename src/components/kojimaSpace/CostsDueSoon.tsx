import { useState, useEffect, useMemo } from "react";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { listCosts, type PersonalCostItem } from "@/api/personalCosts";
import { FREQUENCY_DAYS } from "@/types/personalCost";

export function CostsDueSoon() {
  const [personalCosts, setPersonalCosts] = useState<PersonalCostItem[]>([]);

  useEffect(() => {
    listCosts().then(setPersonalCosts).catch(() => {});
  }, []);

  const costsDueSoon = useMemo(() => {
    const now = Date.now();
    return personalCosts
      .map(cost => {
        const freqDays = FREQUENCY_DAYS[cost.frequency] ?? 30;
        const lastPaid = cost.lastPaid ? new Date(cost.lastPaid).getTime() : new Date(cost.createdAt).getTime();
        const nextDue = lastPaid + freqDays * 86400000;
        const daysUntil = Math.ceil((nextDue - now) / 86400000);
        return { ...cost, daysUntil };
      })
      .filter(c => c.daysUntil <= 7)
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);
  }, [personalCosts]);

  if (costsDueSoon.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-border">
        <Wallet size={14} className="text-red-500" />
        <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Paiements à venir
        </h2>
      </div>
      <div className="divide-y divide-border/30">
        {costsDueSoon.map(cost => (
          <div key={cost.id} className="flex items-center justify-between px-5 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-body font-medium text-foreground truncate">{cost.name}</p>
              <p className="text-[10px] text-muted-foreground font-body font-mono">
                CHF {cost.amount.toLocaleString("fr-CH")}
              </p>
            </div>
            <span className={cn(
              "text-xs font-mono font-semibold shrink-0 ml-2",
              cost.daysUntil <= 0 ? "text-red-600" : cost.daysUntil <= 3 ? "text-amber-600" : "text-muted-foreground",
            )}>
              {cost.daysUntil <= 0 ? "Dû" : `${cost.daysUntil}j`}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
