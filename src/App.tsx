import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { LanguageProvider } from "@/hooks/useLanguage";
import { QuotesProvider } from "@/hooks/useQuotes";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import Header from "@/components/Header";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import QuotesList from "./pages/QuotesList";
import QuoteNew from "./pages/QuoteNew";
import QuoteEdit from "./pages/QuoteEdit";
import Dashboard from "./pages/Dashboard";
import ProjectDetails from "./pages/ProjectDetails";
import ProjectFeedback from "./pages/ProjectFeedback";
import ProjectOverview from "./pages/ProjectOverview";
import ProjectRoadmap from "./pages/ProjectRoadmap";
import ClientDashboard from "./pages/ClientDashboard";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LanguageProvider>
          <QuotesProvider>
            <ProjectsProvider>
              <Header />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/quotes" element={<QuotesList />} />
                <Route path="/quotes/new" element={<QuoteNew />} />
                <Route path="/quotes/:id" element={<QuoteEdit />} />
                <Route path="/projects" element={<Dashboard />} />
                <Route path="/project/:id/details" element={<ProjectDetails />} />
                <Route path="/project/:id/roadmap" element={<ProjectRoadmap />} />
                <Route path="/project/:id/overview" element={<ProjectOverview />} />
                <Route path="/project/:id/feedback" element={<ProjectFeedback />} />
                <Route path="/client/:id" element={<ClientDashboard />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ProjectsProvider>
          </QuotesProvider>
        </LanguageProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
