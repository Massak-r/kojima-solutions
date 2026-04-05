import { apiFetch } from "./client";
import type { PaymentPlanType } from "@/types/paymentPlan";

export interface PaymentPlanItem {
  id: string;
  name: string;
  type: PaymentPlanType;
  monthlyAmount: number;
  totalMonths: number;
  startDate: string;
  totalOwed: number | null;
  adjustment: number | null;
  category: string | null;
  notes: string | null;
  paidMonths: number[];
  createdAt: string;
}

export function listPaymentPlans() {
  return apiFetch<PaymentPlanItem[]>("payment_plans.php");
}

export function createPaymentPlan(
  data: Omit<PaymentPlanItem, "id" | "createdAt">
) {
  return apiFetch<PaymentPlanItem>("payment_plans.php", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePaymentPlan(
  id: string,
  data: Partial<Omit<PaymentPlanItem, "id" | "createdAt">>
) {
  return apiFetch<PaymentPlanItem>(`payment_plans.php?id=${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deletePaymentPlan(id: string) {
  return apiFetch<void>(`payment_plans.php?id=${id}`, { method: "DELETE" });
}
