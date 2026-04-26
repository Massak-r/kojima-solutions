import { useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle, CheckCircle2, Circle, ChevronDown, ChevronUp,
  CalendarDays, User, FileText, Upload, Vote, Package,
  FileDown, Loader2, MessageSquare, ArrowRight,
} from "lucide-react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { getClientAuth, setClientAuth } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichText } from "@/components/RichText";
import { useToast } from "@/hooks/use-toast";
import type { Delivery } from "@/types/project";
import { cn } from "@/lib/utils";
import { printViaIframe } from "@/lib/printUtils";
import { listProjectQuotes, updateQuote } from "@/api/quotes";
import { totalQuote, type Quote } from "@/types/quote";
import { getCadrage, type Cadrage } from "@/api/cadrage";

import { COLOR_MAP, STATUS_BADGE, INVOICE_STATUS } from "@/components/clientDashboard/statusMaps";
import { WelcomeOnboarding } from "@/components/clientDashboard/WelcomeOnboarding";
import { ImageLightbox, DeliveryCard } from "@/components/clientDashboard/DeliveryComponents";
import { BlockingRequestCard } from "@/components/clientDashboard/FeedbackCards";
import { StakeholderShareCard } from "@/components/clientDashboard/StakeholderShareCard";

export default function ClientDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, respondToFeedbackRequest, toggleStakeholderHighlight, loading: projectsLoading } = useProjects();
  const { clients, loading: clientsLoading } = useClients();
  const { toast } = useToast();
  const project = getProject(id!);

  // ── Email gate ─────────────────────────────────────────────
  const requiredEmail = project?.clientId
    ? clients.find((c) => c.id === project.clientId)?.email?.toLowerCase() ?? null
    : null;

  // null = not yet evaluated (waiting for async data to load)
  const [emailAuthed, setEmailAuthed] = useState<boolean | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailInput.trim().toLowerCase() === requiredEmail) {
      setClientAuth(id!, emailInput.trim());
      setEmailAuthed(true);
    } else {
      setEmailError("Email non reconnu pour ce projet.");
    }
  }

  // Evaluate the gate once clients have finished loading
  useEffect(() => {
    if (clientsLoading) return; // wait — clients array may still be empty
    if (!requiredEmail) { setEmailAuthed(true); return; }
    setEmailAuthed(getClientAuth(id!) === requiredEmail);
  }, [requiredEmail, id, clientsLoading]);

  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [projectQuotes, setProjectQuotes] = useState<Quote[]>([]);
  const [welcomed, setWelcomed] = useState(() => {
    try { return localStorage.getItem(`kojima-client-welcomed-${id}`) === "1"; } catch { return false; }
  });
  const [lightbox, setLightbox] = useState<{ delivery: Delivery; index: number } | null>(null);
  const [cadrage, setCadrage] = useState<Cadrage | null>(null);
  const [ficheOpen, setFicheOpen] = useState(false);

  // Load cadrage data
  useEffect(() => {
    if (!project?.id) return;
    getCadrage(project.id).then(setCadrage).catch(() => {});
  }, [project?.id]);

  // Load project-specific quotes from DB
  useEffect(() => {
    if (!project?.id) return;
    listProjectQuotes(project.id)
      .then(setProjectQuotes)
      .catch(() => { /* silently ignore — no invoices shown */ });
  }, [project?.id]);

  const toggleStep = (taskId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  async function handleApproveQuote(quoteId: string) {
    try {
      await updateQuote(quoteId, { invoiceStatus: "validated" });
      setProjectQuotes((prev) => prev.map((q) => q.id === quoteId ? { ...q, invoiceStatus: "validated" } : q));
      toast({ title: "Devis accepté ✓", description: "Merci pour votre validation." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de valider le devis.", variant: "destructive" });
    }
  }

  const handleRespond = useCallback((taskId: string, requestId: string, response: string) => {
    respondToFeedbackRequest(id!, taskId, requestId, response);

    if (response === "approved" || response.startsWith("approved\n")) {
      toast({ title: "Approbation confirmee", description: "L'equipe peut maintenant passer a la suite." });
    } else if (response.startsWith("changes:")) {
      toast({ title: "Demande de modifications envoyee", description: "L'equipe va traiter vos retours sous 48h." });
    } else {
      toast({ title: "Reponse enregistree", description: "Merci pour votre retour !" });
    }
  }, [id, respondToFeedbackRequest, toast]);

  // Show spinner while projects/clients are loading OR while auth hasn't been evaluated yet
  if (projectsLoading || clientsLoading || emailAuthed === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <FileText size={24} className="text-muted-foreground" />
          </div>
          <p className="font-display text-xl text-foreground font-bold mb-2">Projet introuvable</p>
          <p className="font-body text-sm text-muted-foreground">Ce lien est peut-être invalide ou le projet a été supprimé.</p>
        </div>
      </div>
    );
  }

  // Email gate screen
  if (!emailAuthed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 mb-4">
              <User size={22} className="text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              {project.title}
            </h1>
            <p className="font-body text-sm text-muted-foreground mt-1">Entrez votre email pour accéder à ce projet</p>
          </div>
          <form
            onSubmit={handleEmailSubmit}
            className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4"
          >
            <Input
              type="email"
              placeholder="votre@email.com"
              value={emailInput}
              onChange={(e) => { setEmailInput(e.target.value); setEmailError(""); }}
              className="font-body"
              autoFocus
            />
            {emailError && (
              <p className="font-body text-sm text-destructive">{emailError}</p>
            )}
            <Button type="submit" className="w-full font-body">
              Continuer
            </Button>
            <a
              href="/client/login"
              className="block text-center text-xs text-muted-foreground hover:text-primary transition-colors mt-2"
            >
              Accéder à tous vos projets →
            </a>
          </form>
        </div>
      </div>
    );
  }

  function dismissWelcome() {
    setWelcomed(true);
    try { localStorage.setItem(`kojima-client-welcomed-${id}`, "1"); } catch {}
  }

  const sorted = [...project.tasks].sort((a, b) => a.order - b.order);

  // ── Welcome onboarding (first visit) ──
  if (!welcomed) {
    return <WelcomeOnboarding
      clientName={project.client}
      projectTitle={project.title}
      onDismiss={dismissWelcome}
    />;
  }

  // ── Per-task completion score (0–1): completed flag OR subtask ratio ──
  const completedTaskScore = sorted.reduce((sum, t) => {
    if (t.completed) return sum + 1;
    const subs = t.subtasks || [];
    if (subs.length === 0) return sum; // no subtasks, not marked done → 0
    return sum + (subs.filter((s) => s.completed).length / subs.length);
  }, 0);
  const overallProgress = sorted.length > 0
    ? Math.round((completedTaskScore / sorted.length) * 100)
    : 0;

  const blockingRequests = sorted.flatMap((task, i) =>
    (task.feedbackRequests || [])
      .filter((r) => !r.resolved)
      .map((r) => ({ request: r, task, stepNumber: i + 1 }))
  );

  const statusBadge = STATUS_BADGE[project.status];

  const allDeliveries   = project.deliveries ?? [];
  const finalDeliveries = allDeliveries.filter((d) => !d.taskId);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Image Lightbox ── */}
      {lightbox && (
        <ImageLightbox
          delivery={lightbox.delivery}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* ── Top bar + progress strip ── */}
      <div className="bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="font-display font-bold text-lg tracking-tight">
            Kojima<span className="opacity-50">.</span>Solutions
          </span>
          <span className="font-body text-xs text-primary-foreground/50 uppercase tracking-widest">Espace client</span>
        </div>
        <div className="h-1 bg-primary-foreground/10">
          <div className="h-full bg-primary-foreground/60 transition-all duration-700" style={{ width: `${overallProgress}%` }} />
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8" style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}>

        {/* ── Ball-in-court banner (always visible) ── */}
        {(() => {
          const totalPending = blockingRequests.length;
          const isClientTurn = totalPending > 0;

          // Find the most urgent blocking request for display
          const urgentRequest = blockingRequests.length > 0
            ? [...blockingRequests].sort((a, b) => {
                const dA = a.request.deadline;
                const dB = b.request.deadline;
                if (!dA && !dB) return 0;
                if (!dA) return 1;
                if (!dB) return -1;
                return new Date(dA).getTime() - new Date(dB).getTime();
              })[0]
            : null;

          const deadlineDays = urgentRequest?.request.deadline
            ? Math.ceil((new Date(urgentRequest.request.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;
          const isOverdue = deadlineDays !== null && deadlineDays < 0;
          const isUrgent = deadlineDays !== null && deadlineDays <= 3 && deadlineDays >= 0;

          if (isClientTurn) {
            return (
              <section>
                <div className={cn(
                  "rounded-xl px-4 py-4 border",
                  isOverdue ? "bg-red-50 border-red-200/50" :
                  isUrgent ? "bg-amber-50 border-amber-200/50" :
                  "bg-blue-50 border-blue-200/50",
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                      isOverdue ? "bg-red-100" : isUrgent ? "bg-amber-100" : "bg-blue-100",
                    )}>
                      <AlertTriangle size={18} className={cn(
                        isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-blue-600",
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-display font-bold", isOverdue ? "text-red-800" : isUrgent ? "text-amber-800" : "text-blue-800")}>
                        Votre tour : {totalPending} {totalPending > 1 ? "actions en attente" : "action en attente"}
                      </p>
                      <p className="text-xs font-body text-muted-foreground truncate mt-0.5">
                        {urgentRequest ? urgentRequest.request.message : ""}
                      </p>
                      {isOverdue && (
                        <p className="text-[10px] font-body text-red-600/80 mt-0.5">
                          Votre retour est en retard — le projet est en pause jusqu'a votre reponse.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            );
          }

          // Agency's turn (green)
          const currentOpen = sorted.find((t) => t.status === "open" &&
            (!t.feedbackRequests || t.feedbackRequests.every((r) => r.resolved)));
          const nextLockedStep = sorted.find((t) => t.status === "locked");
          let agencyMsg = "L'equipe avance sur les prochaines etapes.";
          if (currentOpen) agencyMsg = `Nous travaillons sur : ${currentOpen.title}`;
          else if (nextLockedStep) agencyMsg = `Prochaine etape : ${nextLockedStep.title}`;

          return (
            <section>
              <div className="rounded-xl px-4 py-4 border bg-emerald-50 border-emerald-200/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-100">
                    <CheckCircle2 size={18} className="text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-display font-bold text-emerald-800">
                      Notre tour : nous travaillons sur votre projet
                    </p>
                    <p className="text-xs font-body text-emerald-700/60 mt-0.5">
                      {agencyMsg}
                    </p>
                    <p className="text-[10px] font-body text-emerald-600/40 mt-0.5">
                      Nous vous contacterons des que votre avis sera necessaire.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          );
        })()}

        {/* ── Section B: Project Overview ── */}
        <section className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-foreground mb-1">{project.title}</h1>
              {project.client && (
                <div className="flex items-center gap-1.5 font-body text-sm text-muted-foreground mb-2">
                  <User size={13} /> <span>{project.client}</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn("text-xs gap-1", statusBadge.className)}>{statusBadge.label}</Badge>
                {(project.startDate || project.endDate) && (
                  <span className="font-body text-xs text-muted-foreground flex items-center gap-1">
                    <CalendarDays size={11} />
                    {project.startDate && new Date(project.startDate).toLocaleDateString()}
                    {project.startDate && project.endDate && " → "}
                    {project.endDate && new Date(project.endDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {sorted.length > 0 && (
              <div className="text-right shrink-0">
                <p className="font-display text-4xl font-bold text-primary leading-none">
                  {overallProgress}<span className="text-lg text-muted-foreground">%</span>
                </p>
                <p className="font-body text-xs text-muted-foreground mt-1">terminé</p>
              </div>
            )}
          </div>

          {/* Project description */}
          {project.description && (
            <div className="mb-4">
              <RichText text={project.description} className="font-body text-sm text-foreground/70" />
            </div>
          )}

          {/* Overall progress bar */}
          {sorted.length > 0 && (
            <div>
              <div className="flex justify-between mb-2">
                <span className="font-body text-xs text-muted-foreground">Avancement global</span>
                <span className="font-body text-xs text-muted-foreground">
                  {Math.round(completedTaskScore)}/{sorted.length} étapes
                </span>
              </div>
              <Progress value={overallProgress} className="h-2" />
            </div>
          )}
        </section>

        {/* ── Fiche projet (description + cadrage) ── */}
        {(project.description || cadrage) && (
          <section>
            <button
              onClick={() => setFicheOpen(!ficheOpen)}
              className="w-full flex items-center justify-between py-2 group"
            >
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <FileText size={12} />
                Fiche projet
              </h2>
              <ChevronDown size={14} className={cn(
                "text-muted-foreground/40 transition-transform",
                ficheOpen && "rotate-180"
              )} />
            </button>
            {ficheOpen && (
              <div className="bg-card border border-border rounded-xl p-4 space-y-4 mt-1">
                {project.description && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Description</p>
                    <RichText text={project.description} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.objectives && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Objectifs</p>
                    <RichText text={cadrage.objectives} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.inScope && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Perimetre</p>
                    <RichText text={cadrage.inScope} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.outScope && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Hors perimetre</p>
                    <RichText text={cadrage.outScope} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.deliverables && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Livrables</p>
                    <RichText text={cadrage.deliverables} className="text-foreground/70 text-xs" />
                  </div>
                )}
                {cadrage?.constraints && (
                  <div>
                    <p className="font-display text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Contraintes</p>
                    <RichText text={cadrage.constraints} className="text-foreground/70 text-xs" />
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Unified Action Cards (pending feedback requests) ── */}
        {(() => {
          if (blockingRequests.length === 0) {
            return (
              <section>
                <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                  Vos actions
                </h2>
                <div className="bg-emerald-50/50 border border-emerald-200/30 rounded-xl p-5 text-center space-y-2">
                  <CheckCircle2 size={24} className="text-emerald-500 mx-auto" />
                  <p className="font-display text-sm font-semibold text-emerald-800">
                    Vous etes a jour !
                  </p>
                  <p className="font-body text-xs text-emerald-600/70">
                    Aucune action en attente. Nous vous notifierons des que votre retour sera necessaire.
                  </p>
                </div>
              </section>
            );
          }

          return (
            <section>
              <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
                Vos actions
              </h2>
              <div className="space-y-3">
                {/* Feedback request action cards */}
                {blockingRequests.map(({ request, task, stepNumber }) => {
                  const typeLabel = request.type === "validation" ? "APPROBATION"
                    : request.type === "vote" ? "CHOIX"
                    : request.type === "file" ? "FICHIER" : "RETOUR";
                  const typeColor = request.type === "validation" ? "text-primary bg-primary/10 border-primary/30"
                    : request.type === "vote" ? "text-palette-violet bg-palette-violet/10 border-palette-violet/30"
                    : "text-palette-amber bg-palette-amber/10 border-palette-amber/30";

                  return (
                    <div key={request.id} className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                          request.type === "validation" ? "bg-primary/10" :
                          request.type === "vote" ? "bg-palette-violet/10" : "bg-palette-amber/10",
                        )}>
                          {request.type === "validation" ? <CheckCircle2 size={16} className="text-primary" /> :
                           request.type === "vote" ? <Vote size={16} className="text-palette-violet" /> :
                           request.type === "file" ? <Upload size={16} className="text-palette-amber" /> :
                           <MessageSquare size={16} className="text-palette-amber" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Badge variant="outline" className={cn("text-[9px] font-semibold", typeColor)}>{typeLabel}</Badge>
                            <span className="text-[10px] font-body text-muted-foreground">Étape {stepNumber} · {task.title}</span>
                          </div>
                          <p className="font-display text-sm font-semibold text-foreground">{request.message}</p>
                          {/* Deadline impact context */}
                          {request.deadline && (() => {
                            const days = Math.ceil((new Date(request.deadline).getTime() - Date.now()) / 86400000);
                            if (days < 0) return (
                              <p className="text-[10px] font-body text-red-600 mt-1">
                                En retard — le projet est en pause en attendant votre retour.
                              </p>
                            );
                            if (days <= 3) return (
                              <p className="text-[10px] font-body text-amber-600 mt-1">
                                Echeance {days === 0 ? "aujourd'hui" : `dans ${days}j`} — merci de repondre rapidement pour eviter un retard.
                              </p>
                            );
                            return null;
                          })()}
                        </div>
                        <button
                          onClick={() => {
                            if (request.type === "vote" && (request.options?.length ?? 0) >= 2) {
                              navigate(`/client/${project.id}/feedback/${task.id}/${request.id}`);
                            } else {
                              setExpandedSteps((prev) => { const next = new Set(prev); next.add(task.id); return next; });
                              setTimeout(() => document.getElementById(`step-${task.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
                            }
                          }}
                          className="shrink-0 text-[11px] font-body font-semibold text-primary bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 hover:bg-primary/20 transition-colors flex items-center gap-1"
                        >
                          {request.type === "vote" ? "Comparer" : "Répondre"} <ArrowRight size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* ── Stakeholder share card ── */}
        {project.shareToken && (
          <StakeholderShareCard shareToken={project.shareToken} />
        )}

        {/* ── Task Timeline ── */}
        {sorted.length > 0 && (
          <section>
            <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Avancement du projet
            </h2>

            <div className="relative space-y-3">
              {/* Vertical connector line */}
              {sorted.length > 1 && (
                <div className="absolute left-[31px] top-10 bottom-10 w-0.5 bg-border/60 rounded-full pointer-events-none z-0" />
              )}
              {sorted.map((task, i) => {
                const subtasks         = task.subtasks || [];
                const completedCount   = subtasks.filter((s) => s.completed).length;
                const progress         = task.completed ? 100 : (subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0);
                const isExpanded       = expandedSteps.has(task.id);
                const resolvedRequests = (task.feedbackRequests || []).filter((r) => r.resolved);
                const pendingFeedback  = (task.feedbackRequests || []).filter((r) => !r.resolved);
                const pendingCount     = pendingFeedback.length;
                const isComplete       = task.completed || (subtasks.length > 0 && completedCount === subtasks.length);
                const isBlocking       = pendingCount > 0;

                // Always show inline feedback in unified timeline
                const showInlineFeedback = true;

                const isLocked = task.status === "locked";

                return (
                  <div key={task.id} id={`step-${task.id}`} className={cn(
                    "relative z-10 bg-card border rounded-xl overflow-hidden ring-2 transition-shadow",
                    isLocked && "opacity-60",
                    isBlocking && showInlineFeedback ? "ring-palette-amber/30 border-palette-amber/20" : "ring-transparent border-border"
                  )}>
                    <button
                      onClick={() => !isLocked && toggleStep(task.id)}
                      className={cn(
                        "w-full text-left p-4 flex items-center gap-3 transition-colors",
                        isLocked ? "cursor-default" : "hover:bg-secondary/20"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                        isLocked ? "bg-gray-300 text-gray-500" :
                        isComplete ? "bg-emerald-500 text-white" :
                        cn(COLOR_MAP[task.color || "primary"], "text-white")
                      )}>
                        {isComplete ? <CheckCircle2 size={14} /> : String(i + 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-sm font-semibold text-foreground truncate">{task.title}</h3>
                          <div className="flex items-center gap-2 shrink-0">
                            {isBlocking && showInlineFeedback && (
                              <Badge variant="outline" className="text-[10px] bg-palette-amber/10 text-palette-amber border-palette-amber/30">Action requise</Badge>
                            )}
                            {isComplete && !(isBlocking && showInlineFeedback) && (
                              <Badge variant="outline" className="text-[10px] bg-palette-sage/10 text-palette-sage border-palette-sage/30">Terminé</Badge>
                            )}
                            <span className="font-body text-xs text-muted-foreground hidden sm:inline">{task.dateLabel}</span>
                            {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                          </div>
                        </div>
                        {/* Per-step progress bar */}
                        {(subtasks.length > 0 || task.completed) && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <Progress value={progress} className="h-1.5 flex-1" />
                            <span className="font-body text-[10px] text-muted-foreground whitespace-nowrap">
                              {task.completed ? "Fait" : `${completedCount}/${subtasks.length}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border">
                        {task.description && (
                          <div className="px-4 pt-3 pb-2">
                            <RichText text={task.description} className="text-foreground/70 text-xs" />
                          </div>
                        )}
                        {subtasks.length > 0 && (
                          <div className="px-4 py-3 space-y-2 border-t border-border/50">
                            <p className="font-display text-xs font-semibold text-muted-foreground">Livrables</p>
                            {subtasks.map((st) => (
                              <div key={st.id} className="flex items-center gap-2">
                                {st.completed
                                  ? <CheckCircle2 size={14} className="text-palette-sage flex-shrink-0" />
                                  : <Circle size={14} className="text-muted-foreground flex-shrink-0" />}
                                <span className={cn("font-body text-xs", st.completed ? "text-foreground/50 line-through" : "text-foreground")}>{st.title}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Step deliveries for this task */}
                        {(() => {
                          const stepDeliveries = allDeliveries.filter((d) => d.taskId === task.id);
                          return stepDeliveries.length > 0 ? (
                            <div className="px-4 py-3 space-y-2 border-t border-border/50">
                              <p className="font-display text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                                <Package size={11} className="text-palette-sage" /> Livrables de cette étape
                              </p>
                              <div className="grid gap-2 sm:grid-cols-2">
                                {stepDeliveries.map((d) => <DeliveryCard key={d.id} d={d} onLightbox={(i) => setLightbox({ delivery: d, index: i })} />)}
                              </div>
                            </div>
                          ) : null;
                        })()}

                        {/* Pending feedback requests (only shown inline when no funnel) */}
                        {showInlineFeedback && pendingFeedback.length > 0 && (
                          <div className="px-4 py-3 space-y-3 border-t border-palette-amber/20 bg-palette-amber/5">
                            <p className="font-display text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <AlertTriangle size={12} className="text-palette-amber" /> En attente de votre retour
                            </p>
                            {pendingFeedback.map((req) => (
                              <BlockingRequestCard
                                key={req.id}
                                request={req}
                                taskTitle={task.title}
                                taskId={task.id}
                                stepNumber={i + 1}
                                projectId={project.id}
                                onRespond={(r) => handleRespond(task.id, req.id, r)}
                                onToggleHighlight={() => toggleStakeholderHighlight(project.id, task.id, req.id)}
                              />
                            ))}
                          </div>
                        )}

                        {/* When funnel is active but there are pending feedback items, show a link to the action section */}
                        {!showInlineFeedback && pendingFeedback.length > 0 && (
                          <div className="px-4 py-3 border-t border-border/50">
                            <button
                              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                              className="font-body text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                              <AlertTriangle size={11} className="text-palette-amber" />
                              {pendingCount} action{pendingCount > 1 ? "s" : ""} en attente
                              <ArrowRight size={10} />
                            </button>
                          </div>
                        )}

                        {resolvedRequests.length > 0 && (
                          <div className="px-4 py-3 border-t border-border/50 space-y-1.5">
                            <p className="font-display text-xs font-semibold text-muted-foreground">Vos réponses</p>
                            {resolvedRequests.map((req) => (
                              <div key={req.id} className="flex items-start gap-2 text-xs font-body">
                                <CheckCircle2 size={13} className="text-palette-sage mt-0.5 shrink-0" />
                                <span className="text-foreground/70 flex-1">
                                  {req.message}: <em className="text-foreground">{req.response}</em>
                                  {req.respondedAt && (
                                    <span className="ml-2 text-[10px] text-muted-foreground/50 not-italic">
                                      {new Date(req.respondedAt).toLocaleDateString()}
                                    </span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Final Deliverables ── */}
        {finalDeliveries.length > 0 && (
          <section>
            <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <Package size={14} /> Livrables finaux
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {finalDeliveries.map((d: Delivery) => <DeliveryCard key={d.id} d={d} onLightbox={(i) => setLightbox({ delivery: d, index: i })} isFinal />)}
            </div>
          </section>
        )}

        {/* ── Invoices / Devis ── */}
        {projectQuotes.length > 0 && (
          <section>
            <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
              Devis / Factures
            </h2>
            {projectQuotes.some((q) => q.invoiceStatus === "to-validate") && (
              <div className="bg-palette-amber/10 border border-palette-amber/30 rounded-xl px-4 py-3 flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-palette-amber shrink-0" />
                <p className="font-body text-xs text-palette-amber font-medium">
                  Vous avez {projectQuotes.filter((q) => q.invoiceStatus === "to-validate").length} devis en attente de validation.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {projectQuotes.map((q) => (
                <div key={q.id} className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                  {/* Info row */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm font-semibold text-foreground truncate">
                        {q.quoteNumber || `Document #${q.id.slice(0, 8)}`}
                      </p>
                      <p className="font-body text-xs text-muted-foreground">
                        {q.createdAt ? new Date(q.createdAt).toLocaleDateString("fr-CH") : ""}
                        {q.clientName ? ` · ${q.clientName}` : ""}
                      </p>
                    </div>
                    {/* Price on mobile inline, hidden on desktop */}
                    <div className="text-right shrink-0 sm:hidden space-y-1">
                      <p className="font-display text-sm font-semibold text-foreground">
                        CHF {new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(totalQuote(q)).replace(/(?<=\d)[\s  ](?=\d)/g, "'")}
                      </p>
                      {q.invoiceStatus && INVOICE_STATUS[q.invoiceStatus] && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${INVOICE_STATUS[q.invoiceStatus].className}`}>
                          {INVOICE_STATUS[q.invoiceStatus].label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {/* Price + actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                    {/* Price on desktop */}
                    <div className="text-right shrink-0 hidden sm:block space-y-1">
                      <p className="font-display text-sm font-semibold text-foreground">
                        CHF {new Intl.NumberFormat("fr-CH", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(totalQuote(q)).replace(/(?<=\d)[\s  ](?=\d)/g, "'")}
                      </p>
                      {q.invoiceStatus && INVOICE_STATUS[q.invoiceStatus] && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${INVOICE_STATUS[q.invoiceStatus].className}`}>
                          {INVOICE_STATUS[q.invoiceStatus].label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1.5"
                        onClick={() => printViaIframe(`/quotes/${q.id}/print`)}
                      >
                        <FileDown size={12} />
                        <span className="hidden sm:inline">Télécharger</span>
                        <span className="sm:hidden">PDF</span>
                      </Button>
                      {q.invoiceStatus === "to-validate" && (
                        <Button
                          size="sm"
                          className="text-xs gap-1.5 bg-palette-sage text-white hover:bg-palette-sage/90"
                          onClick={() => handleApproveQuote(q.id)}
                        >
                          <CheckCircle2 size={12} />
                          <span className="hidden sm:inline">Accepter le devis</span>
                          <span className="sm:hidden">Accepter</span>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Footer ── */}
        <footer className="text-center py-6 border-t border-border space-y-2">
          <p className="font-body text-xs text-muted-foreground">
            Powered by <span className="font-semibold text-foreground">Kojima.Solutions</span>
          </p>
          <a
            href="mailto:massaki@kojima-solutions.ch?subject=Question - Portail client"
            className="inline-block font-body text-[11px] text-primary/70 hover:text-primary transition-colors"
          >
            Besoin d'aide ? massaki@kojima-solutions.ch
          </a>
        </footer>
      </main>
    </div>
  );
}
