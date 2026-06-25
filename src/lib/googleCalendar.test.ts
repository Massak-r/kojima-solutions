import { describe, it, expect } from "vitest";
import { buildGoogleCalendarUrl } from "./googleCalendar";

describe("buildGoogleCalendarUrl", () => {
  it("builds an all-day event with an end-exclusive next-day date", () => {
    const url = buildGoogleCalendarUrl({ title: "Payer loyer", date: "2026-06-30" });
    expect(url).not.toBeNull();
    const p = new URL(url!).searchParams;
    expect(p.get("action")).toBe("TEMPLATE");
    expect(p.get("text")).toBe("Payer loyer");
    expect(p.get("dates")).toBe("20260630/20260701");
  });

  it("rolls over month and year for the end-exclusive date", () => {
    expect(new URL(buildGoogleCalendarUrl({ title: "x", date: "2026-12-31" })!).searchParams.get("dates"))
      .toBe("20261231/20270101");
  });

  it("includes details when provided", () => {
    const url = buildGoogleCalendarUrl({ title: "TVA Q2", date: "2026-08-31", details: "Montant: 1'200.00\nCatégorie: TVA" });
    expect(new URL(url!).searchParams.get("details")).toBe("Montant: 1'200.00\nCatégorie: TVA");
  });

  it("returns null for a missing or malformed date", () => {
    expect(buildGoogleCalendarUrl({ title: "x", date: "" })).toBeNull();
    expect(buildGoogleCalendarUrl({ title: "x", date: "31.06.2026" })).toBeNull();
    expect(buildGoogleCalendarUrl({ title: "x", date: "2026-6-1" })).toBeNull();
  });
});
