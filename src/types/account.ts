export type AccountType = "perso" | "entreprise";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  perso:      "Personnel",
  entreprise: "Entreprise",
};

export interface Account {
  id:                string;
  name:              string;
  type:              AccountType;
  institution?:      string | null;
  currency:          string;
  balance:           number;
  balanceUpdatedAt?: string | null;
  sortOrder:         number;
  isArchived:        boolean;
  /** When true, this account's balance is auto-synced from the pasted bank statement. */
  bankFeed:          boolean;
  notes?:            string | null;
  createdAt:         string;
  updatedAt:         string;
}

export type AccountCreate = Omit<Account, "id" | "createdAt" | "updatedAt" | "balanceUpdatedAt">;
export type AccountUpdate = Partial<Omit<Account, "id" | "createdAt" | "updatedAt">>;
