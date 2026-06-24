import { describe, it, expect } from "vitest";
import { parseBankPaste, parseMoneyCell } from "./bankPaste";

// The real PostFinance paste the user provided: U+2212 (−) for the debit sign,
// doubled amount/balance cells, an optional leading payee column, "Détails"
// noise rows, a stray "D" at the end. − = the formatted minus sign.
const M = "−";
const PASTE = [
  `Type\tDate\tInformations complémentaires\tTexte de notification\tCrédit en CHF\tDébit en CHF\tValeur\tInformations complémentaires\tSolde en CHF\tActions`,
  `\t24.06.2026\tAchat/shopping en ligne du 23.06.2026, Google One\t\t\t2.00${M}-2\t22.06.2026\t\t19'694.87+19694.87\t`,
  `Détails`,
  `Coop-1998 GE Eaux-Vives 1207 Genève\t18.06.2026\tAchat/service du 18.06.2026, Coop-1998 GE Eaux-Vives\t\t\t83.65${M}-83.65\t18.06.2026\t\t19'696.87+19696.87\t`,
  `Détails`,
  `Die Schweizerische Post AG\t18.06.2026\tPF Pay Achat/shopping en ligne du 18.06.2026, Die Schweizerische Post AG\t\t\t1.00${M}-1\t18.06.2026\t\t19'780.52+19780.52\t`,
  `Détails`,
  `\t17.06.2026\tAchat/shopping en ligne du 17.06.2026, ANTHROPIC* CLAUDE SUB\t\t\t73.48${M}-73.48\t17.06.2026\t\t19'781.52+19781.52\t`,
  `Détails`,
  `\t12.06.2026\tPrix pour la gestion du compte\t\t\t145.00${M}-145\t12.06.2026\t\t19'855.00+19855\t`,
  `D`,
].join("\n");

describe("parseMoneyCell", () => {
  it("reads the doubled formatted+raw cells, sign from the formatted part", () => {
    expect(parseMoneyCell(`2.00${M}-2`)).toBe(-2);
    expect(parseMoneyCell(`83.65${M}-83.65`)).toBe(-83.65);
    expect(parseMoneyCell(`145.00${M}-145`)).toBe(-145);
    expect(parseMoneyCell("19'694.87+19694.87")).toBe(19694.87);
    expect(parseMoneyCell("1'250.00+1250")).toBe(1250);
  });
  it("falls back on plain cells", () => {
    expect(parseMoneyCell("-83.65")).toBe(-83.65);
    expect(parseMoneyCell("83.65")).toBe(83.65);
  });
  it("returns null on non-money", () => {
    expect(parseMoneyCell("Détails")).toBeNull();
  });
});

describe("parseBankPaste", () => {
  const r = parseBankPaste(PASTE);

  it("extracts exactly the 5 transactions (drops header / Détails / D)", () => {
    expect(r.transactions).toHaveLength(5);
  });

  it("parses dates, signed amounts and counterparties", () => {
    const t = r.transactions;
    expect(t[0]).toMatchObject({ bookingDate: "2026-06-24", valueDate: "2026-06-22", amount: -2 });
    expect(t[0].counterparty).toBe("Google One");
    expect(t[1]).toMatchObject({ bookingDate: "2026-06-18", amount: -83.65 });
    expect(t[1].counterparty).toContain("Coop");
    expect(t[2].counterparty).toBe("Die Schweizerische Post AG");
    expect(t[3].counterparty).toBe("ANTHROPIC* CLAUDE SUB");
    expect(t[3].amount).toBe(-73.48);
    expect(t[4].amount).toBe(-145);
    expect(t[4].description).toBe("Prix pour la gestion du compte");
  });

  it("treats the − sign as a débit (negative) — all five are money out", () => {
    expect(r.transactions.every((t) => t.amount < 0)).toBe(true);
  });

  it("validates the running balances chain (integrity signal)", () => {
    expect(r.balancesConsistent).toBe(true);
  });

  it("produces stable idempotency keys", () => {
    const again = parseBankPaste(PASTE);
    expect(again.transactions.map((t) => t.sourceKey)).toEqual(r.transactions.map((t) => t.sourceKey));
    expect(new Set(r.transactions.map((t) => t.sourceKey)).size).toBe(5);
  });

  it("flags an inconsistent chain when a line is missing", () => {
    const broken = parseBankPaste([
      `\t24.06.2026\tA\t\t\t2.00${M}-2\t22.06.2026\t\t19'694.87+19694.87\t`,
      `\t12.06.2026\tB\t\t\t145.00${M}-145\t12.06.2026\t\t19'855.00+19855\t`,
    ].join("\n"));
    expect(broken.transactions).toHaveLength(2);
    expect(broken.balancesConsistent).toBe(false); // 19'696.87 ≠ 19'855.00 − 2.00
  });
});
