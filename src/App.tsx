import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/hooks/useLanguage";
import { QuotesProvider } from "@/hooks/useQuotes";
import Header from "@/components/Header";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import QuotesList from "./pages/QuotesList";
import QuoteNew from "./pages/QuoteNew";
import QuoteEdit from "./pages/QuoteEdit";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
          <QuotesProvider>
            <Header />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/quotes" element={<QuotesList />} />
              <Route path="/quotes/new" element={<QuoteNew />} />
              <Route path="/quotes/:id" element={<QuoteEdit />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </QuotesProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
