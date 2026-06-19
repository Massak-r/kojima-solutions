import { describe, it, expect } from "vitest";
import { computeCashflowForecast, type ForecastInputs } from "./forecast";
import type { Payable } from "@/types/payable";
import type { RecurringCost } from "@/types/personalCost";

const NOW = new Date(2026, 5, 15); // 15 Jun 2026 (month index 5)

function payable(over: Partial<Payable>): Payable {
  return {
    id: "p", label: "x", amount: 100, currency: "CHF", direction: "out",
    status: "pending", commitment: "committed", recurrence: "none",
    createdAt: "", updatedAt: "", ...over,
  };
}

describe("computeCashflowForecast", () => {
  it("with no flows, every month ends at the opening balance", () => {
    const r = computeCashflowForecast({ openingBalance: 5000, now: NOW, horizonMonths: 3 });
    expect(r.months).toHaveLength(3);
    expect(r.months.map((m) => m.endBalance)).toEqual([5000, 5000, 5000]);
    expect(r.runwayMonths).toBeNull();
    expect(r.firstNegativeMonth).toBeNull();
  });

  it("buckets a one-off outflow into its due month and drops the balance", () => {
    const r = computeCashflowForecast({
      openingBalance: 1000, now: NOW, horizonMonths: 3,
      payables: [payable({ amount: 300, dueDate: "2026-07-10" })], // month index 1
    });
    expect(r.months[0].outflow).toBe(0);
    expect(r.months[1].outflow).toBe(300);
    expect(r.months.map((m) => m.endBalance)).toEqual([1000, 700, 700]);
  });

  it("projects a monthly recurring payable across every month", () => {
    const r = computeCashflowForecast({
      openingBalance: 0, now: NOW, horizonMonths: 4,
      payables: [payable({ amount: 200, dueDate: "2026-06-01", recurrence: "monthly" })],
    });
    expect(r.months.map((m) => m.outflow)).toEqual([200, 200, 200, 200]);
    expect(r.months[3].endBalance).toBe(-800);
    expect(r.firstNegativeMonth).toBe("2026-06");
  });

  it("stops a recurrence at recurrenceEnd", () => {
    const r = computeCashflowForecast({
      openingBalance: 0, now: NOW, horizonMonths: 4,
      payables: [payable({ amount: 100, dueDate: "2026-06-01", recurrence: "monthly", recurrenceEnd: "2026-07-15" })],
    });
    expect(r.months.map((m) => m.outflow)).toEqual([100, 100, 0, 0]);
  });

  it("counts an 'in' payable and receivables as inflow; overdue folds into month 0", () => {
    const r = computeCashflowForecast({
      openingBalance: 0, now: NOW, horizonMonths: 2,
      payables: [payable({ direction: "in", amount: 500, dueDate: "2026-06-20" })],
      receivables: [
        { amount: 250, expectedDate: "2026-04-01" }, // overdue → month 0
        { amount: 400, expectedDate: "2026-07-05" }, // month 1
      ],
    });
    expect(r.months[0].inflow).toBe(750); // 500 + 250
    expect(r.months[1].inflow).toBe(400);
  });

  it("normalizes recurring costs to a monthly amount (yearly 1200 → 100/mo)", () => {
    const cost: RecurringCost = { id: "c", name: "Assurance", amount: 1200, frequency: "yearly", createdAt: "" };
    const r = computeCashflowForecast({ openingBalance: 0, now: NOW, horizonMonths: 2, recurringCosts: [cost] });
    expect(r.months.map((m) => m.outflow)).toEqual([100, 100]);
  });

  it("computes runway from the average monthly burn", () => {
    const r = computeCashflowForecast({
      openingBalance: 1000, now: NOW, horizonMonths: 5,
      payables: [payable({ amount: 200, dueDate: "2026-06-01", recurrence: "monthly" })],
    });
    expect(r.avgNet).toBe(-200);
    expect(r.runwayMonths).toBe(5); // floor(1000 / 200)
    // 1000 − 200×5 lands on exactly 0 at month 4 — never strictly below.
    expect(r.firstNegativeMonth).toBeNull();
  });

  it("ignores paid and cancelled payables", () => {
    const r = computeCashflowForecast({
      openingBalance: 0, now: NOW, horizonMonths: 2,
      payables: [
        payable({ amount: 100, dueDate: "2026-06-10", status: "paid" }),
        payable({ amount: 100, dueDate: "2026-06-10", status: "cancelled" }),
      ],
    });
    expect(r.months[0].outflow).toBe(0);
  });
});
