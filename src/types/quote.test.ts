import { describe, it, expect } from "vitest";
import {
  subtotalQuote,
  discountAmountQuote,
  netSubtotalQuote,
  tvaAmountQuote,
  totalQuote,
  nextQuoteNumber,
  type Quote,
} from "./quote";

function q(partial: Partial<Quote>): Quote {
  return {
    id: "x",
    createdAt: "2026-01-01",
    lang: "fr",
    clientName: "",
    clientEmail: "",
    quoteNumber: "DEV-2026-001",
    validityDate: "2026-02-01",
    projectTitle: "",
    projectDescription: "",
    conditions: "",
    lineItems: [],
    applyTva: false,
    ...partial,
  };
}

const lines = [
  { id: "1", description: "A", quantity: 2, unitPrice: 100 }, // 200
  { id: "2", description: "B", quantity: 1, unitPrice: 50 }, // 50
];

describe("quote math", () => {
  it("sums line items", () => {
    expect(subtotalQuote(q({ lineItems: lines }))).toBe(250);
  });

  it("applies a fixed discount before TVA", () => {
    const quote = q({ lineItems: lines, discountEnabled: true, discountType: "amount", discountValue: 50 });
    expect(discountAmountQuote(quote)).toBe(50);
    expect(netSubtotalQuote(quote)).toBe(200);
  });

  it("applies a percent discount", () => {
    const quote = q({ lineItems: lines, discountEnabled: true, discountType: "percent", discountValue: 10 });
    expect(netSubtotalQuote(quote)).toBe(225);
  });

  it("never goes negative on an over-large discount", () => {
    const quote = q({ lineItems: lines, discountEnabled: true, discountType: "amount", discountValue: 999 });
    expect(netSubtotalQuote(quote)).toBe(0);
  });

  it("adds 8.1% TVA on the net subtotal", () => {
    const quote = q({ lineItems: lines, applyTva: true });
    expect(tvaAmountQuote(quote)).toBeCloseTo(20.25, 2);
    expect(totalQuote(quote)).toBeCloseTo(270.25, 2);
  });

  // Invariant the acompte→solde loop relies on: the two partial invoices must
  // sum back to the full net subtotal of the source devis (no money lost/double-billed).
  it("acompte 50% + solde 50% sums back to the net subtotal", () => {
    const base = netSubtotalQuote(q({ lineItems: lines })); // 250
    const acompte = Math.round(base * 0.5 * 100) / 100;
    const solde = Math.round(base * (1 - 0.5) * 100) / 100;
    expect(acompte + solde).toBe(base);
  });

  it("acompte 30% leaves a 70% balance that still sums to the whole", () => {
    const base = netSubtotalQuote(q({ lineItems: [{ id: "1", description: "A", quantity: 1, unitPrice: 333.33 }] }));
    const acompte = Math.round(base * 0.3 * 100) / 100;
    const solde = Math.round(base * 0.7 * 100) / 100;
    expect(acompte + solde).toBeCloseTo(base, 2);
  });
});

describe("nextQuoteNumber", () => {
  it("increments within the year and doc type", () => {
    const existing = [
      { quoteNumber: "DEV-2026-001", docType: "quote" as const },
      { quoteNumber: "DEV-2026-002", docType: "quote" as const },
      { quoteNumber: "FAC-2026-005", docType: "invoice" as const },
    ];
    expect(nextQuoteNumber(existing, "quote", 2026)).toBe("DEV-2026-003");
    expect(nextQuoteNumber(existing, "invoice", 2026)).toBe("FAC-2026-006");
  });

  it("starts at 001 for an empty list", () => {
    expect(nextQuoteNumber([], "quote", 2026)).toBe("DEV-2026-001");
  });
});
