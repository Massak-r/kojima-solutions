import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Lang = "fr" | "en";

interface LanguageContextType {
  lang: Lang;
  toggle: () => void;
  t: (fr: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "kojima-lang";

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "fr";
  // First-time visitors get a best-effort guess from the browser's
  // accept-language; explicit toggles then win and persist in localStorage.
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch { /* localStorage blocked */ }
  const nav = navigator.language?.slice(0, 2).toLowerCase();
  return nav === "en" ? "en" : "fr";
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>(readStoredLang);

  // Persist the choice so an English client doesn't lose their toggle on
  // every page reload / proposal-link revisit.
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
    // Mirror to the <html lang> attribute so the browser + screen readers
    // know which language to apply for word-break, hyphenation, spell-check.
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const toggle = () => setLang((l) => (l === "fr" ? "en" : "fr"));
  const t = (fr: string, en: string) => (lang === "fr" ? fr : en);

  return (
    <LanguageContext.Provider value={{ lang, toggle, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
