import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { LanguageProvider } from "@/hooks/useLanguage";
import { QuotesProvider } from "@/hooks/useQuotes";
import { ClientsProvider } from "@/contexts/ClientsContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Header from "@/components/Header";
import BottomNav, { useIsAdminPage } from "@/components/BottomNav";
import InstallPrompt from "@/components/InstallPrompt";
import { UpdateBanner } from "@/components/UpdateBanner";
import PageTransition from "@/components/PageTransition";
import ScrollToTop from "@/components/ScrollToTop";
import CommandPalette from "@/components/CommandPalette";
import { ProjectMeetingNotes } from "@/components/ProjectMeetingNotes";
import { FocusRetroPrompt } from "@/components/objective/FocusRetroPrompt";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import QuotesList from "./pages/QuotesList";
import QuoteNew from "./pages/QuoteNew";
import QuoteEdit from "./pages/QuoteEdit";
import QuotePrintPage from "./pages/QuotePrintPage";
import Dashboard from "./pages/Dashboard";
import KojimaSpace from "./pages/KojimaSpace";
import ProjectDetails from "./pages/ProjectDetails";
import ProjectTasks from "./pages/ProjectTasks";
import ProjectSteps from "./pages/ProjectSteps";
import ClientDashboard from "./pages/ClientDashboard";
import ProjectDocuments from "./pages/ProjectDocuments";
import ClientsManager from "./pages/ClientsManager";
import Accounting from "./pages/Accounting";
import Tresorerie from "./pages/Tresorerie";
import AdminSpace from "./pages/AdminSpace";
import SettingsPage from "./pages/SettingsPage";
import ObjectiveWorkspace from "./pages/ObjectiveWorkspace";
import SprintPage from "./pages/SprintPage";

import SharedFolder from "./pages/SharedFolder";
import ProjectFunnel from "./pages/ProjectFunnel";
import ProjectBrief from "./pages/ProjectBrief";
import ProjectCadrage from "./pages/ProjectCadrage";
import ProjectModules from "./pages/ProjectModules";


import IntakeForm from "./pages/IntakeForm";
import ClientProposal from "./pages/ClientProposal";
import FunnelPrintPage from "./pages/FunnelPrintPage";
import FunnelStakeholderView from "./pages/FunnelStakeholderView";
import StakeholderView from "./pages/StakeholderView";
import ClientLogin from "./pages/ClientLogin";
import Portfolio from "./pages/Portfolio";
import GateDecisionPage from "./pages/GateDecisionPage";
import FeedbackDecisionPage from "./pages/FeedbackDecisionPage";
const queryClient = new QueryClient();

function AdminContentWrapper({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsAdminPage();
  return (
    <div className={`pt-16 pb-safe-bottom ${isAdmin ? "md:pl-16" : ""}`}>
      {children}
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <QuotesProvider>
              <ClientsProvider>
                <CompanySettingsProvider>
                <ProjectsProvider>
                  <Header />
                  <BottomNav />
                  <InstallPrompt />
                  <UpdateBanner />
                  <ScrollToTop />
                  <CommandPalette />
                  <ProjectMeetingNotes />
                  <FocusRetroPrompt />
                  <AdminContentWrapper>
                    <PageTransition>
                    <Routes>
                      {/* Public routes */}
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/client/login" element={<ClientLogin />} />
                      <Route path="/client/:id" element={<ClientDashboard />} />
                      <Route path="/quotes/:id/print" element={<QuotePrintPage />} />

                      <Route path="/shared/folder/:token" element={<SharedFolder />} />
                      <Route path="/portfolio" element={<Portfolio />} />
                      <Route path="/intake" element={<IntakeForm />} />
                      <Route path="/client/:id/proposal" element={<ClientProposal />} />
                      <Route path="/funnel/:id/print" element={<FunnelPrintPage />} />
                      <Route path="/project/s/:token" element={<StakeholderView />} />
                      <Route path="/funnel/:id/view" element={<FunnelStakeholderView />} />
                      <Route path="/funnel/s/:token" element={<FunnelStakeholderView />} />
                      <Route path="/client/:id/decision/:gateId" element={<GateDecisionPage />} />
                      <Route path="/funnel/s/:token/decision/:gateId" element={<GateDecisionPage />} />
                      <Route path="/client/:id/feedback/:taskId/:requestId" element={<FeedbackDecisionPage />} />

                      {/* Protected admin routes */}
                      <Route path="/space" element={<ProtectedRoute><KojimaSpace /></ProtectedRoute>} />
                      <Route path="/quotes" element={<ProtectedRoute><QuotesList /></ProtectedRoute>} />
                      <Route path="/quotes/new" element={<ProtectedRoute><QuoteNew /></ProtectedRoute>} />
                      <Route path="/quotes/:id" element={<ProtectedRoute><QuoteEdit /></ProtectedRoute>} />
                      <Route path="/projects" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                      {/* New project workflow routes */}
                      <Route path="/project/:id/brief" element={<ProtectedRoute><ProjectBrief /></ProtectedRoute>} />
                      <Route path="/project/:id/cadrage" element={<ProtectedRoute><ProjectCadrage /></ProtectedRoute>} />
                      <Route path="/project/:id/modules" element={<ProtectedRoute><ProjectModules /></ProtectedRoute>} />
                      <Route path="/project/:id/etapes" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/documents" element={<ProtectedRoute><ProjectDocuments /></ProtectedRoute>} />
                      {/* Legacy redirects */}
                      <Route path="/project/:id/planning" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/suivi" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/details" element={<ProtectedRoute><ProjectBrief /></ProtectedRoute>} />
                      <Route path="/project/:id/tasks" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/decisions" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/roadmap" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/funnel" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/feedback" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/quotes" element={<ProtectedRoute><ProjectDocuments /></ProtectedRoute>} />
                      <Route path="/project/:id/invoice" element={<ProtectedRoute><ProjectDocuments /></ProtectedRoute>} />
                      <Route path="/clients" element={<ProtectedRoute><ClientsManager /></ProtectedRoute>} />
                      <Route path="/accounting" element={<ProtectedRoute><Accounting /></ProtectedRoute>} />
                      <Route path="/personal"   element={<Navigate to="/tresorerie" replace />} />
                      <Route path="/admin"      element={<Navigate to="/documents" replace />} />
                      <Route path="/tresorerie" element={<ProtectedRoute><Tresorerie /></ProtectedRoute>} />
                      <Route path="/documents"  element={<ProtectedRoute><AdminSpace /></ProtectedRoute>} />
                      <Route path="/settings"   element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
                      <Route path="/objective/:source/:id" element={<ProtectedRoute><ObjectiveWorkspace /></ProtectedRoute>} />
                      <Route path="/sprint"     element={<ProtectedRoute><SprintPage /></ProtectedRoute>} />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                    </PageTransition>
                  </AdminContentWrapper>
                </ProjectsProvider>
                </CompanySettingsProvider>
              </ClientsProvider>
            </QuotesProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
