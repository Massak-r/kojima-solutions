export type RegistryEntryType = 'bank' | 'insurance' | 'subscription' | 'tax';
export type RegistryScope    = 'personal' | 'business' | 'both';
export type RegistryStatus   = 'active' | 'inactive' | 'expiring' | 'expired';

export interface BankMeta {
  bank?:          string;
  accountType?:   string;
  iban?:          string;
  bic?:           string;
  agencyContact?: string;
  ebankingUrl?:   string;
}

export interface InsuranceMeta {
  insurer?:          string;
  insuranceType?:    string;
  policyNumber?:     string;
  premium?:          string;
  premiumFrequency?: string;
  startDate?:        string;
}

export interface SubscriptionMeta {
  provider?:       string;
  amount?:         string;
  frequency?:      string;
  category?:       string;
  contractEndDate?: string;
}

export interface TaxChecklistItem {
  id:    string;
  label: string;
  done:  boolean;
}

export interface TaxMeta {
  fiscalYear?: string;
  checklist?:  TaxChecklistItem[];
}

export type RegistryMeta = BankMeta | InsuranceMeta | SubscriptionMeta | TaxMeta;

export interface RegistryEntry {
  id:              string;
  type:            RegistryEntryType;
  name:            string;
  scope:           RegistryScope;
  status:          RegistryStatus;
  folderId?:       string | null;
  notes?:          string | null;
  meta?:           RegistryMeta | null;
  nextActionDate?: string | null;
  remindDays:      number;
  sortOrder:       number;
  createdAt:       string;
  updatedAt:       string;
}

export const TYPE_LABELS: Record<RegistryEntryType, string> = {
  bank:         'Banques',
  insurance:    'Assurances',
  subscription: 'Abonnements',
  tax:          'Fiscalité',
};

export const SCOPE_LABELS: Record<RegistryScope, string> = {
  personal: 'Perso',
  business: 'Business',
  both:     'Les deux',
};

export const STATUS_LABELS: Record<RegistryStatus, string> = {
  active:   'Actif',
  inactive: 'Inactif',
  expiring: 'Expire bientôt',
  expired:  'Expiré',
};

export const REMIND_OPTIONS = [7, 14, 30, 60, 90];

export function defaultMeta(type: RegistryEntryType): RegistryMeta {
  switch (type) {
    case 'bank':         return {};
    case 'insurance':    return {};
    case 'subscription': return {};
    case 'tax':          return { checklist: [] };
  }
}

export function daysUntilAction(entry: RegistryEntry): number | null {
  if (!entry.nextActionDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(entry.nextActionDate);
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

export function isExpiringSoon(entry: RegistryEntry): boolean {
  const days = daysUntilAction(entry);
  if (days === null) return false;
  return days <= entry.remindDays;
}
