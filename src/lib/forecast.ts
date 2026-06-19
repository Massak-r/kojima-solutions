import type { Payable } from "@/types/payable";
import type { RecurringCost } from "@/types/personalCost";
import { FREQUENCY_MONTHLY_FACTOR } from "@/types/personalCost";

/**
 * Pure cashflow-forecast engine — the spine of the "trésorerie prévisionnelle".
 *
 * Takes an opening balance plus the canonical money sources (payables with
 * in/out direction + recurrence, recurring costs, expected receivables) and
 * projects a month-by-month running balance with a runway figure. Pure and
 * `now`-injected so it's deterministic and unit-testable.
 *
 * NB on double-counting: recurring costs can also be modelled as
 * `Payable{direction:'out', recurrence}`. The engine sums BOTH inputs as given
 * — the caller must pass each cost through exactly one channel.
 */

export interface ForecastReceivable {
  amount: number;
  /** YYYY-MM-DD the payment is expected. Past dates fold into the first month. */
  expectedDate: string;
}

export interface ForecastInputs {
  openingBalance: number;
  payables?: Payable[];
  recurringCosts?: RecurringCost[];
  receivables?: ForecastReceivable[];
  /** Number of months to project, including the current one. Default 6. */
  horizonMonths?: number;
  /** Injected for determinism/testability. */
  now: Date;
}

export interface ForecastMonth {
  month: string;       // YYYY-MM
  label: string;       // localized "juil. 26"
  inflow: number;
  outflow: number;
  net: number;
  endBalance: number;
}

export interface ForecastResult {
  openingBalance: number;
  months: ForecastMonth[];
  avgNet: number;
  /** Whole months the opening balance lasts at the average burn, or null when
   *  cashflow is non-negative (no runway concern). */
  runwayMonths: number | null;
  /** First month the projected end balance goes negative, or null. */
  firstNegativeMonth: string | null;
}

/** Months to advance per recurrence step (weekly is handled separately by days). */
const STEP_MONTHS: Record<string, number> = {
  monthly: 1, bimonthly: 2, quarterly: 3, biannual: 6, yearly: 12,
};

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}
function parseDate(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s.slice(0, 10) + "T00:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeCashflowForecast(input: ForecastInputs): ForecastResult {
  const horizon = Math.max(1, input.horizonMonths ?? 6);
  const firstMonth = startOfMonth(input.now);
  const horizonEnd = addMonths(firstMonth, horizon); // exclusive upper bound

  const idx: Record<string, number> = {};
  const keys: string[] = [];
  for (let i = 0; i < horizon; i++) {
    const k = monthKey(addMonths(firstMonth, i));
    keys.push(k);
    idx[k] = i;
  }

  const inflow = new Array(horizon).fill(0);
  const outflow = new Array(horizon).fill(0);
  const bucket = (arr: number[], d: Date, amt: number) => {
    const k = monthKey(d);
    if (k in idx) arr[idx[k]] += amt;
  };

  // Payables (in/out), projecting recurrence forward across the horizon.
  for (const p of input.payables ?? []) {
    if (p.status === "paid" || p.status === "cancelled") continue;
    const target = p.direction === "in" ? inflow : outflow;
    const base = parseDate(p.dueDate) ?? firstMonth;
    if (!p.recurrence || p.recurrence === "none") {
      bucket(target, base, p.amount);
      continue;
    }
    const end = parseDate(p.recurrenceEnd);
    let cur = new Date(base);
    let guard = 0;
    while (cur < horizonEnd && guard++ < 1000) {
      if (end && cur > end) break;
      if (cur >= firstMonth) bucket(target, cur, p.amount);
      cur = p.recurrence === "weekly"
        ? new Date(cur.getTime() + 7 * 86_400_000)
        : addMonths(cur, STEP_MONTHS[p.recurrence] ?? 1);
    }
  }

  // Recurring costs (always outflow), normalized to a per-month amount.
  for (const c of input.recurringCosts ?? []) {
    const monthly = c.amount * (FREQUENCY_MONTHLY_FACTOR[c.frequency] ?? 1);
    for (let i = 0; i < horizon; i++) outflow[i] += monthly;
  }

  // Expected receivables; anything overdue folds into the first month.
  for (const r of input.receivables ?? []) {
    const d = parseDate(r.expectedDate);
    if (!d) continue;
    bucket(inflow, d < firstMonth ? firstMonth : d, r.amount);
  }

  const months: ForecastMonth[] = [];
  let balance = input.openingBalance;
  let netSum = 0;
  let firstNegativeMonth: string | null = null;
  for (let i = 0; i < horizon; i++) {
    const inf = round2(inflow[i]);
    const outf = round2(outflow[i]);
    const net = round2(inf - outf);
    balance = round2(balance + net);
    netSum += net;
    if (firstNegativeMonth === null && balance < 0) firstNegativeMonth = keys[i];
    months.push({
      month: keys[i],
      label: addMonths(firstMonth, i).toLocaleDateString("fr-CH", { month: "short", year: "2-digit" }),
      inflow: inf,
      outflow: outf,
      net,
      endBalance: balance,
    });
  }

  const avgNet = round2(netSum / horizon);
  const runwayMonths = avgNet < 0
    ? Math.max(0, Math.floor(input.openingBalance / Math.abs(avgNet)))
    : null;

  return {
    openingBalance: round2(input.openingBalance),
    months,
    avgNet,
    runwayMonths,
    firstNegativeMonth,
  };
}
