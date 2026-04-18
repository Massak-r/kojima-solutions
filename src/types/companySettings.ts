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
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  companyName: "Kojima.Solutions",
  ownerName: "Massaki Chraïti",
  address: "Rue de la Paix 4, 1020 Renens, Suisse",
  email: "massaki@kojima-solutions.ch",
  website: "kojima-solutions.ch",
  ideNumber: "CHE-000.000.000",
  bankAccountHolder: "Kojima Solutions — Massaki Chraïti",
  bankIban: "CH00 0000 0000 0000 0000 0",
  bankBic: "XXXXXXXX",
  bankName: "",
  defaultConditions: "",
  defaultHourlyRate: 120,
};
