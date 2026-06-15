export type RegistryEntryType = 'bank' | 'insurance' | 'subscription' | 'tax' | 'custom';
export type RegistryScope    = 'personal' | 'business' | 'both';
export type RegistryStatus   = 'active' | 'inactive' | 'expiring' | 'expired';

/**
 * Fields shared by every registry entry, stored inside the `meta` JSON blob:
 * one free "go further" link and up to two custom identifiers. Kept in `meta`
 * so no DB migration is needed — the column is schemaless JSON.
 */
export interface CommonMeta {
  linkLabel?: string;
  linkUrl?:   string;
  id1Label?:  string;
  id1Value?:  string;
  id2Label?:  string;
  id2Value?:  string;
}

export interface BankMeta extends CommonMeta {
  bank?:          string;
  accountType?:   string;
  iban?:          string;
  bic?:           string;
  agencyContact?: string;
  ebankingUrl?:   string;
}

export interface InsuranceMeta extends CommonMeta {
  insurer?:          string;
  insuranceType?:    string;
  policyNumber?:     string;
  premium?:          string;
  premiumFrequency?: string;
  startDate?:        string;
}

export interface SubscriptionMeta extends CommonMeta {
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

export interface TaxMeta extends CommonMeta {
  fiscalYear?: string;
  checklist?:  TaxChecklistItem[];
}

/** A user-defined label/value pair on a custom registry entry. */
export interface CustomField {
  id:    string;
  label: string;
  value: string;
}

/** Freeform category: the user adds their own copyable label/value fields. */
export interface CustomMeta extends CommonMeta {
  fields?: CustomField[];
}

export type RegistryMeta = BankMeta | InsuranceMeta | SubscriptionMeta | TaxMeta | CustomMeta;

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
  custom:       'Personnalisé',
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
    case 'custom':       return { fields: [] };
  }
}

const COMMON_META_KEYS: (keyof CommonMeta)[] = [
  'linkLabel', 'linkUrl', 'id1Label', 'id1Value', 'id2Label', 'id2Value',
];

/** Extracts just the shared fields (link, identifiers) from a meta blob. */
export function pickCommonMeta(meta: RegistryMeta | null | undefined): CommonMeta {
  const m = (meta ?? {}) as Record<string, unknown>;
  const out: CommonMeta = {};
  for (const key of COMMON_META_KEYS) {
    const value = m[key];
    if (typeof value === 'string' && value) out[key] = value;
  }
  return out;
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
