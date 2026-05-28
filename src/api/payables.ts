import { apiFetch } from "./client";
import type { Payable, PayableCreate, PayableStatus, PayableUpdate } from "@/types/payable";

export function listPayables(opts?: { status?: PayableStatus; accountId?: string }) {
  const qs = new URLSearchParams();
  if (opts?.status) qs.set("status", opts.status);
  if (opts?.accountId) qs.set("accountId", opts.accountId);
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return apiFetch<Payable[]>(`payables.php${suffix}`);
}

export function createPayable(data: Partial<PayableCreate>) {
  return apiFetch<Payable>("payables.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePayable(id: string, data: PayableUpdate) {
  return apiFetch<Payable & { spawned?: Payable }>(`payables.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePayable(id: string) {
  return apiFetch<void>(`payables.php?id=${id}`, { method: "DELETE" });
}
