import { Link } from "react-router-dom";
import { CalendarCheck, PartyPopper, Coffee, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatChf } from "@/lib/currency";
import type { MonthProgress } from "@/lib/adminCompliance";

/**
 * The month, as a finite thing you can finish.
 *
 * The timeline below this card is honest but bottomless: it lists everything
 * owed from now until next spring, which reads as "you will never be done".
 * This reframes the *same* obligations as one closable month — a small number
 * of blocks, a visible finish line, and a real win when the last one lands.
 *
 * Deliberately not a points system: the bar only ever reflects obligations
 * actually settled, there is no streak to break, and an overdue item is shown
 * plainly rather than turned into a penalty. Motivation comes from seeing the
 * end, not from being scored.
 */

interface Props {
  progress: MonthProgress;
  /** Rendered as the "voir tout" target when more items exist than we show. */
  listHref?: string;
}

const PREVIEW = 3;

function dueChip(daysUntil: number | null): { text: string; cls: string } {
  const d = daysUntil ?? 0;
  if (d < 0) return { text: `+${Math.abs(d)} j`, cls: "bg-destructive/10 text-destructive" };
  if (d === 0) return { text: "aujourd'hui", cls: "bg-amber-100 text-amber-700" };
  if (d <= 3) return { text: `${d} j`, cls: "bg-amber-100 text-amber-700" };
  return { text: `${d} j`, cls: "bg-secondary text-muted-foreground" };
}

export function MonthQuest({ progress, listHref = "/tresorerie?tab=payables" }: Props) {
  const { monthLabel, done, remaining, total, remainingAmount, overdue, daysLeft, cleared } = progress;

  // Nothing at all this month — say so once, quietly, and take up no room.
  if (total === 0) {
    return (
      <div className="rounded-2xl border bg-secondary/20 px-5 py-4 flex items-center gap-3">
        <Coffee size={18} className="text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          Rien à régler en {monthLabel}. Le mois est vide.
        </p>
      </div>
    );
  }

  const left = remaining.length;
  const pct = Math.round((done / total) * 100);

  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6 transition-colors",
        cleared
          ? "bg-emerald-50/60 border-emerald-200"
          : "bg-gradient-to-br from-primary/5 to-transparent",
      )}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className={cn("text-eyebrow", cleared ? "text-emerald-700" : "text-primary")}>
          {monthLabel}
        </span>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">
          {daysLeft} jour{daysLeft > 1 ? "s" : ""} restant{daysLeft > 1 ? "s" : ""}
        </span>
      </div>

      {/* One block per obligation: the finish line you can literally count. */}
      <div className="flex items-center gap-[3px] mb-3.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const isDone = i < done;
          const isLate = !isDone && i - done < overdue;
          return (
            <span
              key={i}
              className={cn(
                "h-2.5 flex-1 min-w-[4px] rounded-full transition-colors",
                isDone ? (cleared ? "bg-emerald-500" : "bg-primary") : isLate ? "bg-destructive/35" : "bg-border",
              )}
            />
          );
        })}
      </div>

      {cleared ? (
        <div className="flex items-start gap-3">
          <PartyPopper size={22} className="text-emerald-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">
              {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)} est bouclé
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {done} chose{done > 1 ? "s" : ""} réglée{done > 1 ? "s" : ""}. Plus rien à sortir avant la fin du mois.
            </p>
          </div>
        </div>
      ) : (
        <>
          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight leading-snug">
            Il te reste <span className="tabular-nums">{left}</span> chose{left > 1 ? "s" : ""}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <CalendarCheck size={13} className="shrink-0" />
            <span className="tabular-nums">{done}</span> sur <span className="tabular-nums">{total}</span> déjà réglées ce mois
            <span className="text-muted-foreground/60">· {pct}%</span>
            {remainingAmount > 0 && (
              <span className="text-muted-foreground/60 tabular-nums">
                · {formatChf(remainingAmount)} CHF à sortir
              </span>
            )}
          </p>

          <ul className="mt-4 space-y-1.5">
            {remaining.slice(0, PREVIEW).map((o) => {
              const chip = dueChip(o.daysUntil);
              return (
                <li
                  key={`${o.kind}-${o.id}`}
                  className="flex items-center gap-2.5 rounded-lg border bg-card/60 px-3 py-2"
                >
                  <span className="text-sm truncate flex-1 min-w-0">{o.label}</span>
                  {o.amount != null && (
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {formatChf(o.amount)} CHF
                    </span>
                  )}
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", chip.cls)}>
                    {chip.text}
                  </span>
                </li>
              );
            })}
          </ul>

          {left > PREVIEW && (
            <Link
              to={listHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition mt-2.5"
            >
              <ArrowRight size={13} /> et {left - PREVIEW} autre{left - PREVIEW > 1 ? "s" : ""}
            </Link>
          )}
        </>
      )}
    </div>
  );
}
