import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { CompanySettings } from "@/types/companySettings";
import { DEFAULT_COMPANY_SETTINGS } from "@/types/companySettings";

const STORAGE_KEY = "kojima-company-settings";

interface CompanySettingsContextValue {
  settings: CompanySettings;
  updateSettings: (updates: Partial<CompanySettings>) => void;
}

const CompanySettingsContext = createContext<CompanySettingsContextValue | null>(null);

function loadSettings(): CompanySettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_COMPANY_SETTINGS, ...JSON.parse(raw) } : DEFAULT_COMPANY_SETTINGS;
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
