import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { Quote } from "@/types/quote";
import * as storage from "@/lib/quoteStorage";

type QuotesContextType = {
  quotes: Quote[];
  addQuote: (quote: Quote) => void;
  updateQuote: (id: string, quote: Quote) => void;
  deleteQuote: (id: string) => void;
  getQuote: (id: string) => Quote | undefined;
  refresh: () => void;
};

const QuotesContext = createContext<QuotesContextType | null>(null);

export function QuotesProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    setQuotes(storage.loadQuotes());
  }, []);

  const refresh = useCallback(() => {
    setQuotes(storage.loadQuotes());
  }, []);

  const addQuote = useCallback((quote: Quote) => {
    storage.addQuote(quote);
    setQuotes(storage.loadQuotes());
  }, []);

  const updateQuote = useCallback((id: string, updated: Quote) => {
    storage.updateQuote(id, updated);
    setQuotes(storage.loadQuotes());
  }, []);

  const deleteQuote = useCallback((id: string) => {
    storage.deleteQuote(id);
    setQuotes(storage.loadQuotes());
  }, []);

  const getQuote = useCallback((id: string) => storage.getQuoteById(id), []);

  return (
    <QuotesContext.Provider
      value={{ quotes, addQuote, updateQuote, deleteQuote, getQuote, refresh }}
    >
      {children}
    </QuotesContext.Provider>
  );
}

export function useQuotes() {
  const ctx = useContext(QuotesContext);
  if (!ctx) throw new Error("useQuotes must be used within QuotesProvider");
  return ctx;
}
