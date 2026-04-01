import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Loader2, CheckCircle2, Check, ArrowRight, Download, ExternalLink,
  Layers, Clock, Shield, Headphones, Palette, Globe, Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useProjects } from "@/contexts/ProjectsContext";
import { useClients } from "@/contexts/ClientsContext";
import { getClientAuth, setClientAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getFunnelByProject, confirmProposal, getTemplate,
  type ProjectFunnel, type Tier, type ProjectTemplate,
} from "@/api/funnels";
import { listProjectQuotes } from "@/api/quotes";
import { totalQuote, type Quote } from "@/types/quote";
import { printViaIframe } from "@/lib/printUtils";

// ── Constants ──────────────────────────────────────────────

const TIERS: { key: Tier; label: string; color: string; borderColor: string; bgColor: string }[] = [
  { key: "essential",     label: "Essentiel",      color: "text-gray-700",   borderColor: "border-gray-300",    bgColor: "bg-gray-50" },
  { key: "professional",  label: "Professionnel",   color: "text-blue-700",   borderColor: "border-blue-400",    bgColor: "bg-blue-50" },
  { key: "custom",        label: "Sur mesure",      color: "text-violet-700", borderColor: "border-violet-400",  bgColor: "bg-violet-50" },
];

interface TierFeature {
  icon: typeof Globe;
  label: string;
  essential: string;
  professional: string;
  custom: string;
}

const TIER_FEATURES: TierFeature[] = [
  { icon: Globe,       label: "Pages",    essential: "1–5 pages",        professional: "5–15 pages",          custom: "Illimité" },
  { icon: Palette,     label: "Design",   essential: "Template adapté",  professional: "Design sur mesure",   custom: "Direction artistique" },
  { icon: Smartphone,  label: "Mobile",   essential: "Responsive",       professional: "Responsive + PWA",    custom: "App native possible" },
  { icon: Globe,       label: "SEO",      essential: "Base",             professional: "Avancé",              custom: "Stratégie complète" },
  { icon: Headphones,  label: "Support",  essential: "Email",            professional: "Email + téléphone",   custom: "Dédié" },
  { icon: Shield,      label: "Sécurité", essential: "SSL + base",       professional: "Avancée",             custom: "Audit complet" },
];

const TIER_BADGE_COLORS: Record<Tier, string> = {
  essential: "bg-gray-100 text-gray-700",
  professional: "bg-blue-100 text-blue-700",
  custom: "bg-violet-100 text-violet-700",
};

// ── Component ──────────────────────────────────────────────

export default function ClientProposal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, loading: projectsLoading } = useProjects();
  const { clients, loading: clientsLoading } = useClients();
  const { toast } = useToast();
  const project = getProject(id!);

  // Email gate (same pattern as ClientDashboard)
  const requiredEmail = project?.clientId
    ? clients.find((c) => c.id === project.clientId)?.email?.toLowerCase() ?? null
    : null;
  const [emailAuthed, setEmailAuthed] = useState<boolean | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailError, setEmailError] = useState("");

  // Data
  const [funnel, setFunnel] = useState<ProjectFunnel | null>(null);
  const [template, setTemplate] = useState<ProjectTemplate | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<Tier>("professional");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Email gate evaluation
  useEffect(() => {
    if (clientsLoading) return;
    if (!requiredEmail) { setEmailAuthed(true); return; }
    setEmailAuthed(getClientAuth(id!) === requiredEmail);
  }, [requiredEmail, id, clientsLoading]);

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (emailInput.trim().toLowerCase() === requiredEmail) {
      setClientAuth(id!, emailInput.trim());
      setEmailAuthed(true);
    } else {
      setEmailError("Email non reconnu pour ce projet.");
    }
  }

  // Load funnel + quotes
  useEffect(() => {
    if (!id) return;
    Promise.all([
      getFunnelByProject(id),
      listProjectQuotes(id).catch(() => []),
    ]).then(([f, q]) => {
      setFunnel(f);
      setQuotes(q);
      if (f?.tier) setSelectedTier(f.tier);
      if (f?.templateId) {
        getTemplate(f.templateId).then(setTemplate).catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  // Confirm proposal
  async function handleConfirm() {
    if (!funnel) return;
    setConfirming(true);
    try {
      await confirmProposal(funnel.id, selectedTier);
      setConfirmed(true);
      toast({ title: "Forfait confirmé !" });
      setTimeout(() => navigate(`/client/${id}`), 3000);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setConfirming(false);
    }
  }

  // Budget calculations
  const totalBudget = funnel?.phases.reduce((sum, p) => sum + (p.budget ?? 0), 0) ?? 0;
  const phasesCompleted = funnel?.phases.filter((p) => p.status === "completed").length ?? 0;
  const phasesTotal = funnel?.phases.length ?? 0;

  // ── Loading / Error states ─────────────────────────────────

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
            <Layers size={24} className="text-muted-foreground" />
          </div>
          <p className="font-display text-xl text-foreground font-bold mb-2">Projet introuvable</p>
          <p className="font-body text-sm text-muted-foreground">Ce lien est peut-être invalide.</p>
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
            <h1 className="font-display text-2xl font-bold text-foreground">{project.title}</h1>
            <p className="font-body text-sm text-muted-foreground mt-1">Entrez votre email pour voir la proposition</p>
          </div>
          <form onSubmit={handleEmailSubmit} className="bg-card border border-border rounded-2xl p-6 shadow-card space-y-4">
            <Input
              type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
              placeholder="votre@email.ch"
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
            <Button type="submit" className="w-full">Accéder</Button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <Layers size={32} className="text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-display text-lg font-semibold">Aucune proposition</p>
          <p className="text-sm text-muted-foreground font-body mt-1">La proposition n'est pas encore prête.</p>
        </div>
      </div>
    );
  }

  // ── Confirmed state ────────────────────────────────────────

  if (confirmed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 animate-in fade-in duration-500">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-green-600" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Forfait confirmé !</h1>
          <p className="text-muted-foreground font-body text-sm">
            Merci pour votre confiance. Nous allons préparer les prochaines étapes de votre projet.
          </p>
          <Badge className={cn("text-xs", TIER_BADGE_COLORS[selectedTier])}>
            {TIERS.find((t) => t.key === selectedTier)?.label}
          </Badge>
          <p className="text-xs text-muted-foreground/40 font-body">Redirection vers votre portail...</p>
        </div>
      </div>
    );
  }

  // ── Main proposal view ─────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-10">
          <Link to={`/client/${id}`} className="text-xs text-muted-foreground/50 hover:text-foreground font-body transition-colors">
            ← Retour au portail
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-bold mt-4">
            {project.title}
          </h1>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Proposition de projet. Choisissez le forfait qui vous convient.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {TIERS.map((tier) => {
            const isSelected = selectedTier === tier.key;
            const isRecommended = funnel.tier === tier.key;
            const tierBudget = tier.key === funnel.tier
              ? totalBudget
              : tier.key === "essential"
                ? template?.budgetRangeMin ?? Math.round(totalBudget * 0.6)
                : tier.key === "custom"
                  ? template?.budgetRangeMax ?? Math.round(totalBudget * 1.5)
                  : totalBudget;

            return (
              <button
                key={tier.key}
                onClick={() => setSelectedTier(tier.key)}
                className={cn(
                  "relative flex flex-col rounded-2xl border-2 p-6 text-left transition-all",
                  isSelected
                    ? `${tier.borderColor} ${tier.bgColor} shadow-lg scale-[1.02]`
                    : "border-border/40 hover:border-border hover:shadow-sm"
                )}
              >
                {isRecommended && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-body font-semibold bg-primary text-white px-3 py-0.5 rounded-full">
                    Recommandé
                  </span>
                )}

                <h3 className={cn("font-display text-lg font-bold", tier.color)}>
                  {tier.label}
                </h3>

                {tierBudget > 0 && (
                  <p className="font-display text-2xl font-bold mt-3">
                    {tierBudget.toLocaleString("fr-CH")} <span className="text-sm font-normal text-muted-foreground">CHF</span>
                  </p>
                )}

                <div className="mt-4 space-y-2 flex-1">
                  {TIER_FEATURES.map((feat) => {
                    const val = feat[tier.key];
                    return (
                      <div key={feat.label} className="flex items-center gap-2 text-xs font-body">
                        <Check size={12} className={cn("shrink-0", isSelected ? "text-primary" : "text-muted-foreground/30")} />
                        <span className={isSelected ? "text-foreground/80" : "text-muted-foreground/60"}>
                          {val}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {isSelected && (
                  <div className="mt-4 pt-3 border-t border-border/20">
                    <span className="text-xs font-body font-medium text-primary flex items-center gap-1">
                      <CheckCircle2 size={12} /> Sélectionné
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Phase roadmap */}
        {funnel.phases.length > 0 && (
          <div className="mb-12">
            <h2 className="font-display text-lg font-semibold mb-6">
              Phases du projet
            </h2>
            <div className="relative pl-8">
              {/* Vertical line */}
              <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border/30" />

              <div className="space-y-6">
                {funnel.phases.map((phase, idx) => {
                  const gateCount = phase.gates?.length ?? 0;
                  const isCompleted = phase.status === "completed";
                  const isActive = phase.status === "active";

                  return (
                    <div key={phase.id} className="relative">
                      {/* Dot */}
                      <div className={cn(
                        "absolute -left-5 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center",
                        isCompleted ? "border-green-500 bg-green-500" :
                        isActive ? "border-primary bg-primary" :
                        "border-border bg-background"
                      )}>
                        {isCompleted && <Check size={10} className="text-white" />}
                      </div>

                      <div className={cn(
                        "bg-card border border-border/40 rounded-xl p-5 transition-all",
                        isActive && "border-primary/30 shadow-sm"
                      )}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-muted-foreground/40 font-body">Phase {idx + 1}</span>
                              {isActive && <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary">En cours</Badge>}
                              {isCompleted && <Badge variant="secondary" className="text-[9px] bg-green-100 text-green-700">Terminée</Badge>}
                            </div>
                            <h3 className="font-display font-semibold text-foreground/90 mt-1">{phase.title}</h3>
                            {phase.description && (
                              <p className="text-xs text-muted-foreground/50 font-body mt-1">{phase.description}</p>
                            )}
                          </div>
                          {phase.budget != null && phase.budget > 0 && (
                            <span className="font-display font-bold text-sm text-foreground/70 shrink-0">
                              {phase.budget.toLocaleString("fr-CH")} CHF
                            </span>
                          )}
                        </div>

                        {gateCount > 0 && (
                          <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground/40 font-body">
                            <Clock size={10} />
                            {gateCount} décision{gateCount !== 1 ? "s" : ""} à prendre
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Budget summary */}
        <div className="bg-card border border-border/40 rounded-2xl p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Résumé</h2>
            <Badge className={cn("text-xs", TIER_BADGE_COLORS[selectedTier])}>
              {TIERS.find((t) => t.key === selectedTier)?.label}
            </Badge>
          </div>

          <div className="space-y-3">
            {funnel.phases.map((phase) => (
              <div key={phase.id} className="flex items-center justify-between text-sm font-body">
                <span className="text-muted-foreground/70">{phase.title}</span>
                <span className="font-medium">
                  {(phase.budget ?? 0) > 0 ? `${phase.budget!.toLocaleString("fr-CH")} CHF` : "-"}
                </span>
              </div>
            ))}

            {totalBudget > 0 && (
              <>
                <div className="border-t border-border/30 pt-3 flex items-center justify-between">
                  <span className="font-display font-semibold">Total</span>
                  <span className="font-display text-xl font-bold">
                    {totalBudget.toLocaleString("fr-CH")} <span className="text-sm font-normal text-muted-foreground">CHF</span>
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground/30 font-body">
                  TVA 8.1% non incluse. Montants indicatifs, devis détaillé sur demande.
                </p>
              </>
            )}

            {phasesTotal > 0 && (
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground/40 font-body mb-1">
                  <span>Progression</span>
                  <span>{phasesCompleted}/{phasesTotal} phases</span>
                </div>
                <Progress value={(phasesCompleted / phasesTotal) * 100} className="h-1.5" />
              </div>
            )}
          </div>

          {/* Linked quotes */}
          {quotes.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border/30">
              <p className="text-xs text-muted-foreground/40 font-body mb-2">Documents liés</p>
              <div className="space-y-2">
                {quotes.map((q) => (
                  <div key={q.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Download size={12} className="text-muted-foreground/30" />
                      <span className="font-body text-foreground/70">{q.quoteNumber || "Devis"}</span>
                      <span className="text-xs text-muted-foreground/40">{totalQuote(q).toLocaleString("fr-CH")} CHF</span>
                    </div>
                    <button
                      onClick={() => printViaIframe(`/quotes/${q.id}/print`)}
                      className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                    >
                      <ExternalLink size={10} /> Voir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* CTA */}
        {funnel.status === "proposal" && (
          <div className="text-center space-y-3">
            <Button size="lg" onClick={handleConfirm} disabled={confirming} className="px-8">
              {confirming ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <ArrowRight size={16} className="mr-2" />
              )}
              Choisir ce forfait
            </Button>
            <p className="text-[10px] text-muted-foreground/30 font-body">
              En confirmant, vous acceptez le forfait sélectionné. Les détails seront finalisés ensemble.
            </p>
          </div>
        )}

        {funnel.status === "active" && (
          <div className="text-center space-y-3">
            <Badge variant="secondary" className="bg-green-100 text-green-700 text-sm px-4 py-1">
              <CheckCircle2 size={14} className="mr-1" /> Forfait confirmé
            </Badge>
            <p className="text-xs text-muted-foreground/50 font-body">
              <Link to={`/client/${id}`} className="text-primary hover:text-primary/80">
                Accéder à votre portail projet →
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
