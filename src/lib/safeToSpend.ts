// Shared "is it really my money?" math, used by BOTH the Finance page's
// "À mettre de côté" panel (TaxSetAside) and the Trésorerie "Disponible
// maintenant" card — so the two can never show contradictory set-aside figures.

export const TAX_PROVISION_RATE_KEY = "kojima-tax-provision-rate";
export const DEFAULT_TAX_PROVISION_RATE = 25;

/** Read the income-tax provision rate (% of profit) the user set on the Finance
 *  page. Falls back to the default if unset/unparseable/unavailable. */
export function readTaxProvisionRate(): number {
  try {
    const n = parseFloat(localStorage.getItem(TAX_PROVISION_RATE_KEY) ?? "");
    return isFinite(n) ? Math.min(60, Math.max(0, n)) : DEFAULT_TAX_PROVISION_RATE;
  } catch {
    return DEFAULT_TAX_PROVISION_RATE;
  }
}

export interface SetAsideInput {
  /** Encaissé TTC (paid invoices). */
  revenueTTC: number;
  /** Real TVA collected on those invoices (0 if not charging TVA). */
  tvaCollected: number;
  /** Charges / expenses over the same period. */
  expenses: number;
  /** Income-tax provision, % of profit. */
  rate: number;
}

export interface SetAside {
  revenueHT: number;
  /** TVA to reverse to the AFC. */
  tvaToRemit: number;
  /** Provisioned income tax on the profit. */
  taxProvision: number;
  /** tvaToRemit + taxProvision — the total to keep aside. */
  total: number;
}

/** Money to keep aside out of what's been collected: TVA due + a tax provision
 *  on profit (profit = encaissé HT − charges, never negative). */
export function computeSetAside({ revenueTTC, tvaCollected, expenses, rate }: SetAsideInput): SetAside {
  const revenueHT = Math.max(0, revenueTTC - tvaCollected);
  const taxProvision = Math.max(0, revenueHT - expenses) * (rate / 100);
  return { revenueHT, tvaToRemit: tvaCollected, taxProvision, total: tvaCollected + taxProvision };
}
