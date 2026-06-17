// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { parseCamt, reconcile } from "./camt";
import type { Quote } from "@/types/quote";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt><Stmt>
    <Ntry>
      <Amt Ccy="CHF">8648.00</Amt>
      <CdtDbtInd>CRDT</CdtDbtInd>
      <BookgDt><Dt>2026-06-18</Dt></BookgDt>
      <NtryDtls><TxDtls>
        <RltdPties><Dbtr><Nm>Atelier Lumen Sàrl</Nm></Dbtr></RltdPties>
        <RmtInf><Ustrd>FAC-2026-06-003 — Site vitrine</Ustrd></RmtInf>
      </TxDtls></NtryDtls>
    </Ntry>
    <Ntry>
      <Amt Ccy="CHF">120.00</Amt>
      <CdtDbtInd>DBIT</CdtDbtInd>
      <BookgDt><Dt>2026-06-17</Dt></BookgDt>
      <NtryDtls><TxDtls><RmtInf><Ustrd>Frais bancaires</Ustrd></RmtInf></TxDtls></NtryDtls>
    </Ntry>
    <Ntry>
      <Amt Ccy="CHF">5000.00</Amt>
      <CdtDbtInd>CRDT</CdtDbtInd>
      <BookgDt><Dt>2026-06-18</Dt></BookgDt>
      <NtryDtls><TxDtls><RmtInf><Ustrd>Versement sans reference</Ustrd></RmtInf></TxDtls></NtryDtls>
    </Ntry>
  </Stmt></BkToCstmrStmt>
</Document>`;

function inv(partial: Partial<Quote>): Quote {
  return {
    id: "i", createdAt: "2026-06-01", lang: "fr", clientName: "", clientEmail: "",
    quoteNumber: "", validityDate: "", projectTitle: "", projectDescription: "",
    conditions: "", lineItems: [], applyTva: false,
    docType: "invoice", invoiceStatus: "validated", isTemplate: false,
    ...partial,
  } as Quote;
}

describe("parseCamt", () => {
  it("extracts booked entries with amount, direction, date, remittance, party", () => {
    const entries = parseCamt(SAMPLE);
    expect(entries).toHaveLength(3);
    expect(entries[0]).toMatchObject({ amount: 8648, currency: "CHF", credit: true, date: "2026-06-18", counterparty: "Atelier Lumen Sàrl" });
    expect(entries[0].reference).toContain("FAC-2026-06-003");
    expect(entries[1].credit).toBe(false); // DBIT
  });

  it("throws on invalid XML", () => {
    expect(() => parseCamt("not xml <")).toThrow();
  });
});

describe("reconcile", () => {
  const invoices = [
    inv({ id: "a", quoteNumber: "FAC-2026-06-003", lineItems: [{ id: "1", description: "x", quantity: 1, unitPrice: 8000 }], applyTva: true }), // 8648
    inv({ id: "b", quoteNumber: "FAC-2026-06-004", lineItems: [{ id: "2", description: "y", quantity: 1, unitPrice: 5000 }] }), // 5000
    inv({ id: "c", quoteNumber: "FAC-2026-06-009", invoiceStatus: "paid", lineItems: [{ id: "3", description: "z", quantity: 1, unitPrice: 5000 }] }),
  ];

  it("matches by invoice number in the remittance, then by unique amount", () => {
    const matches = reconcile(parseCamt(SAMPLE), invoices);
    expect(matches).toHaveLength(2); // only the two credits
    expect(matches[0].invoice?.quoteNumber).toBe("FAC-2026-06-003");
    expect(matches[0].amountMatches).toBe(true);
    // 5000 credit has no ref → falls back to the single OPEN 5000 invoice (paid one excluded)
    expect(matches[1].invoice?.id).toBe("b");
    expect(matches[1].amountMatches).toBe(true);
  });

  it("leaves a credit unmatched when nothing fits", () => {
    const matches = reconcile(parseCamt(SAMPLE), [invoices[0]]);
    expect(matches[1].invoice).toBeNull(); // the 5000 credit
  });
});
