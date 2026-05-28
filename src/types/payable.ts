export type PayableStatus     = "pending" | "scheduled" | "paid" | "cancelled";
export type PayableDirection  = "out" | "in";
export type PayableRecurrence = "none" | "weekly" | "monthly" | "bimonthly" | "quarterly" | "biannual" | "yearly";

export const PAYABLE_STATUS_LABELS: Record<PayableStatus, string> = {
  pending:   "À régler",
  scheduled: "Programmé",
  paid:      "Réglé",
  cancelled: "Annulé",
};

export const PAYABLE_DIRECTION_LABELS: Record<PayableDirection, string> = {
  out: "Sortie",
  in:  "Entrée",
};

export const PAYABLE_RECURRENCE_LABELS: Record<PayableRecurrence, string> = {
  none:      "Aucune",
  weekly:    "Hebdomadaire",
  monthly:   "Mensuelle",
  bimonthly: "Tous les 2 mois",
  quarterly: "Trimestrielle",
  biannual:  "Semestrielle",
  yearly:    "Annuelle",
};

export interface Payable {
  id:                   string;
  label:                string;
  amount:               number;
  currency:             string;
  direction:            PayableDirection;
  dueDate?:             string | null;
  accountId?:           string | null;
  status:               PayableStatus;
  category?:            string | null;
  notes?:               string | null;
  recurrence:           PayableRecurrence;
  recurrenceDay?:       number | null;
  recurrenceEnd?:       string | null;
  adjustmentAmount?:    number | null;
  adjustmentDueDate?:   string | null;
  paidAt?:              string | null;
  sourceType?:          string | null;
  sourceId?:            string | null;
  createdAt:            string;
  updatedAt:            string;
}

export type PayableCreate = Omit<Payable, "id" | "createdAt" | "updatedAt" | "paidAt" | "sourceType" | "sourceId"> & {
  paidAt?: string | null;
};
export type PayableUpdate = Partial<Omit<Payable, "id" | "createdAt" | "updatedAt">>;
