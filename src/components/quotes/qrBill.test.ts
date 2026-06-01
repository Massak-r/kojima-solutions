import { describe, it, expect } from "vitest";
import { SwissQRBill } from "swissqrbill/svg";
import { buildQrBillData } from "./QrBillSection";
import { DEFAULT_COMPANY_SETTINGS, type CompanySettings } from "@/types/companySettings";

const baseQuote = {
  quoteNumber: "FAC-2026-001",
  projectTitle: "Site vitrine",
  lineItems: [{ id: "l1", description: "Prestation", quantity: 1, unitPrice: 1000 }],
  applyTva: false,
  discountEnabled: false,
  discountType: "amount" as const,
  discountValue: 0,
};

// SIX official example normal IBAN (not a QR-IBAN) → "without reference" path.
const NORMAL_IBAN = "CH9300762011623852957";

const completeCreditor: Partial<CompanySettings> = {
  qrEnabled: true,
  qrIban: NORMAL_IBAN,
  qrCreditorName: "Kojima Solutions",
  qrCreditorStreet: "Chemin Ella-Maillart",
  qrCreditorBuildingNumber: "14",
  qrCreditorZip: "1208",
  qrCreditorCity: "Genève",
  qrCreditorCountry: "CH",
};

describe("buildQrBillData", () => {
  it("returns null when the QR-bill is disabled", () => {
    expect(buildQrBillData(baseQuote, { ...DEFAULT_COMPANY_SETTINGS })).toBeNull();
  });

  it("returns null when the créancier profile is incomplete", () => {
    const co = { ...DEFAULT_COMPANY_SETTINGS, qrEnabled: true, qrIban: NORMAL_IBAN };
    expect(buildQrBillData(baseQuote, co)).toBeNull();
  });

  it("falls back to the bank IBAN when no QR IBAN is set", () => {
    const co = { ...DEFAULT_COMPANY_SETTINGS, ...completeCreditor, qrIban: "", bankIban: NORMAL_IBAN };
    expect(buildQrBillData(baseQuote, co)?.creditor.account).toBe(NORMAL_IBAN);
  });

  it("builds a payload the library accepts (renders an SVG)", () => {
    const co = { ...DEFAULT_COMPANY_SETTINGS, ...completeCreditor };
    const data = buildQrBillData(baseQuote, co);
    expect(data).not.toBeNull();
    expect(data!.amount).toBe(1000);
    expect(data!.creditor.account).toBe(NORMAL_IBAN);
    expect(data!.message).toContain("FAC-2026-001");

    const svg = new SwissQRBill(data!, { language: "FR" }).toString();
    expect(svg).toContain("<svg");
  });
});
