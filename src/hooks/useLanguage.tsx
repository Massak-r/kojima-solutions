import { createContext, useContext, useState, ReactNode } from "react";

type Lang = "fr" | "en";

interface LanguageContextType {
  lang: Lang;
  toggle: () => void;
  t: (fr: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLang] = useState<Lang>("fr");
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
