export type PaymentPlanType = "installment" | "recurring-adjusted" | "recurring" | "income";

export const PLAN_TYPE_LABELS: Record<PaymentPlanType, string> = {
  installment: "Échéances",
  "recurring-adjusted": "Ajustable",
  recurring: "Charge récurrente",
  income: "Revenu",
};

export const PLAN_TYPE_CLASSES: Record<PaymentPlanType, string> = {
  installment: "bg-primary/15 text-primary border-primary/30",
  "recurring-adjusted": "bg-amber-100 text-amber-700 border-amber-300",
  recurring: "bg-teal-100 text-teal-700 border-teal-300",
  income: "bg-emerald-100 text-emerald-700 border-emerald-300",
};

export interface PaymentPlan {
  id: string;
  name: string;
  type: PaymentPlanType;
  monthlyAmount: number;
  totalMonths: number;
  startDate: string; // YYYY-MM-DD
  totalOwed: number | null;
  adjustment: number | null;
  category: string | null;
  notes: string | null;
  paidMonths: number[]; // 0-based month indices
  createdAt: string;
}

/** Get the YYYY-MM of the month N months after startDate */
export function getMonthOffset(startDate: string, offset: number): string {
  const d = new Date(startDate + "T00:00:00");
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Get the end date YYYY-MM-DD of a plan */
export function getPlanEndDate(plan: Pick<PaymentPlan, "startDate" | "totalMonths">): string {
  const d = new Date(plan.startDate + "T00:00:00");
  d.setMonth(d.getMonth() + plan.totalMonths);
  return d.toISOString().slice(0, 10);
}

/** Get which 0-based month index a YYYY-MM corresponds to within a plan */
export function getMonthIndex(
  plan: Pick<PaymentPlan, "startDate">,
  yearMonth: string
): number {
  const start = new Date(plan.startDate + "T00:00:00");
  const startYM = start.getFullYear() * 12 + start.getMonth();
  const [y, m] = yearMonth.split("-").map(Number);
  const targetYM = y * 12 + (m - 1);
  return targetYM - startYM;
}

/** Check if a plan is active in a given month (YYYY-MM) */
export function isPlanActiveInMonth(
  plan: Pick<PaymentPlan, "startDate" | "totalMonths">,
  yearMonth: string
): boolean {
  const idx = getMonthIndex(plan, yearMonth);
  return idx >= 0 && idx < plan.totalMonths;
}

/** Is this plan type ongoing (no finite end)? */
export function isOngoingType(type: PaymentPlanType): boolean {
  return type === "recurring" || type === "income";
}

/** Get amount due in a specific month (includes adjustment in final month for recurring-adjusted) */
export function getAmountInMonth(plan: PaymentPlan, yearMonth: string): number {
  // Ongoing types always return their monthly amount
  if (isOngoingType(plan.type)) return plan.monthlyAmount;

  const idx = getMonthIndex(plan, yearMonth);
  if (idx < 0 || idx >= plan.totalMonths) return 0;
  let amount = plan.monthlyAmount;
  if (plan.type === "recurring-adjusted" && plan.adjustment && idx === plan.totalMonths - 1) {
    amount += plan.adjustment;
  }
  return Math.max(0, amount);
}

/** Remaining amount for a plan */
export function getRemainingAmount(plan: PaymentPlan): number {
  if (isOngoingType(plan.type)) return 0; // ongoing — no finite remaining
  const unpaid = plan.totalMonths - plan.paidMonths.length;
  const base = unpaid * plan.monthlyAmount;
  if (plan.type === "recurring-adjusted" && plan.adjustment) {
    return base + plan.adjustment;
  }
  return base;
}

/** Is the plan fully completed? */
export function isPlanCompleted(plan: PaymentPlan): boolean {
  if (isOngoingType(plan.type)) return false; // ongoing — never completed
  return plan.paidMonths.length >= plan.totalMonths;
}

/** Get current YYYY-MM */
export function currentYearMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Format YYYY-MM to readable label e.g. "Avr 2026" */
const MONTH_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];
export function formatYearMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return `${MONTH_SHORT[m - 1]} ${y}`;
}
