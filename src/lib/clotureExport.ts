import { type Quote, totalQuote, tvaAmountQuote } from "@/types/quote";
import { type Expense, EXPENSE_CATEGORY_LABELS } from "@/types/expense";

// Consolidated year-end export for the fiduciaire: one CSV with a summary block
// then the revenue + expense detail. Figures mirror the Accounting "Bilan
// annuel" exactly (paid invoices by createdAt year; TVA via tvaAmountQuote).

export interface ClotureRow {
  section: string;
  date: string;
  ref: string;
  libelle: string;
  montant: number | string;
  tva: number | string;
  recu: string;
}

export const CLOTURE_COLUMNS: { key: string; label: string }[] = [
  { key: "section", label: "Section" },
  { key: "date", label: "Date" },
  { key: "ref", label: "Référence" },
  { key: "libelle", label: "Libellé" },
  { key: "montant", label: "Montant (CHF)" },
  { key: "tva", label: "TVA (CHF)" },
  { key: "recu", label: "Reçu" },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ClotureSummary {
  revenueTTC: number;
  tvaCollected: number;
  revenueHT: number;
  expenses: number;
  profitHT: number;
  quarters: [number, number, number, number];
}

/** Paid invoices booked in `year` (by createdAt) — same filter the Accounting bilan uses. */
function paidInvoicesOf(year: number, quotes: Quote[]): Quote[] {
  return quotes.filter(
    (q) => q.invoiceStatus === "paid" && !q.isTemplate && new Date(q.createdAt).getFullYear() === year,
  );
}

export function computeClotureSummary(year: number, quotes: Quote[], expenses: Expense[]): ClotureSummary {
  const paid = paidInvoicesOf(year, quotes);
  const revenueTTC = round2(paid.reduce((s, q) => s + totalQuote(q), 0));
  const tvaCollected = round2(paid.reduce((s, q) => s + tvaAmountQuote(q), 0));
  const yearExp = expenses.filter((e) => new Date(e.date).getFullYear() === year);
  const expTotal = round2(yearExp.reduce((s, e) => s + e.amount, 0));
  const q: [number, number, number, number] = [0, 0, 0, 0];
  for (const inv of paid) q[Math.floor(new Date(inv.createdAt).getMonth() / 3)] += totalQuote(inv);
  return {
    revenueTTC,
    tvaCollected,
    revenueHT: round2(revenueTTC - tvaCollected),
    expenses: expTotal,
    profitHT: round2(revenueTTC - tvaCollected - expTotal),
    quarters: [round2(q[0]), round2(q[1]), round2(q[2]), round2(q[3])],
  };
}

export function buildClotureRows(year: number, quotes: Quote[], expenses: Expense[]): ClotureRow[] {
  const s = computeClotureSummary(year, quotes, expenses);
  const blank: ClotureRow = { section: "", date: "", ref: "", libelle: "", montant: "", tva: "", recu: "" };
  const sum = (libelle: string, montant: number, tva: number | string = ""): ClotureRow =>
    ({ section: "RÉSUMÉ", date: "", ref: "", libelle, montant, tva, recu: "" });

  const rows: ClotureRow[] = [
    sum("CA encaissé (TTC)", s.revenueTTC, s.tvaCollected),
    sum("CA hors taxe (HT)", s.revenueHT),
    sum("Charges (dépenses)", s.expenses),
    sum("Bénéfice estimé (HT)", s.profitHT),
    sum("TVA collectée à reverser", s.tvaCollected),
    sum("CA T1 (TTC)", s.quarters[0]),
    sum("CA T2 (TTC)", s.quarters[1]),
    sum("CA T3 (TTC)", s.quarters[2]),
    sum("CA T4 (TTC)", s.quarters[3]),
    blank,
  ];

  for (const q of paidInvoicesOf(year, quotes).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    rows.push({
      section: "REVENU",
      date: q.createdAt.slice(0, 10),
      ref: q.quoteNumber || "",
      libelle: [q.clientName, q.projectTitle].filter(Boolean).join(" — "),
      montant: round2(totalQuote(q)),
      tva: round2(tvaAmountQuote(q)),
      recu: "",
    });
  }
  rows.push(blank);

  for (const e of expenses
    .filter((e) => new Date(e.date).getFullYear() === year)
    .sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push({
      section: "DÉPENSE",
      date: e.date,
      ref: EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
      libelle: [e.description, e.notes].filter(Boolean).join(" · "),
      montant: round2(e.amount),
      tva: "",
      recu: e.receiptUrl || "",
    });
  }

  return rows;
}
