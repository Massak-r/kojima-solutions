import { describe, it, expect } from "vitest";
import { computeCockpitMetrics } from "./cockpitMetrics";
import type { Quote } from "@/types/quote";

function inv(partial: Partial<Quote>): Quote {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: "2026-06-01",
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
    ...partial,
  };
}

const now = new Date("2026-06-15");

describe("computeCockpitMetrics", () => {
  it("splits paid CA, receivables (invoices), à-facturer (devis) and pipeline", () => {
    const quotes: Quote[] = [
      inv({ invoiceStatus: "paid", createdAt: "2026-03-01", clientName: "Acme" }),
      inv({ invoiceStatus: "paid", createdAt: "2025-12-01", clientName: "Acme" }), // prior year → excluded from YTD
      inv({ invoiceStatus: "validated", lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 500 }] }), // billed invoice → receivable
      inv({ docType: "quote", invoiceStatus: "validated", lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 700 }] }), // accepted devis → à facturer
      inv({ invoiceStatus: "to-validate", lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 300 }] }),
      inv({ isTemplate: true, invoiceStatus: "validated", lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 9999 }] }), // template → ignored
    ];
    const m = computeCockpitMetrics(quotes, now);
    expect(m.caYtd).toBe(1000);
    expect(m.receivables).toBe(500);
    expect(m.toBill).toBe(700);
    expect(m.pipeline).toBe(300);
  });

  it("counts only overdue validated invoices", () => {
    const quotes = [
      inv({ invoiceStatus: "validated", validityDate: "2026-05-01" }), // past → overdue
      inv({ invoiceStatus: "validated", validityDate: "2026-12-01" }), // future
      inv({ invoiceStatus: "paid", validityDate: "2020-01-01" }), // paid → not overdue
    ];
    expect(computeCockpitMetrics(quotes, now).overdueCount).toBe(1);
  });

  it("ranks top clients by paid CA", () => {
    const quotes = [
      inv({ invoiceStatus: "paid", clientName: "Big", lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 5000 }] }),
      inv({ invoiceStatus: "paid", clientName: "Small", lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 1000 }] }),
      inv({ invoiceStatus: "paid", clientName: "Big", lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 2000 }] }),
    ];
    const top = computeCockpitMetrics(quotes, now).topClients;
    expect(top[0]).toEqual({ client: "Big", ca: 7000 });
    expect(top[1]).toEqual({ client: "Small", ca: 1000 });
  });

  it("produces a 12-month series with the current month last", () => {
    const m = computeCockpitMetrics([inv({ invoiceStatus: "paid", createdAt: "2026-06-10" })], now);
    expect(m.monthly).toHaveLength(12);
    expect(m.monthly[11].ca).toBe(1000);
    expect(m.monthly[0].ca).toBe(0);
  });

  it("computes conversion and average invoice", () => {
    const quotes = [
      inv({ docType: "quote", invoiceStatus: "draft" }),
      inv({ docType: "quote", invoiceStatus: "draft" }),
      inv({ invoiceStatus: "paid", lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 2000 }] }),
    ];
    const m = computeCockpitMetrics(quotes, now);
    expect(m.quoteCount).toBe(2);
    expect(m.invoiceCount).toBe(1);
    expect(m.conversionPct).toBe(50);
    expect(m.avgInvoice).toBe(2000);
  });
});
