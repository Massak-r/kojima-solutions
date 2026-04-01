export type ConsumableUnit = 'days' | 'weeks' | 'months';

export const UNIT_DAYS: Record<ConsumableUnit, number> = {
  days:   1,
  weeks:  7,
  months: 30,
};

export const UNIT_LABELS: Record<ConsumableUnit, string> = {
  days:   'jours',
  weeks:  'semaines',
  months: 'mois',
};

export interface Consumable {
  id:             string;
  name:           string;
  estimatedCost:  number;
  everyN:         number;
  unit:           ConsumableUnit;
  lastPurchased?: string;   // YYYY-MM-DD
  bundleIds:      string[];
  createdAt:      string;
}

/** Returns YYYY-MM-DD of next due date, or null if never purchased */
export function getNextDue(c: { lastPurchased?: string; everyN: number; unit: ConsumableUnit }): string | null {
  if (!c.lastPurchased) return null;
  const d = new Date(c.lastPurchased);
  d.setDate(d.getDate() + c.everyN * UNIT_DAYS[c.unit]);
  return d.toISOString().slice(0, 10);
}

/** Days until due (negative = overdue). null if never purchased. */
export function getDaysUntilConsumableDue(c: { lastPurchased?: string; everyN: number; unit: ConsumableUnit }): number | null {
  const due = getNextDue(c);
  if (!due) return null;
  return Math.round((new Date(due).getTime() - Date.now()) / 86400000);
}
