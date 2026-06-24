import { describe, it, expect } from "vitest";
import {
  assignDomain,
  nextOccurrenceISO,
  computeGauges,
  buildTimeline,
  summarize,
  type ComplianceInput,
} from "./adminCompliance";
import type { SubtaskItem } from "@/api/todoSubtasks";
import type { Payable } from "@/types/payable";

// 24 Jun 2026 (month index 5) — the day the admin checklist was seeded.
const TODAY = new Date(2026, 5, 24);

function sub(over: Partial<SubtaskItem> & { text: string }): SubtaskItem {
  return {
    id: over.id ?? over.text,
    source: "admin",
    parentId: "obj",
    parentSubtaskId: "grp",
    completed: false,
    order: 0,
    priority: "medium",
    status: "not_started",
    flaggedToday: false,
    sprintTier: "nice",
    createdAt: "2026-06-24 16:00:00",
    ...over,
  };
}

function payable(over: Partial<Payable>): Payable {
  return {
    id: "p", label: "x", amount: 100, currency: "CHF", direction: "out",
    status: "pending", commitment: "committed", recurrence: "none",
    createdAt: "", updatedAt: "", ...over,
  };
}

describe("assignDomain", () => {
  it("routes the real checklist subtasks to the right domains (order matters)", () => {
    expect(assignDomain("Vérifier le seuil TVA (CA 12 mois glissants < CHF 100'000)")).toBe("tva");
    expect(assignDomain("Boucler l'exercice au 31.12.2026 dans Soroban")).toBe("bouclement");
    expect(assignDomain("Générer les états financiers (bilan + compte de résultat) en PDF")).toBe("bouclement");
    expect(assignDomain("Assemblée des associés : approuver les comptes 2026 + rédiger le PV")).toBe("gouvernance");
    expect(assignDomain("Déclaration fiscale de la Sàrl (impôt bénéfice + capital, GE)")).toBe("impots");
    // "des salaires à l'OCAS" must land in charges, not salaire:
    expect(assignDomain("Déclaration annuelle des salaires à l'OCAS")).toBe("charges");
    expect(assignDomain("Souscrire l'assurance accidents professionnels (LAA-AAP)")).toBe("charges");
    expect(assignDomain("Fiche de salaire du gérant + verser le net (~CHF 2'000)")).toBe("salaire");
    expect(assignDomain("Compta du mois : justificatifs + rapprochement bancaire dans Soroban")).toBe("compta");
    // "déclaration fiscale ... avec certificat de salaire" → impôts wins over salaire:
    expect(assignDomain("Déclaration fiscale personnelle du gérant (avec certificat de salaire)")).toBe("impots");
  });

  it("returns null for frequency-group headers", () => {
    expect(assignDomain("Mise en place (à faire maintenant)")).toBeNull();
    expect(assignDomain("Chaque mois")).toBeNull();
    expect(assignDomain("Chaque trimestre")).toBeNull();
  });
});

describe("nextOccurrenceISO", () => {
  it("returns this month's day if still ahead, else next month's", () => {
    expect(nextOccurrenceISO(TODAY, "monthly", 25)).toBe("2026-06-25"); // tomorrow
    expect(nextOccurrenceISO(TODAY, "monthly", 5)).toBe("2026-07-05");  // already past the 5th
  });
  it("clamps the day to the month length", () => {
    expect(nextOccurrenceISO(new Date(2026, 1, 10), "monthly", 31)).toBe("2026-02-28");
  });
  it("returns null when there is no recurrence", () => {
    expect(nextOccurrenceISO(TODAY, null, null)).toBeNull();
  });
});

describe("computeGauges (Phase 1, task-only)", () => {
  const subtasks = [
    sub({ text: "Fiche de salaire du gérant + verser le net", recurrence: "monthly", recurrenceDay: 25 }),
    sub({ text: "Compta du mois : rapprochement bancaire dans Soroban", recurrence: "monthly", recurrenceDay: 5 }),
    sub({ text: "Souscrire l'assurance accidents professionnels (LAA-AAP)", dueDate: "2026-07-15" }),
    sub({ text: "Payer l'acompte OCAS du trimestre", dueDate: "2026-09-30" }),
    sub({ text: "Vérifier le seuil TVA", dueDate: "2026-09-30" }),
    sub({ text: "Boucler l'exercice au 31.12.2026 dans Soroban", dueDate: "2027-03-31" }),
    sub({ text: "Déclaration fiscale de la Sàrl", dueDate: "2027-09-30" }),
    sub({ text: "Assemblée des associés + PV", dueDate: "2027-06-30" }),
  ];
  const input: ComplianceInput = { subtasks, payables: [], today: TODAY };
  const byKey = Object.fromEntries(computeGauges(input).map((g) => [g.key, g]));

  it("flags salaire amber on the 24th (the 25 is imminent)", () => {
    expect(byKey.salaire.status).toBe("amber");
  });

  it("keeps far-off seasonal domains N-A (hors saison), never red", () => {
    expect(byKey.bouclement.status).toBe("na"); // 2027-03-31 is well beyond the horizon
    expect(byKey.impots.status).toBe("na");      // 2027-09-30
    expect(byKey.gouvernance.status).toBe("na"); // 2027-06-30
  });

  it("never asserts red for Soroban-truth domains without the signal", () => {
    expect(byKey.compta.status).not.toBe("red");
    expect(byKey.tva.status).not.toBe("red");
    expect(byKey.salaire.status).not.toBe("red");
    // and those carry a Phase-2 note explaining the cap
    expect(byKey.compta.phase2Note).toBeTruthy();
    expect(byKey.tva.phase2Note).toBeTruthy();
  });

  it("summarises applicable vs hors-saison honestly", () => {
    const s = summarize(computeGauges(input));
    expect(s.applicable).toBe(4); // salaire, charges, compta, tva
    expect(s.naCount).toBe(3);    // bouclement, impots, gouvernance
    expect(s.worst?.status).not.toBe("green");
  });
});

describe("computeGauges (Phase 2, with Soroban signal)", () => {
  it("turns salaire green once booked_through covers the current month", () => {
    const subtasks = [sub({ text: "Fiche de salaire du gérant", recurrence: "monthly", recurrenceDay: 25 })];
    const g = computeGauges({
      subtasks, payables: [], today: TODAY,
      signal: { payroll: { booked_through: "2026-06", months_booked: ["2026-06"] } },
    }).find((x) => x.key === "salaire")!;
    expect(g.status).toBe("green");
    expect(g.phase2Note).toBeUndefined(); // note drops once the real signal is in
  });

  it("turns the TVA gauge real (red) when the rolling CA reaches the threshold", () => {
    const g = computeGauges({
      subtasks: [sub({ text: "Vérifier le seuil TVA", dueDate: "2026-09-30" })],
      payables: [], today: TODAY,
      signal: { vat: { revenue_rolling_12m_cents: 10_500_000, threshold_cents: 10_000_000 } },
    }).find((x) => x.key === "tva")!;
    expect(g.status).toBe("red");
  });
});

describe("buildTimeline", () => {
  it("buckets open deadlines by rolling window, soonest first, and drops completed", () => {
    const input: ComplianceInput = {
      today: TODAY,
      payables: [payable({ id: "ocas", label: "Acompte OCAS", dueDate: "2026-09-30", amount: 2226 })],
      subtasks: [
        sub({ id: "sal", text: "Fiche de salaire", recurrence: "monthly", recurrenceDay: 25 }), // 06-25 → week
        sub({ id: "laa", text: "Souscrire LAA", dueDate: "2026-07-15" }),                        // → month
        sub({ id: "done", text: "Affilier OCAS", dueDate: "2026-07-15", completed: true }),      // excluded
        sub({ id: "ag", text: "Assemblée + PV", dueDate: "2027-06-30" }),                        // → later
      ],
    };
    const buckets = buildTimeline(input);
    const map = Object.fromEntries(buckets.map((b) => [b.key, b.items.map((i) => i.id)]));
    expect(map.week).toEqual(["sal"]);
    expect(map.month).toEqual(["laa"]);
    expect(map.later).toEqual(["ag"]);
    // completed obligation never appears
    expect(buckets.flatMap((b) => b.items.map((i) => i.id))).not.toContain("done");
  });
});
