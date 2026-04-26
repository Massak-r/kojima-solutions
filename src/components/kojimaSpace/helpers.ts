export function formatCHF(value: number): string {
  return new Intl.NumberFormat("fr-CH", {
    style: "currency", currency: "CHF",
    minimumFractionDigits: 0, maximumFractionDigits: 2,
  }).format(value).replace(/(?<=\d)[\s  ](?=\d)/g, "'");
}

export const PROJECT_STATUS = {
  draft:        { label: "Draft",    cls: "bg-muted text-muted-foreground border-border" },
  "in-progress":{ label: "Active",   cls: "bg-primary/15 text-primary border-primary/30" },
  completed:    { label: "Done",     cls: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
  "on-hold":    { label: "On Hold",  cls: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
} as const;

export const PAYMENT_STATUS = {
  unpaid:  { label: "Unpaid",  cls: "bg-destructive/10 text-destructive border-destructive/30" },
  partial: { label: "Partial", cls: "bg-palette-amber/15 text-palette-amber border-palette-amber/30" },
  paid:    { label: "Paid",    cls: "bg-palette-sage/15 text-palette-sage border-palette-sage/30" },
} as const;

// Active objectives untouched longer than this get a muted/stale treatment.
// Uses updated_at (refreshed on every field edit) so fresh edits reset the clock.
export const OBJECTIVE_STALE_DAYS = 30;

export function objectiveDaysSinceUpdate(o: { updatedAt?: string | null; createdAt: string }): number {
  const raw = o.updatedAt ?? o.createdAt;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.floor((Date.now() - t) / 86400000);
}
