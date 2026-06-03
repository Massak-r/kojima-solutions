import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { LanguageProvider } from "@/hooks/useLanguage";
import { QuotesProvider } from "@/hooks/useQuotes";
import { ClientsProvider } from "@/contexts/ClientsContext";
import { ProjectsProvider } from "@/contexts/ProjectsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CompanySettingsProvider } from "@/contexts/CompanySettingsContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Header from "@/components/Header";
import BottomNav, { useIsAdminPage } from "@/components/BottomNav";
import { QuickActionFAB } from "@/components/QuickActionFAB";
import InstallPrompt from "@/components/InstallPrompt";
import { UpdateBanner } from "@/components/UpdateBanner";
import PageTransition from "@/components/PageTransition";
import ScrollToTop from "@/components/ScrollToTop";
import CommandPalette from "@/components/CommandPalette";
import { ProjectMeetingNotes } from "@/components/ProjectMeetingNotes";
import { FocusRetroPrompt } from "@/components/objective/FocusRetroPrompt";
import { SprintCapProvider } from "@/components/sprint/SprintCapProvider";
import { SprintCapOverloadDialog } from "@/components/sprint/SprintCapOverloadDialog";
import { QuickCreateProvider } from "@/contexts/QuickCreateContext";
import { NextActionDialog } from "@/components/now/NextActionDialog";

// Eager: small entry-point routes the user hits first.
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./pages/LoginPage";
import ClientLogin from "./pages/ClientLogin";

// Lazy: every heavy page. The Suspense boundary below provides the fallback.
// Ordered roughly by surface so the diff stays scannable.
const QuotesList            = lazy(() => import("./pages/QuotesList"));
const QuoteNew              = lazy(() => import("./pages/QuoteNew"));
const QuoteEdit             = lazy(() => import("./pages/QuoteEdit"));
const QuotePrintPage        = lazy(() => import("./pages/QuotePrintPage"));
const Home                  = lazy(() => import("./pages/Home"));
const ProjectSteps          = lazy(() => import("./pages/ProjectSteps"));
const ClientDashboard       = lazy(() => import("./pages/ClientDashboard"));
const ProjectDocuments      = lazy(() => import("./pages/ProjectDocuments"));
const ClientsManager        = lazy(() => import("./pages/ClientsManager"));
const ClientDetail          = lazy(() => import("./pages/ClientDetail"));
const Accounting            = lazy(() => import("./pages/Accounting"));
const Cockpit               = lazy(() => import("./pages/Cockpit"));
const Tresorerie            = lazy(() => import("./pages/Tresorerie"));
const AdminSpace            = lazy(() => import("./pages/AdminSpace"));
const SettingsPage          = lazy(() => import("./pages/SettingsPage"));
const ObjectiveWorkspace    = lazy(() => import("./pages/ObjectiveWorkspace"));
const SprintPage            = lazy(() => import("./pages/SprintPage"));
const SharedFolder          = lazy(() => import("./pages/SharedFolder"));
const ProjectBrief          = lazy(() => import("./pages/ProjectBrief"));
const ProjectCadrage        = lazy(() => import("./pages/ProjectCadrage"));
const ProjectModules        = lazy(() => import("./pages/ProjectModules"));
const ProjectDeliverables   = lazy(() => import("./pages/ProjectDeliverables"));
const IntakeForm            = lazy(() => import("./pages/IntakeForm"));
const ClientProposal        = lazy(() => import("./pages/ClientProposal"));
const FunnelPrintPage       = lazy(() => import("./pages/FunnelPrintPage"));
const FunnelStakeholderView = lazy(() => import("./pages/FunnelStakeholderView"));
const StakeholderView       = lazy(() => import("./pages/StakeholderView"));
const Portfolio             = lazy(() => import("./pages/Portfolio"));
const GateDecisionPage      = lazy(() => import("./pages/GateDecisionPage"));
const FeedbackDecisionPage  = lazy(() => import("./pages/FeedbackDecisionPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

function AdminContentWrapper({ children }: { children: React.ReactNode }) {
  const isAdmin = useIsAdminPage();
  return (
    <div className={`pt-16 pb-safe-bottom ${isAdmin ? "md:pl-16" : ""}`}>
      {children}
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
                <SprintCapProvider>
                <QuickCreateProvider>
                  <Header />
                  <BottomNav />
                  <QuickActionFAB />
                  <NextActionDialog />
                  <InstallPrompt />
                  <UpdateBanner />
                  <ScrollToTop />
                  <CommandPalette />
                  <ProjectMeetingNotes />
                  <FocusRetroPrompt />
                  <SprintCapOverloadDialog />
                  <AdminContentWrapper>
                    <PageTransition>
                    <Suspense fallback={<RouteFallback />}>
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
                      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                      <Route path="/cockpit" element={<ProtectedRoute><Cockpit /></ProtectedRoute>} />
                      <Route path="/space" element={<Navigate to="/home" replace />} />
                      <Route path="/space-full" element={<Navigate to="/home?tab=objectives" replace />} />
                      <Route path="/quotes" element={<ProtectedRoute><QuotesList /></ProtectedRoute>} />
                      <Route path="/quotes/new" element={<ProtectedRoute><QuoteNew /></ProtectedRoute>} />
                      <Route path="/quotes/:id" element={<ProtectedRoute><QuoteEdit /></ProtectedRoute>} />
                      <Route path="/projects" element={<Navigate to="/home?tab=kanban" replace />} />
                      <Route path="/projects-board" element={<Navigate to="/home?tab=kanban" replace />} />
                      {/* Project workflow routes */}
                      <Route path="/project/:id/brief" element={<ProtectedRoute><ProjectBrief /></ProtectedRoute>} />
                      <Route path="/project/:id/cadrage" element={<ProtectedRoute><ProjectCadrage /></ProtectedRoute>} />
                      <Route path="/project/:id/modules" element={<ProtectedRoute><ProjectModules /></ProtectedRoute>} />
                      <Route path="/project/:id/etapes" element={<ProtectedRoute><ProjectSteps /></ProtectedRoute>} />
                      <Route path="/project/:id/livrables" element={<ProtectedRoute><ProjectDeliverables /></ProtectedRoute>} />
                      <Route path="/project/:id/documents" element={<ProtectedRoute><ProjectDocuments /></ProtectedRoute>} />
                      <Route path="/clients" element={<ProtectedRoute><ClientsManager /></ProtectedRoute>} />
                      <Route path="/clients/:id" element={<ProtectedRoute><ClientDetail /></ProtectedRoute>} />
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
                    </Suspense>
                    </PageTransition>
                  </AdminContentWrapper>
                </QuickCreateProvider>
                </SprintCapProvider>
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
