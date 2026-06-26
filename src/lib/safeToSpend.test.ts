import { describe, it, expect } from "vitest";
import { computeSetAside } from "./safeToSpend";

describe("computeSetAside", () => {
  it("provisions tax on profit when not charging TVA", () => {
    const r = computeSetAside({ revenueTTC: 10000, tvaCollected: 0, expenses: 4000, rate: 25 });
    expect(r.revenueHT).toBe(10000);
    expect(r.tvaToRemit).toBe(0);
    expect(r.taxProvision).toBe(1500); // (10000-4000)*25%
    expect(r.total).toBe(1500);
  });

  it("adds TVA to remit and provisions on the HT profit", () => {
    const r = computeSetAside({ revenueTTC: 10810, tvaCollected: 810, expenses: 4000, rate: 25 });
    expect(r.revenueHT).toBe(10000);
    expect(r.taxProvision).toBe(1500); // (10000-4000)*25%
    expect(r.total).toBe(2310);        // 810 + 1500
  });

  it("never provisions negative tax when expenses exceed revenue", () => {
    const r = computeSetAside({ revenueTTC: 3000, tvaCollected: 0, expenses: 5000, rate: 25 });
    expect(r.taxProvision).toBe(0);
    expect(r.total).toBe(0);
  });

  it("a zero rate still keeps TVA aside", () => {
    const r = computeSetAside({ revenueTTC: 5400, tvaCollected: 400, expenses: 0, rate: 0 });
    expect(r.taxProvision).toBe(0);
    expect(r.total).toBe(400);
  });
});
