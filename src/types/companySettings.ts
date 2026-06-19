export interface QuotePreset {
  id: string;
  label: string;
  content: string;
}

export interface CompanySettings {
  companyName: string;
  ownerName: string;
  address: string;
  email: string;
  website: string;
  ideNumber: string;
  bankAccountHolder: string;
  bankIban: string;
  bankBic: string;
  bankName: string;
  // Swiss QR-bill (QR-facture) — créancier / émetteur, configurable so the
  // account can switch (perso → SARL/PostFinance) without touching code.
  qrEnabled: boolean;
  qrIban: string;
  qrCreditorName: string;
  qrCreditorStreet: string;
  qrCreditorBuildingNumber: string;
  qrCreditorZip: string;
  qrCreditorCity: string;
  qrCreditorCountry: string;
  defaultConditions: string;
  defaultHourlyRate: number;
  paymentTermsPresets: QuotePreset[];
  conditionsPresets: QuotePreset[];
}

const HOURLY_CLAUSE =
  "Tout horaire en dehors des prestations ou en supplément : 120 CHF de l'heure.";

export const DEFAULT_PAYMENT_TERMS_PRESETS: QuotePreset[] = [
  {
    id: "pt-end-of-service",
    label: "Paiement à la fin",
    content: "Paiement intégral à la livraison de la prestation.",
  },
  {
    id: "pt-acompte-50-50",
    label: "Acomptes 50/50",
    content:
      "Paiement en deux temps : 50% à la signature du devis (acompte), 50% à la livraison de la prestation.\n" +
      "Une facture d'acompte vous sera transmise dès validation du devis.",
  },
];

export const DEFAULT_CONDITIONS_PRESETS: QuotePreset[] = [
  {
    id: "cd-standard",
    label: "Standard",
    content:
      "Devis valable 30 jours à compter de la date d'émission.\n" +
      "Toute modification du périmètre fera l'objet d'un avenant chiffré séparément.\n" +
      HOURLY_CLAUSE,
  },
  {
    id: "cd-dev-web",
    label: "Développement web",
    content:
      "Devis valable 30 jours.\n" +
      "Les modifications hors périmètre seront facturées au taux horaire en vigueur.\n" +
      "Les coûts d'hébergement et de noms de domaine sont à la charge du client.\n" +
      HOURLY_CLAUSE,
  },
  {
    id: "cd-design",
    label: "Design / Création",
    content:
      "Devis valable 30 jours.\n" +
      "Deux tours de retours inclus, retours supplémentaires facturés au taux horaire.\n" +
      "Cession des droits d'exploitation au paiement intégral.\n" +
      HOURLY_CLAUSE,
  },
];

/** Preset IDs from previous default sets. Detecting any of these in a
 *  user's stored settings triggers a one-shot refresh to the current
 *  defaults, so wording tweaks ship without requiring a manual reset. */
export const LEGACY_PRESET_IDS = new Set([
  // v1 set (initial release)
  "pt-50-50-acompte",
  "pt-net30",
  "pt-comptant",
  "pt-tranches-3",
  // v2 set (introduced "Paiement à la fin" + "Acomptes 50/50")
  "pt-acomptes-50-50",
]);

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: "Kojima.Solutions",
  ownerName: "Massaki Chraïti",
  address: "Rue de la Paix 4, 1020 Renens, Suisse",
  email: "massaki@kojima-solutions.ch",
  website: "kojima-solutions.ch",
  ideNumber: "",
  bankAccountHolder: "Kojima Solutions - Massaki Chraïti",
  bankIban: "",
  bankBic: "",
  bankName: "",
  qrEnabled: false,
  qrIban: "",
  qrCreditorName: "",
  qrCreditorStreet: "",
  qrCreditorBuildingNumber: "",
  qrCreditorZip: "",
  qrCreditorCity: "",
  qrCreditorCountry: "CH",
  defaultConditions: "",
  defaultHourlyRate: 120,
  paymentTermsPresets: DEFAULT_PAYMENT_TERMS_PRESETS,
  conditionsPresets: DEFAULT_CONDITIONS_PRESETS,
};
