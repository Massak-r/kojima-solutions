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
    content: "Paiement à la fin de la prestation.",
  },
  {
    id: "pt-acomptes-50-50",
    label: "Acomptes 50/50",
    content:
      "Acomptes : 50% à la commande, 50% à la livraison.\n" +
      "Et sur validation du devis, la facture d'acompte vous sera envoyée.",
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

/** IDs from the v1 preset set, used to detect a localStorage state that
 *  predates the current default copy so we can refresh it once on load. */
export const LEGACY_PRESET_IDS = new Set([
  "pt-50-50-acompte",
  "pt-net30",
  "pt-comptant",
  "pt-tranches-3",
]);

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: "Kojima.Solutions",
  ownerName: "Massaki Chraïti",
  address: "Rue de la Paix 4, 1020 Renens, Suisse",
  email: "massaki@kojima-solutions.ch",
  website: "kojima-solutions.ch",
  ideNumber: "",
  bankAccountHolder: "Kojima Solutions — Massaki Chraïti",
  bankIban: "",
  bankBic: "",
  bankName: "",
  defaultConditions: "",
  defaultHourlyRate: 120,
  paymentTermsPresets: DEFAULT_PAYMENT_TERMS_PRESETS,
  conditionsPresets: DEFAULT_CONDITIONS_PRESETS,
};
