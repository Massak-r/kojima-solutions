import { describe, it, expect } from "vitest";
import {
  computeRelances,
  billedPctFor,
  type RelanceClientLike,
  type RelanceProjectLike,
} from "./relances";
import type { Quote } from "@/types/quote";

const now = new Date("2026-06-15");

function q(partial: Partial<Quote>): Quote {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: "2026-06-14", // 1 day old by default → not aging
    lang: "fr",
    clientName: "",
    clientEmail: "",
    clientCompany: "",
    quoteNumber: "DEV-2026-001",
    validityDate: "",
    projectTitle: "",
    projectDescription: "",
    conditions: "",
    lineItems: [{ id: "l", description: "", quantity: 1, unitPrice: 1000 }],
    applyTva: false,
    docType: "quote",
    invoiceStatus: "draft",
    ...partial,
  };
}

const run = (
  quotes: Quote[],
  clients: RelanceClientLike[] = [],
  projects: RelanceProjectLike[] = [],
) => computeRelances(quotes, clients, projects, now);

describe("billedPctFor", () => {
  it("sums billedPct across linked invoices, self-healing on delete", () => {
    const quotes = [
      q({ id: "D1", invoiceStatus: "validated" }),
      q({ docType: "invoice", sourceQuoteId: "D1", billedPct: 50 }),
      q({ docType: "invoice", sourceQuoteId: "D1", billedPct: 30 }),
      q({ docType: "invoice", sourceQuoteId: "OTHER", billedPct: 99 }),
    ];
    expect(billedPctFor("D1", quotes)).toBe(80);
  });
});

describe("computeRelances — expired/unanswered devis", () => {
  it("flags an expired sent devis as danger", () => {
    const r = run([
      q({ invoiceStatus: "to-validate", createdAt: "2026-05-01", validityDate: "2026-06-01" }),
    ]);
    expect(r.expiredDevis).toHaveLength(1);
    expect(r.expiredDevis[0].tone).toBe("danger");
    expect(r.expiredDevis[0].days).toBe(14); // 06-15 − 06-01
    expect(r.expiredDevis[0].reason).toContain("Expiré");
  });

  it("flags an unanswered (≥7d) but not-yet-expired sent devis as warn", () => {
    const r = run([q({ invoiceStatus: "to-validate", createdAt: "2026-06-01" })]);
    expect(r.expiredDevis).toHaveLength(1);
    expect(r.expiredDevis[0].tone).toBe("warn");
    expect(r.expiredDevis[0].days).toBe(14);
  });

  it("ignores fresh sent devis, drafts, and already-validated devis", () => {
    const r = run([
      q({ invoiceStatus: "to-validate", createdAt: "2026-06-14" }), // 1d → fresh
      q({ invoiceStatus: "draft", createdAt: "2026-01-01" }), // not sent
      q({ invoiceStatus: "validated", createdAt: "2026-01-01" }), // accepted, not pending
    ]);
    expect(r.expiredDevis).toHaveLength(0);
  });
});

describe("computeRelances — à facturer", () => {
  it("lists a validated devis with no invoice at full amount", () => {
    const r = run([q({ id: "D", invoiceStatus: "validated", createdAt: "2026-06-01" })]);
    expect(r.toInvoice).toHaveLength(1);
    expect(r.toInvoice[0].amount).toBe(1000);
    expect(r.toInvoice[0].reason).toContain("pas de facture");
  });

  it("shows only the remaining portion when an acompte was already billed", () => {
    const r = run([
      q({ id: "D", invoiceStatus: "validated" }),
      q({ docType: "invoice", sourceQuoteId: "D", billedPct: 50, invoiceStatus: "draft" }),
    ]);
    expect(r.toInvoice).toHaveLength(1);
    expect(r.toInvoice[0].amount).toBe(500); // 1000 × 50%
    expect(r.toInvoice[0].reason).toContain("reste 50%");
  });

  it("excludes a fully-billed devis and templates", () => {
    const r = run([
      q({ id: "D", invoiceStatus: "validated" }),
      q({ docType: "invoice", sourceQuoteId: "D", billedPct: 100 }),
      q({ id: "T", invoiceStatus: "validated", isTemplate: true }),
    ]);
    expect(r.toInvoice).toHaveLength(0);
  });
});

describe("computeRelances — overdue invoices", () => {
  it("flags validated invoices past their échéance, sorted by most overdue", () => {
    const r = run([
      q({ docType: "invoice", invoiceStatus: "validated", validityDate: "2026-06-10" }), // 5j
      q({ docType: "invoice", invoiceStatus: "validated", validityDate: "2026-05-01" }), // 45j
      q({ docType: "invoice", invoiceStatus: "validated", validityDate: "2026-12-01" }), // future
      q({ docType: "invoice", invoiceStatus: "paid", validityDate: "2020-01-01" }), // paid
      q({ docType: "invoice", invoiceStatus: "validated", validityDate: "" }), // no date
    ]);
    expect(r.overdueInvoices).toHaveLength(2);
    expect(r.overdueInvoices[0].days).toBe(45); // most overdue first
    expect(r.overdueInvoices[1].days).toBe(5);
    expect(r.overdueInvoices[0].tone).toBe("danger");
  });
});

describe("computeRelances — cold clients", () => {
  const acme: RelanceClientLike = { id: "c1", name: "Acme", email: "acme@x.com" };

  it("flags an engaged-then-silent client with no active thread", () => {
    const r = run(
      [q({ clientEmail: "acme@x.com", invoiceStatus: "paid", createdAt: "2026-03-01" })],
      [acme],
    );
    expect(r.coldClients).toHaveLength(1);
    expect(r.coldClients[0].id).toBe("c1");
    expect(r.coldClients[0].days).toBeGreaterThanOrEqual(60);
  });

  it("ignores recently-active clients and never-engaged contacts", () => {
    const r = run(
      [q({ clientEmail: "acme@x.com", invoiceStatus: "paid", createdAt: "2026-06-01" })],
      [acme, { id: "c2", name: "Ghost", email: "ghost@x.com" }],
    );
    expect(r.coldClients).toHaveLength(0);
  });

  it("does not mark a client cold while a project is in progress", () => {
    const r = run(
      [q({ clientEmail: "acme@x.com", invoiceStatus: "paid", createdAt: "2026-01-01" })],
      [acme],
      [{ clientId: "c1", status: "in-progress", createdAt: "2026-01-01" }],
    );
    expect(r.coldClients).toHaveLength(0);
  });

  it("does not double-list a client already being chased for money", () => {
    const r = run(
      [
        q({ clientName: "Acme", clientEmail: "acme@x.com", invoiceStatus: "validated", createdAt: "2026-01-01" }), // → toInvoice
        q({ clientEmail: "acme@x.com", invoiceStatus: "paid", createdAt: "2026-01-01" }),
      ],
      [acme],
    );
    expect(r.toInvoice).toHaveLength(1);
    expect(r.coldClients).toHaveLength(0);
  });
});

describe("computeRelances — roll-up", () => {
  it("sums money at stake (to-invoice remaining + overdue) and total count", () => {
    const r = run([
      q({ id: "D", invoiceStatus: "validated", createdAt: "2026-06-01" }), // toInvoice 1000
      q({ docType: "invoice", invoiceStatus: "validated", validityDate: "2026-05-01" }), // overdue 1000
      q({ invoiceStatus: "to-validate", createdAt: "2026-05-01" }), // expired devis (pipeline, not at-stake)
    ]);
    expect(r.atStake).toBe(2000);
    expect(r.count).toBe(3);
  });

  it("returns empty buckets when everything is up to date", () => {
    const r = run([
      q({ invoiceStatus: "paid", docType: "invoice" }),
      q({ invoiceStatus: "draft" }),
    ]);
    expect(r.count).toBe(0);
    expect(r.atStake).toBe(0);
  });
});
