import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { Quote } from "@/types/quote";
import * as api from "@/api/quotes";
import * as storage from "@/lib/quoteStorage";

type QuotesContextType = {
  quotes: Quote[];
  loading: boolean;
  addQuote: (quote: Quote) => void;
  updateQuote: (id: string, quote: Quote) => void;
  deleteQuote: (id: string) => void;
  getQuote: (id: string) => Quote | undefined;
  refresh: () => void;
};

const QuotesContext = createContext<QuotesContextType | null>(null);

export function QuotesProvider({ children }: { children: ReactNode }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiAvailable, setApiAvailable] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.listQuotes()
      .then((data) => {
        setQuotes(data);
        setApiAvailable(true);
      })
      .catch(() => {
        setApiAvailable(false);
        setQuotes(storage.loadQuotes());
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((updated: Quote[]) => {
    try { storage.saveQuotes(updated); } catch {}
  }, []);

  const applyAndSync = useCallback(
    (updater: (prev: Quote[]) => Quote[], apiCall?: () => Promise<unknown>) => {
      setQuotes((prev) => {
        const next = updater(prev);
        persist(next);
        return next;
      });
      if (apiCall && apiAvailable) {
        apiCall().catch(() => {});
      }
    },
    [persist, apiAvailable]
  );

  const refresh = useCallback(() => {
    if (apiAvailable) {
      api.listQuotes().then(setQuotes).catch(() => setQuotes(storage.loadQuotes()));
    } else {
      setQuotes(storage.loadQuotes());
    }
  }, [apiAvailable]);

  const addQuote = useCallback((quote: Quote) => {
    applyAndSync(
      (prev) => [quote, ...prev],
      () => api.createQuote(quote)
    );
  }, [applyAndSync]);

  const updateQuote = useCallback((id: string, updated: Quote) => {
    applyAndSync(
      (prev) => prev.map((q) => q.id === id ? updated : q),
      () => api.updateQuote(id, updated)
    );
  }, [applyAndSync]);

  const deleteQuote = useCallback((id: string) => {
    applyAndSync(
      (prev) => prev.filter((q) => q.id !== id),
      () => api.deleteQuote(id)
    );
  }, [applyAndSync]);

  const getQuote = useCallback((id: string) => quotes.find((q) => q.id === id), [quotes]);

  return (
    <QuotesContext.Provider value={{ quotes, loading, addQuote, updateQuote, deleteQuote, getQuote, refresh }}>
      {children}
    </QuotesContext.Provider>
  );
}

export function useQuotes() {
  const ctx = useContext(QuotesContext);
  if (!ctx) throw new Error("useQuotes must be used within QuotesProvider");
  return ctx;
}
