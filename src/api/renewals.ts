import { apiFetch } from "./client";

export type RenewalRecurrence = "none" | "monthly" | "quarterly" | "biannual" | "yearly";

export const RENEWAL_RECURRENCE_LABELS: Record<RenewalRecurrence, string> = {
  none:      "Ponctuel",
  monthly:   "Mensuel",
  quarterly: "Trimestriel",
  biannual:  "Semestriel",
  yearly:    "Annuel",
};

/** Months added when "renewing" (advancing the expiry by one cycle). */
export const RENEWAL_RECURRENCE_MONTHS: Record<RenewalRecurrence, number> = {
  none: 0, monthly: 1, quarterly: 3, biannual: 6, yearly: 12,
};

export interface Renewal {
  id: string;
  label: string;
  category: string | null;
  expiryDate: string; // YYYY-MM-DD
  recurrence: RenewalRecurrence;
  amount: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type RenewalCreate = {
  label: string;
  category?: string | null;
  expiryDate: string;
  recurrence?: RenewalRecurrence;
  amount?: number | null;
  notes?: string | null;
};

export function listRenewals() {
  return apiFetch<Renewal[]>("renewals.php");
}

export function createRenewal(data: RenewalCreate) {
  return apiFetch<Renewal>("renewals.php", { method: "POST", body: JSON.stringify(data) });
}

export function updateRenewal(id: string, data: Partial<RenewalCreate>) {
  return apiFetch<Renewal>(`renewals.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function deleteRenewal(id: string) {
  return apiFetch<void>(`renewals.php?id=${id}`, { method: "DELETE" });
}

/** Advance an ISO date by the recurrence cycle (for the "Renouvelé" action). */
export function advanceExpiry(isoDate: string, recurrence: RenewalRecurrence): string {
  const months = RENEWAL_RECURRENCE_MONTHS[recurrence];
  const d = new Date(isoDate + "T00:00:00");
  if (months > 0) d.setMonth(d.getMonth() + months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
