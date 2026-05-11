import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { CompanySettings, QuotePreset } from "@/types/companySettings";
import {
  DEFAULT_COMPANY_SETTINGS,
  DEFAULT_PAYMENT_TERMS_PRESETS,
  DEFAULT_CONDITIONS_PRESETS,
  LEGACY_PRESET_IDS,
} from "@/types/companySettings";

const STORAGE_KEY = "kojima-company-settings";

interface CompanySettingsContextValue {
  settings: CompanySettings;
  updateSettings: (updates: Partial<CompanySettings>) => void;
}

const CompanySettingsContext = createContext<CompanySettingsContextValue | null>(null);

function hasLegacyPresets(list: unknown): boolean {
  if (!Array.isArray(list)) return false;
  return (list as QuotePreset[]).some((p) => p?.id && LEGACY_PRESET_IDS.has(p.id));
}

function loadSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_COMPANY_SETTINGS;
    const parsed = JSON.parse(raw);
    const merged = { ...DEFAULT_COMPANY_SETTINGS } as Record<string, unknown>;
    for (const key of Object.keys(parsed) as (keyof CompanySettings)[]) {
      const val = parsed[key];
      if (val !== "" && val !== null && val !== undefined) {
        merged[key] = val;
      }
    }
    // One-shot migration: if the stored presets still carry v1 IDs (or are
    // missing entirely), refresh them so the new defaults take effect.
    if (hasLegacyPresets(merged.paymentTermsPresets) || !Array.isArray(merged.paymentTermsPresets) || (merged.paymentTermsPresets as QuotePreset[]).length === 0) {
      merged.paymentTermsPresets = DEFAULT_PAYMENT_TERMS_PRESETS;
    }
    if (!Array.isArray(merged.conditionsPresets) || (merged.conditionsPresets as QuotePreset[]).length === 0) {
      merged.conditionsPresets = DEFAULT_CONDITIONS_PRESETS;
    }
    return merged as CompanySettings;
  } catch {
    return DEFAULT_COMPANY_SETTINGS;
  }
}

export function CompanySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<CompanySettings>(loadSettings);

  const updateSettings = useCallback((updates: Partial<CompanySettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <CompanySettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </CompanySettingsContext.Provider>
  );
}

export function useCompanySettings() {
  const ctx = useContext(CompanySettingsContext);
  if (!ctx) throw new Error("useCompanySettings must be used within CompanySettingsProvider");
  return ctx;
}
