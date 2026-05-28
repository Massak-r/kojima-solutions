import { apiFetch } from "./client";
import type { Account, AccountCreate, AccountUpdate } from "@/types/account";

export function listAccounts(opts?: { includeArchived?: boolean; type?: "perso" | "entreprise" }) {
  const qs = new URLSearchParams();
  if (opts?.includeArchived) qs.set("includeArchived", "1");
  if (opts?.type) qs.set("type", opts.type);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Account[]>(`accounts.php${suffix}`);
}

export function createAccount(data: Partial<AccountCreate>) {
  return apiFetch<Account>("accounts.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateAccount(id: string, data: AccountUpdate) {
  return apiFetch<Account>(`accounts.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteAccount(id: string) {
  return apiFetch<void>(`accounts.php?id=${id}`, { method: "DELETE" });
}
