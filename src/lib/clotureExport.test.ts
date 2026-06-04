import { describe, it, expect } from "vitest";
import { computeClotureSummary, buildClotureRows } from "./clotureExport";
import type { Quote } from "@/types/quote";
import type { Expense } from "@/types/expense";

function inv(p: Partial<Quote>): Quote {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: "2026-02-01",
    lang: "fr",
    clientName: "",
    clientEmail: "",
    quoteNumber: "",
    validityDate: "",
    projectTitle: "",
    projectDescription: "",
    conditions: "",
    lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 1000 }],
    applyTva: false,
    docType: "invoice",
    invoiceStatus: "paid",
    ...p,
  };
}
function exp(p: Partial<Expense>): Expense {
  return { id: Math.random().toString(36).slice(2), date: "2026-02-10", amount: 100, description: "x", category: "software", createdAt: "2026-02-10", ...p };
}

describe("computeClotureSummary", () => {
  it("sums paid revenue, TVA, HT, expenses and profit for the year only", () => {
    const quotes = [
      inv({ createdAt: "2026-02-01", applyTva: true }), // TTC 1081, TVA 81
      inv({ createdAt: "2025-12-01" }), // prior year → excluded
      inv({ invoiceStatus: "validated" }), // not paid → excluded
    ];
    const expenses = [exp({ date: "2026-03-01", amount: 200 }), exp({ date: "2025-01-01", amount: 999 })];
    const s = computeClotureSummary(2026, quotes, expenses);
    expect(s.revenueTTC).toBeCloseTo(1081, 1);
    expect(s.tvaCollected).toBeCloseTo(81, 1);
    expect(s.revenueHT).toBeCloseTo(1000, 1);
    expect(s.expenses).toBe(200);
    expect(s.profitHT).toBeCloseTo(800, 1);
  });

  it("buckets revenue into quarters by month", () => {
    const s = computeClotureSummary(2026, [inv({ createdAt: "2026-02-15" }), inv({ createdAt: "2026-08-01" })], []);
    expect(s.quarters[0]).toBe(1000); // Q1
    expect(s.quarters[2]).toBe(1000); // Q3
    expect(s.quarters[1]).toBe(0);
  });
});

describe("buildClotureRows", () => {
  it("emits a summary block plus revenue and expense detail rows", () => {
    const rows = buildClotureRows(
      2026,
      [inv({ createdAt: "2026-04-01", quoteNumber: "FAC-2026-001", clientName: "Acme" })],
      [exp({ date: "2026-05-01", amount: 50, receiptUrl: "https://x/r.jpg" })],
    );
    expect(rows.some((r) => r.section === "RÉSUMÉ" && r.libelle === "CA encaissé (TTC)")).toBe(true);
    expect(rows.some((r) => r.section === "REVENU" && r.ref === "FAC-2026-001")).toBe(true);
    const expRow = rows.find((r) => r.section === "DÉPENSE");
    expect(expRow?.recu).toBe("https://x/r.jpg");
  });
});
