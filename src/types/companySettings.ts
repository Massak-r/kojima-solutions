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

export const DEFAULT_PAYMENT_TERMS_PRESETS: QuotePreset[] = [
  {
    id: "pt-50-50-acompte",
    label: "50/50 avec acompte",
    content:
      "50% à la commande (acompte) — facturé immédiatement.\n50% à la livraison.\nPaiement à 14 jours après réception de la facture.",
  },
  {
    id: "pt-net30",
    label: "30 jours net",
    content: "Paiement à 30 jours net à compter de la date de facturation.\nMerci pour votre confiance.",
  },
  {
    id: "pt-comptant",
    label: "Comptant",
    content: "Paiement comptant à la livraison.",
  },
  {
    id: "pt-tranches-3",
    label: "30/40/30 (3 tranches)",
    content:
      "30% à la commande (acompte).\n40% à mi-parcours sur validation du jalon.\n30% à la livraison finale.",
  },
];

export const DEFAULT_CONDITIONS_PRESETS: QuotePreset[] = [
  {
    id: "cd-standard",
    label: "Standard",
    content:
      "Devis valable 30 jours à compter de la date d'émission.\nToute modification du périmètre fera l'objet d'un avenant chiffré séparément.",
  },
  {
    id: "cd-dev-web",
    label: "Développement web",
    content:
      "Devis valable 30 jours.\nLes modifications hors périmètre seront facturées au taux horaire en vigueur.\nLes coûts d'hébergement et de noms de domaine sont à la charge du client.",
  },
  {
    id: "cd-design",
    label: "Design / Création",
    content:
      "Devis valable 30 jours.\nDeux tours de retours inclus, retours supplémentaires facturés au taux horaire.\nCession des droits d'exploitation au paiement intégral.",
  },
];

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
