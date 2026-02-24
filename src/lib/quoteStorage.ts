import type { Quote } from "@/types/quote";

const STORAGE_KEY = "kojima-quotes";

export function loadQuotes(): Quote[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Quote[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveQuotes(quotes: Quote[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
}

export function addQuote(quote: Quote): void {
  const quotes = loadQuotes();
  quotes.unshift(quote);
  saveQuotes(quotes);
}

export function updateQuote(id: string, updated: Quote): void {
  const quotes = loadQuotes();
  const idx = quotes.findIndex((q) => q.id === id);
  if (idx === -1) return;
  quotes[idx] = updated;
  saveQuotes(quotes);
}

export function deleteQuote(id: string): void {
  const quotes = loadQuotes().filter((q) => q.id !== id);
  saveQuotes(quotes);
}

export function getQuoteById(id: string): Quote | undefined {
  return loadQuotes().find((q) => q.id === id);
}
