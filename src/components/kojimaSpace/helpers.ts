export function formatCHF(value: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF",
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
}

// PROJECT_STATUS / PAYMENT_STATUS now live in @/lib/statusColors. Re-exported
// here so LatestProjects.tsx (the only consumer) doesn't need an import-path
// change. New code should import from @/lib/statusColors directly.
export { PROJECT_STATUS, PAYMENT_STATUS } from "@/lib/statusColors";

// Active objectives untouched longer than this get a muted/stale treatment.
// Uses updated_at (refreshed on every field edit) so fresh edits reset the clock.
export const OBJECTIVE_STALE_DAYS = 30;

export function objectiveDaysSinceUpdate(o: { updatedAt?: string | null; createdAt: string }): number {
  const raw = o.updatedAt ?? o.createdAt;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}
