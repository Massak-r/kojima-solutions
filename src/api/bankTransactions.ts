import { apiFetch } from "./client";
import type { BankPasteTxn } from "@/lib/bankPaste";

export interface StoredBankTxn {
  id: string;
  bookingDate: string;
  valueDate: string | null;
  amount: number;
  currency: string;
  description: string | null;
  counterparty: string | null;
  balanceAfter: number | null;
  pulledAt: string | null;   // set when Soroban pulled it
  createdAt: string;
}

/** Store a parsed batch (idempotent by sourceKey). */
export function importBankTransactions(transactions: BankPasteTxn[]) {
  return apiFetch<{ stored: number; skipped: number; total: number }>("bank_transactions.php", {
    method: "POST",
    body: JSON.stringify({ transactions }),
  });
}

export function listBankTransactions() {
  return apiFetch<StoredBankTxn[]>("bank_transactions.php");
}

export function deleteBankTransaction(id: string) {
  return apiFetch<void>(`bank_transactions.php?id=${id}`, { method: "DELETE" });
}
