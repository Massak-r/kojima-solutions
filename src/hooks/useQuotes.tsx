import { useCallback, type ReactNode } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import type { Quote } from "@/types/quote";
import * as api from "@/api/quotes";

const QUOTES_KEY = ["quotes"] as const;

interface QuotesContextType {
  quotes: Quote[];
  loading: boolean;
  addQuote: (quote: Quote) => void;
  updateQuote: (id: string, quote: Quote) => void;
  deleteQuote: (id: string) => void;
  getQuote: (id: string) => Quote | undefined;
  refresh: () => void;
}

// Provider is now a no-op pass-through. Cache lives in react-query
// (QueryClientProvider in App.tsx); `useQuotes()` reads it directly.
export function QuotesProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

function notifyError(label: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err ?? "Erreur inconnue");
  toast({ title: label, description: message.slice(0, 240), variant: "destructive" });
}

function setCache(qc: QueryClient, updater: (prev: Quote[]) => Quote[]) {
  qc.setQueryData<Quote[]>(QUOTES_KEY, (prev) => updater(prev ?? []));
}

function snapshot(qc: QueryClient): Quote[] {
  return qc.getQueryData<Quote[]>(QUOTES_KEY) ?? [];
}

export function useQuotes(): QuotesContextType {
  const qc = useQueryClient();
  const { data: quotes = [], isLoading, refetch } = useQuery({
    queryKey: QUOTES_KEY,
    queryFn: () => api.listQuotes(),
    staleTime: 30_000,
  });

  const addQuote = useCallback((quote: Quote) => {
    const before = snapshot(qc);
    setCache(qc, (prev) => [quote, ...prev]);
    api.createQuote(quote)
      .then(() => qc.invalidateQueries({ queryKey: QUOTES_KEY }))
      .catch((err) => {
        qc.setQueryData(QUOTES_KEY, before);
        notifyError("Création devis échouée", err);
      });
  }, [qc]);

  const updateQuote = useCallback((id: string, updated: Quote) => {
    const before = snapshot(qc);
    setCache(qc, (prev) => prev.map((q) => (q.id === id ? updated : q)));
    api.updateQuote(id, updated)
      .then(() => qc.invalidateQueries({ queryKey: QUOTES_KEY }))
      .catch((err) => {
        qc.setQueryData(QUOTES_KEY, before);
        notifyError("Mise à jour devis échouée", err);
      });
  }, [qc]);

  const deleteQuote = useCallback((id: string) => {
    const before = snapshot(qc);
    setCache(qc, (prev) => prev.filter((q) => q.id !== id));
    api.deleteQuote(id)
      .then(() => qc.invalidateQueries({ queryKey: QUOTES_KEY }))
      .catch((err) => {
        qc.setQueryData(QUOTES_KEY, before);
        notifyError("Suppression devis échouée", err);
      });
  }, [qc]);

  const getQuote = useCallback(
    (id: string) => quotes.find((q) => q.id === id),
    [quotes],
  );

  const refresh = useCallback(() => {
    void refetch();
  }, [refetch]);

  return { quotes, loading: isLoading, addQuote, updateQuote, deleteQuote, getQuote, refresh };
}
