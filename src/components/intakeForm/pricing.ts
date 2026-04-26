import type { ModuleComplexity } from "@/types/module";
import {
  MAINTENANCE_OPTIONS, getModulePrice, getModuleYearlyFee,
} from "@/data/moduleCatalog";
import { BASE_PROJECT_COST, HOSTING_OPTIONS, PAGE_COUNT_OPTIONS } from "./constants";

export interface SelectedModule {
  id: string;
  complexity: ModuleComplexity;
}

export function computeEstimate(
  modules: SelectedModule[],
  timeline: string,
  maintenance: string,
  hostingTier: string,
  pageCount: string,
) {
  let devTotal = modules.reduce((sum, m) => sum + getModulePrice(m.id, m.complexity), 0);
  devTotal += BASE_PROJECT_COST;

  const pageExtra = PAGE_COUNT_OPTIONS.find(p => p.value === pageCount)?.extra ?? 0;
  devTotal += pageExtra;

  if (modules.length >= 4) devTotal *= 0.90;
  if (timeline === "urgent") devTotal *= 1.20;

  const low = Math.round((devTotal * 0.90) / 100) * 100;
  const high = Math.round((devTotal * 1.10) / 100) * 100;

  let yearly = 0;
  const hosting = HOSTING_OPTIONS.find(h => h.value === hostingTier);
  yearly += hosting?.yearly ?? 360;
  const maint = MAINTENANCE_OPTIONS.find(m => m.tier === maintenance);
  yearly += maint?.price ?? 0;
  modules.forEach(m => { yearly += getModuleYearlyFee(m.id, m.complexity); });

  return { low, high, yearly, devTotal: Math.round(devTotal), pageExtra };
}
