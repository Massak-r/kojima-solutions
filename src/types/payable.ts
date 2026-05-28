export type PayableStatus = "pending" | "scheduled" | "paid" | "cancelled";
export type PayableRecurrence = "none" | "weekly" | "monthly" | "quarterly" | "yearly";

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  pending:   "À payer",
  scheduled: "Programmé",
  paid:      "Payé",
  cancelled: "Annulé",
};

export const PAYABLE_RECURRENCE_LABELS: Record<PayableRecurrence, string> = {
  none:      "Aucune",
  weekly:    "Hebdomadaire",
  monthly:   "Mensuelle",
  quarterly: "Trimestrielle",
  yearly:    "Annuelle",
};

export interface Payable {
  id:              string;
  label:           string;
  amount:          number;
  currency:        string;
  dueDate?:        string | null;
  accountId?:      string | null;
  status:          PayableStatus;
  category?:       string | null;
  notes?:          string | null;
  recurrence:      PayableRecurrence;
  recurrenceDay?:  number | null;
  recurrenceEnd?:  string | null;
  paidAt?:         string | null;
  sourceType?:     string | null;
  sourceId?:       string | null;
  createdAt:       string;
  updatedAt:       string;
}

export type PayableCreate = Omit<Payable, "id" | "createdAt" | "updatedAt" | "paidAt" | "sourceType" | "sourceId"> & {
  paidAt?: string | null;
};
export type PayableUpdate = Partial<Omit<Payable, "id" | "createdAt" | "updatedAt">>;
