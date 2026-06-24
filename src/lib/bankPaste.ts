// Parser for a pasted PostFinance e-banking transaction list → structured bank
// lines, ready to forward to Soroban's "À classer". The manual pendant of the
// CAMT.053 import (src/lib/camt.ts) for when there's no XML file — you just copy
// the table out of e-banking and paste it.
//
// The paste is messy: tab-separated, with a header row, "Détails"/"Actions"
// noise rows, an optional leading counterparty column, two dates (booking +
// value), and DOUBLED amount/balance cells where the copy smushes the formatted
// value and the raw value together: "2.00−-2", "19'694.87+19694.87". The "−"
// (U+2212) suffix marks a débit (money out), "+" a crédit (money in).
//
// The parser is position-tolerant: it classifies cells by content (date / money
// / text), not by fixed column index, so it copes with the empty cells and the
// optional counterparty column.

export interface BankPasteTxn {
  bookingDate: string;   // YYYY-MM-DD
  valueDate: string;     // YYYY-MM-DD (== bookingDate if absent)
  amount: number;        // signed CHF: negative = débit (sortie), positive = crédit (entrée)
  currency: "CHF";
  description: string;
  counterparty: string;  // best-effort merchant / payee
  balanceAfter: number | null;
  raw: string;           // original line, for traceability
  sourceKey: string;     // idempotency key (bookingDate|amount|description)
}

export interface BankPasteResult {
  transactions: BankPasteTxn[];
  /** True when the running balances chain consistently; null if not checkable. */
  balancesConsistent: boolean | null;
  skipped: number; // non-transaction lines ignored (header, "Détails", blanks…)
}

const DATE_RE = /^\d{2}\.\d{2}\.\d{4}$/;
// A formatted money cell: digits/apostrophes then a sign (+ or − U+2212), e.g.
// "2.00−-2", "19'694.87+19694.87". The trailing raw value is ignored.
const MONEY_RE = /([\d'][\d'.,]*)\s*([+−])/;
const NOISE_RE = /^(détails|actions|d|type)$/i;

/** A money cell is short and matches the formatted-then-sign shape — the length
 *  guard stops a long description with an embedded "1998-2000" from being eaten. */
function isMoney(cell: string): boolean {
  return cell.length <= 24 && MONEY_RE.test(cell);
}

function toIso(d: string): string {
  const [dd, mm, yyyy] = d.split(".");
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse a formatted/doubled Swiss money cell into a signed number, or null. */
export function parseMoneyCell(cell: string): number | null {
  const m = cell.match(MONEY_RE);
  if (m) {
    const magnitude = parseFloat(m[1].replace(/'/g, "").replace(/,/g, "."));
    if (!Number.isFinite(magnitude)) return null;
    return m[2] === "−" ? -magnitude : magnitude;
  }
  // Fallback: a plain cell like "-83.65", "83.65-", "1'234.50".
  const cleaned = cell.replace(/'/g, "").replace(/\s/g, "");
  const negative = /^[−-]/.test(cleaned) || /[−-]$/.test(cleaned);
  const n = parseFloat(cleaned.replace(/[+−-]/g, ""));
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

/** PostFinance descriptions read "Achat/... du DD.MM.YYYY, MERCHANT". */
function merchantFromDescription(desc: string): string {
  const after = desc.split(",").pop()?.trim();
  return after && after.length > 1 ? after : desc.trim();
}

export function parseBankPaste(text: string): BankPasteResult {
  const txns: BankPasteTxn[] = [];
  let skipped = 0;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (/cr[ée]dit en chf|solde en chf|texte de notification/i.test(line)) { skipped++; continue; } // header

    const cells = line.split("\t").map((c) => c.trim());
    const dates = cells.filter((c) => DATE_RE.test(c));
    const money = cells.filter(isMoney);
    if (dates.length === 0 || money.length === 0) { skipped++; continue; } // Détails / blanks / wrapped

    const amount = parseMoneyCell(money[0]);
    if (amount === null) { skipped++; continue; }
    const balanceAfter = money.length > 1 ? parseMoneyCell(money[money.length - 1]) : null;

    const textCells = cells.filter(
      (c) => c && !DATE_RE.test(c) && !isMoney(c) && !NOISE_RE.test(c),
    );
    const description = textCells.slice().sort((a, b) => b.length - a.length)[0] ?? "";
    const counterparty = (textCells.find((c) => c !== description) ?? merchantFromDescription(description)).trim();

    const bookingDate = toIso(dates[0]);
    txns.push({
      bookingDate,
      valueDate: toIso(dates[dates.length - 1]),
      amount,
      currency: "CHF",
      description,
      counterparty,
      balanceAfter,
      raw: line.trim(),
      sourceKey: `${bookingDate}|${amount.toFixed(2)}|${description}`.slice(0, 191),
    });
  }

  // Balance chain: as pasted (newest→oldest), newer.balance = older.balance + newer.amount.
  let balancesConsistent: boolean | null = null;
  const withBal = txns.filter((t) => t.balanceAfter !== null);
  if (withBal.length >= 2) {
    balancesConsistent = true;
    for (let i = 0; i < withBal.length - 1; i++) {
      const expected = (withBal[i + 1].balanceAfter as number) + withBal[i].amount;
      if (Math.abs(expected - (withBal[i].balanceAfter as number)) > 0.015) { balancesConsistent = false; break; }
    }
  }

  return { transactions: txns, balancesConsistent, skipped };
}
