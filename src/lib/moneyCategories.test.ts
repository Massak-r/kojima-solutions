import { describe, it, expect } from "vitest";
import { resolveMoneyCategory, groupByCategory } from "./moneyCategories";

describe("resolveMoneyCategory", () => {
  it("range les libellés réellement présents en base", () => {
    // Relevés le 2026-08-14 sur payables + personal_costs.
    expect(resolveMoneyCategory("Maison")).toBe("logement");
    expect(resolveMoneyCategory("Logement")).toBe("logement");
    expect(resolveMoneyCategory("Assurance")).toBe("assurance");
    expect(resolveMoneyCategory("Assurance 3B")).toBe("assurance");
    expect(resolveMoneyCategory("Santé")).toBe("sante");
    expect(resolveMoneyCategory("Taxe")).toBe("taxes");
    expect(resolveMoneyCategory("Impots")).toBe("taxes");
    expect(resolveMoneyCategory("Charges sociales")).toBe("social");
    expect(resolveMoneyCategory("Internet")).toBe("telecom");
    expect(resolveMoneyCategory("Frais admin")).toBe("banque");
    expect(resolveMoneyCategory("Formation")).toBe("formation");
    expect(resolveMoneyCategory("SARL")).toBe("entreprise");
    expect(resolveMoneyCategory("Charges")).toBe("entreprise");
  });

  it("rattrape la faute de frappe « Fais admin » présente en base", () => {
    expect(resolveMoneyCategory("Fais admin")).toBe("banque");
  });

  it("ne laisse pas « Charges » capturer « Charges sociales »", () => {
    // L'ordre des règles est la seule chose qui garantit ça.
    expect(resolveMoneyCategory("charges sociales")).toBe("social");
    expect(resolveMoneyCategory("CHARGES SOCIALES")).toBe("social");
  });

  it("ignore accents et casse", () => {
    expect(resolveMoneyCategory("SANTÉ")).toBe("sante");
    expect(resolveMoneyCategory("Électricité")).toBe("logement");
    expect(resolveMoneyCategory("  impôts  ")).toBe("taxes");
  });

  it("accepte déjà un slug canonique", () => {
    expect(resolveMoneyCategory("logement")).toBe("logement");
  });

  it("tombe sur « autre » sans jamais échouer", () => {
    expect(resolveMoneyCategory(null)).toBe("autre");
    expect(resolveMoneyCategory("")).toBe("autre");
    expect(resolveMoneyCategory("   ")).toBe("autre");
    expect(resolveMoneyCategory("zzz inconnu")).toBe("autre");
  });
});

describe("groupByCategory", () => {
  it("regroupe, totalise et trie du plus lourd au plus léger", () => {
    const { totals, total } = groupByCategory([
      { category: "Maison", amount: 888 },        // logement
      { category: "Électricité", amount: 25 },    // logement
      { category: "Assurance", amount: 442.75 },
      { category: "Internet", amount: 80 },
    ]);
    expect(total).toBe(1435.75);
    expect(totals.map((t) => t.category)).toEqual(["logement", "assurance", "telecom"]);
    expect(totals[0].amount).toBe(913);
    expect(totals[0].count).toBe(2);
    expect(totals[0].share).toBeCloseTo(913 / 1435.75, 5);
  });

  it("écarte les montants nuls ou négatifs plutôt que d'afficher des barres vides", () => {
    const { totals, total } = groupByCategory([
      { category: "Maison", amount: 0 },
      { category: "Assurance", amount: -50 },
      { category: "Internet", amount: 80 },
    ]);
    expect(total).toBe(80);
    expect(totals).toHaveLength(1);
    expect(totals[0].category).toBe("telecom");
  });

  it("rend un total nul sans diviser par zéro", () => {
    const { totals, total } = groupByCategory([]);
    expect(total).toBe(0);
    expect(totals).toEqual([]);
  });
});
