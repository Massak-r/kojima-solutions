import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock, CheckCircle2, MessageSquare, List, AlertCircle, AlertTriangle,
  Send, ExternalLink, Star, Clock, Loader2, Sparkles, CircleDot, Maximize2, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  getFunnelByProject, approveGate, selectOption, requestRevision, addGateComment,
  type ProjectFunnel, type FunnelPhase, type FunnelGate, type GateOption, type GateComment,
} from "@/api/funnels";
import { OptionImageGallery } from "@/components/funnel/OptionImageGallery";

// ── Status config ──────────────────────────────────────────

const STEP_STATUS = {
  locked:   { label: "À venir",    dot: "bg-gray-300",    text: "text-gray-400" },
  open:     { label: "En attente", dot: "bg-blue-500",    text: "text-blue-600" },
  approved: { label: "Validé",     dot: "bg-emerald-500", text: "text-emerald-600" },
  revision: { label: "Révision",   dot: "bg-amber-500",   text: "text-amber-600" },
} as const;

const TYPE_LABELS: Record<string, string> = {
  choice: "Choix",
  approval: "Validation",
  feedback: "Retour",
};

const TYPE_ICONS: Record<string, typeof List> = {
  choice: List,
  approval: CheckCircle2,
  feedback: MessageSquare,
};

// ── Flatten phases into flat step list ─────────────────────

interface FlatStep {
  type: "group" | "step";
  phase?: FunnelPhase;
  gate?: FunnelGate;
}

function flattenForClient(phases: FunnelPhase[]): FlatStep[] {
  const items: FlatStep[] = [];
  for (const phase of phases) {
    if (phases.length > 1) {
      items.push({ type: "group", phase });
    }
    for (const gate of phase.gates) {
      items.push({ type: "step", gate, phase });
    }
  }
  return items;
}

// ── Main Component ─────────────────────────────────────────

export function ClientFunnelView({ projectId, hideBanner = false }: { projectId: string; hideBanner?: boolean }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [funnel, setFunnel] = useState<ProjectFunnel | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFunnel = useCallback(async () => {
    try {
      const f = await getFunnelByProject(projectId);
      setFunnel(f);
    } catch {
      // silently hide
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

  if (loading || !funnel || funnel.status === "intake" || funnel.status === "proposal") return null;

  const allGates = funnel.phases.flatMap((p) => p.gates);
  const totalGates = allGates.length;
  const approvedGates = allGates.filter((g) => g.status === "approved").length;
  const progressPct = totalGates > 0 ? (approvedGates / totalGates) * 100 : 0;
  const flatSteps = flattenForClient(funnel.phases);
  const firstOpenIdx = flatSteps.findIndex((s) => s.type === "step" && (s.gate?.status === "open" || s.gate?.status === "revision"));
  const firstOpenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (firstOpenRef.current) {
      setTimeout(() => firstOpenRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
    }
  }, [funnel?.id]);

  return (
    <section>
      <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">
        Décisions
      </h2>

      {/* Progress card */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs font-body text-muted-foreground mb-2">
          <span className="flex items-center gap-1.5">
            <Sparkles size={11} className="text-primary" />
            {approvedGates}/{totalGates} étapes validées
          </span>
          {progressPct === 100 && (
            <Badge variant="secondary" className="text-[9px] bg-emerald-100 text-emerald-700 w-fit">
              Toutes les étapes sont validées
            </Badge>
          )}
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* Action Required Banner (hidden when parent dashboard provides its own) */}
      {!hideBanner && (() => {
        const openGates = allGates.filter((g) => g.status === "open" || g.status === "revision");
        if (openGates.length === 0) return null;
        const urgent = openGates.sort((a, b) => {
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        })[0];
        const deadlineDays = urgent.deadline
          ? Math.ceil((new Date(urgent.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;
        const isOverdue = deadlineDays !== null && deadlineDays < 0;
        const isUrgent = deadlineDays !== null && deadlineDays <= 3 && deadlineDays >= 0;

        return (
          <div className={cn(
            "flex items-center gap-3 rounded-xl px-4 py-3 mb-5 border",
            isOverdue ? "bg-red-50 border-red-200/50" :
            isUrgent ? "bg-amber-50 border-amber-200/50" :
            "bg-blue-50 border-blue-200/50",
          )}>
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
              isOverdue ? "bg-red-100" : isUrgent ? "bg-amber-100" : "bg-blue-100",
            )}>
              <AlertTriangle size={14} className={cn(
                isOverdue ? "text-red-600" : isUrgent ? "text-amber-600" : "text-blue-600",
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-display font-bold", isOverdue ? "text-red-800" : isUrgent ? "text-amber-800" : "text-blue-800")}>
                {openGates.length} décision{openGates.length > 1 ? "s" : ""} en attente
              </p>
              <p className="text-xs font-body text-muted-foreground truncate">
                {urgent.title}
                {deadlineDays !== null && (
                  isOverdue ? " — Echéance dépassée" :
                  deadlineDays === 0 ? " — Aujourd'hui" :
                  ` — ${deadlineDays} jour${deadlineDays > 1 ? "s" : ""} restant${deadlineDays > 1 ? "s" : ""}`
                )}
              </p>
            </div>
            {urgent.gateType === "choice" && (
              <button
                onClick={() => navigate(`/client/${projectId}/decision/${urgent.id}`)}
                className={cn(
                  "shrink-0 text-[11px] font-body font-semibold rounded-lg px-3 py-1.5 transition-colors",
                  isOverdue ? "text-red-700 bg-red-100 border border-red-200 hover:bg-red-200" :
                  isUrgent ? "text-amber-700 bg-amber-100 border border-amber-200 hover:bg-amber-200" :
                  "text-blue-700 bg-blue-100 border border-blue-200 hover:bg-blue-200",
                )}
              >
                Comparer les options →
              </button>
            )}
          </div>
        );
      })()}

      {/* Flat step list */}
      <div className="space-y-0">
        {flatSteps.map((item, idx) => {
          if (item.type === "group" && item.phase) {
            return (
              <div key={`grp-${item.phase.id}`} className="flex items-center gap-2 py-3 mt-2 first:mt-0">
                <div className="w-0.5 h-4 rounded-full bg-primary/30" />
                <h3 className="font-display text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">
                  {item.phase.title}
                </h3>
              </div>
            );
          }

          if (item.type === "step" && item.gate) {
            const gate = item.gate;
            const isFirstOpen = idx === firstOpenIdx;
            const isLast = idx === flatSteps.length - 1 || flatSteps[idx + 1]?.type === "group" || (idx + 1 < flatSteps.length && flatSteps.slice(idx + 1).every(s => s.type === "group"));
            const nextIsStep = idx + 1 < flatSteps.length && flatSteps[idx + 1]?.type === "step";

            return (
              <div key={gate.id} ref={isFirstOpen ? firstOpenRef : undefined}>
                <ClientStepCard
                  gate={gate}
                  projectId={projectId}
                  isFirstOpen={isFirstOpen}
                  isLast={!nextIsStep}
                  onRefresh={fetchFunnel}
                />
              </div>
            );
          }

          return null;
        })}
      </div>
    </section>
  );
}

// ── Client Step Card (flat stepper item) ──────────────────

function ClientStepCard({ gate, projectId, isFirstOpen, isLast, onRefresh }: {
  gate: FunnelGate;
  projectId: string;
  isFirstOpen: boolean;
  isLast: boolean;
  onRefresh: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(
    gate.options.find((o) => o.isSelected)?.id ?? null
  );
  const [revisionMessage, setRevisionMessage] = useState("");
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [commentText, setCommentText] = useState("");

  const status = STEP_STATUS[gate.status as keyof typeof STEP_STATUS] ?? STEP_STATUS.locked;
  const TypeIcon = TYPE_ICONS[gate.gateType] ?? MessageSquare;
  const isLocked = gate.status === "locked";
  const isOpen = gate.status === "open";
  const isApproved = gate.status === "approved";
  const isRevision = gate.status === "revision";

  // Auto-expand for open and revision steps
  const expanded = isOpen || isRevision || isApproved;

  async function handleSelectOption(optionId: string) {
    if (!isOpen) return;
    setSelectedOptionId(optionId);
    try { await selectOption(gate.id, optionId); } catch { toast({ title: "Erreur", variant: "destructive" }); }
  }

  async function handleApprove() {
    if (!isOpen) return;
    if (gate.gateType === "choice" && !selectedOptionId) {
      toast({ title: "Sélectionnez une option d'abord" });
      return;
    }
    setBusy(true);
    try {
      await approveGate(gate.id, "client");
      toast({ title: "Étape validée !" });
      onRefresh();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevision() {
    if (!revisionMessage.trim()) return;
    setBusy(true);
    try {
      const res = await requestRevision(gate.id, { message: revisionMessage.trim() });
      if (res.overLimit) {
        toast({ title: "Limite de révisions atteinte", description: "Un ajustement budgétaire sera proposé.", variant: "destructive" });
      } else {
        toast({ title: "Révision demandée" });
      }
      setRevisionMessage("");
      setShowRevisionInput(false);
      onRefresh();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleComment() {
    if (!commentText.trim()) return;
    setBusy(true);
    try {
      await addGateComment(gate.id, { message: commentText.trim(), authorRole: "client" });
      setCommentText("");
      onRefresh();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-3">
      {/* Timeline column */}
      <div className="flex flex-col items-center pt-4 shrink-0 w-6">
        {isApproved ? (
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
        ) : isOpen || isRevision ? (
          <CircleDot size={16} className={cn("shrink-0", isOpen ? "text-blue-500" : "text-amber-500")} />
        ) : (
          <div className={cn("w-3 h-3 rounded-full shrink-0 ring-2 ring-background", status.dot)} />
        )}
        {!isLast && (
          <div className={cn(
            "w-0 flex-1 border-l-2 mt-1",
            isApproved ? "border-emerald-200" : isOpen ? "border-blue-200" : isRevision ? "border-amber-200" : "border-gray-200"
          )} />
        )}
      </div>

      {/* Card */}
      <div className={cn(
        "flex-1 mb-3 rounded-xl transition-all",
        isLocked && "py-2",
        isOpen && "border border-blue-200 bg-blue-50/30 shadow-sm p-4",
        isApproved && "py-2",
        isRevision && "border border-amber-200 bg-amber-50/20 p-4",
      )}>
        {/* Header */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
            isOpen ? "bg-blue-100 text-blue-600" :
            isApproved ? "bg-emerald-50 text-emerald-600" :
            isRevision ? "bg-amber-100 text-amber-600" :
            "bg-gray-100 text-gray-400"
          )}>
            <TypeIcon size={12} />
          </div>

          <span className={cn(
            "text-sm font-body font-medium flex-1",
            isLocked ? "text-muted-foreground/40" : "text-foreground"
          )}>
            {gate.title}
          </span>

          {/* "Vous êtes ici" marker */}
          {isFirstOpen && (
            <Badge variant="secondary" className="text-[9px] bg-blue-500 text-white shrink-0 font-semibold">
              Vous êtes ici
            </Badge>
          )}

          {/* Status */}
          {!isLocked && (
            <span className={cn("text-[10px] font-body font-semibold", status.text)}>
              {status.label}
            </span>
          )}

          {/* Type label for locked steps */}
          {isLocked && (
            <span className="text-[10px] text-muted-foreground/30 font-body shrink-0">
              {TYPE_LABELS[gate.gateType]}
            </span>
          )}
        </div>

        {/* Locked step description preview */}
        {isLocked && gate.description && (
          <p className="text-[11px] text-muted-foreground/30 font-body mt-0.5 ml-8 line-clamp-1">{gate.description}</p>
        )}

        {/* Open step hint */}
        {isOpen && (
          <p className="text-[11px] text-muted-foreground/50 font-body mt-1 ml-8">
            {gate.gateType === "approval" && "Validez pour passer à la suite"}
            {gate.gateType === "choice" && "Sélectionnez une option puis validez"}
            {gate.gateType === "feedback" && "Partagez vos retours"}
          </p>
        )}

        {/* Compact approved summary */}
        {isApproved && (
          <div className="mt-1.5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-body ml-8">
              <span>
                Validé {gate.approvedAt && `le ${new Date(gate.approvedAt).toLocaleDateString("fr-CH")}`}
                {gate.approvedBy && ` par ${gate.approvedBy}`}
              </span>
            </div>
            {gate.gateType === "choice" && (
              <div className="ml-8"><SelectedOptionSummary options={gate.options} /></div>
            )}
          </div>
        )}

        {/* Expanded content for open/revision */}
        {expanded && !isLocked && !isApproved && (
          <div className="mt-3 space-y-3">
            {gate.description && (
              <p className="text-xs text-muted-foreground/60 font-body ml-8">{gate.description}</p>
            )}

            {/* Deadline (promoted above actions) */}
            {gate.deadline && (() => {
              const deadlineDate = new Date(gate.deadline);
              const now = new Date();
              const diffMs = deadlineDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
              const isPast = diffDays < 0;
              const isUrgent = diffDays >= 0 && diffDays <= 3;
              return (
                <div className={cn(
                  "flex flex-wrap items-center gap-1.5 text-xs font-body rounded-md px-2 py-1 ml-8",
                  isPast ? "bg-red-50 text-red-600 border border-red-200/50" :
                  isUrgent ? "bg-amber-50 text-amber-600 border border-amber-200/50" :
                  "text-muted-foreground/40"
                )}>
                  <Clock size={10} />
                  <span>Échéance : {deadlineDate.toLocaleDateString("fr-CH")}</span>
                  {isPast ? (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-red-100 text-red-600 ml-1">Dépassée</Badge>
                  ) : diffDays === 0 ? (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-600 ml-1">Aujourd'hui</Badge>
                  ) : isUrgent ? (
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 bg-amber-100 text-amber-600 ml-1">
                      {diffDays} jour{diffDays > 1 ? "s" : ""} restant{diffDays > 1 ? "s" : ""}
                    </Badge>
                  ) : (
                    <span>{diffDays} jour{diffDays > 1 ? "s" : ""} restant{diffDays > 1 ? "s" : ""}</span>
                  )}
                </div>
              );
            })()}

            {/* Choice options */}
            {gate.gateType === "choice" && isOpen && gate.options.length > 0 && (
              <div className="ml-8 space-y-2">
                <ChoiceOptions options={gate.options} selectedId={selectedOptionId} onSelect={handleSelectOption} />
                <button
                  onClick={() => navigate(`/client/${projectId}/decision/${gate.id}`)}
                  className="flex items-center gap-1 text-[10px] font-body text-primary/60 hover:text-primary transition-colors"
                >
                  <Maximize2 size={10} /> Comparer en plein ecran
                </button>
              </div>
            )}

            {/* Revision count + limit */}
            {(isOpen || isRevision) && gate.gateType !== "feedback" && gate.revisionLimit > 0 && (
              <div className={cn(
                "flex items-start gap-2 rounded-lg px-3 py-2 ml-8",
                gate.revisionCount >= gate.revisionLimit
                  ? "bg-red-50 border border-red-200/50"
                  : gate.revisionCount >= gate.revisionLimit - 1
                    ? "bg-amber-50 border border-amber-200/50"
                    : "bg-secondary/30"
              )}>
                {gate.revisionCount >= gate.revisionLimit ? (
                  <AlertCircle size={12} className="text-red-500 shrink-0 mt-0.5" />
                ) : gate.revisionCount >= gate.revisionLimit - 1 ? (
                  <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                ) : null}
                <div className="flex flex-col gap-0.5">
                  <p className={cn(
                    "text-[11px] font-body font-medium",
                    gate.revisionCount >= gate.revisionLimit ? "text-red-700" :
                    gate.revisionCount >= gate.revisionLimit - 1 ? "text-amber-700" :
                    "text-muted-foreground/60"
                  )}>
                    {gate.revisionCount}/{gate.revisionLimit} révision{gate.revisionLimit > 1 ? "s" : ""} utilisée{gate.revisionCount > 1 ? "s" : ""}
                  </p>
                  {gate.revisionCount >= gate.revisionLimit && (
                    <p className="text-[10px] text-red-600/70 font-body">
                      Limite atteinte. Les prochaines révisions feront l'objet d'un ajustement tarifaire.
                    </p>
                  )}
                  {gate.revisionCount >= gate.revisionLimit - 1 && gate.revisionCount < gate.revisionLimit && (
                    <p className="text-[10px] text-amber-600/70 font-body">
                      Dernière révision incluse. Les suivantes pourront faire l'objet d'un ajustement tarifaire.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons */}
            {isOpen && (
              <div className="space-y-2 ml-8">
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={handleApprove} disabled={busy} className="text-xs h-10 px-5">
                    {busy ? <Loader2 size={12} className="animate-spin mr-1" /> : <CheckCircle2 size={12} className="mr-1" />}
                    {gate.gateType === "feedback" ? "Envoyer" : gate.gateType === "choice" ? "Valider mon choix" : "Approuver"}
                  </Button>
                  {gate.gateType !== "feedback" && !showRevisionInput && (
                    <Button size="sm" variant="outline" onClick={() => setShowRevisionInput(true)} className="text-xs h-10 text-amber-600 border-amber-200 hover:bg-amber-50">
                      Demander des modifications
                    </Button>
                  )}
                </div>

                {gate.gateType !== "feedback" && showRevisionInput && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={revisionMessage}
                      onChange={(e) => setRevisionMessage(e.target.value)}
                      placeholder="Décrivez les modifications souhaitées..."
                      className="flex-1 text-xs font-body bg-background border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/20"
                      onKeyDown={(e) => e.key === "Enter" && handleRevision()}
                    />
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={handleRevision} disabled={busy || !revisionMessage.trim()} className="text-xs">
                        <Send size={10} className="mr-1" /> Envoyer
                      </Button>
                      <button onClick={() => setShowRevisionInput(false)} className="text-xs text-muted-foreground/40">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Revision status */}
            {isRevision && (
              <div className="bg-amber-50 border border-amber-200/50 rounded-lg p-3 text-xs font-body text-amber-700 ml-8">
                <p className="font-medium">Révision en cours</p>
                <p className="text-amber-600/70 mt-0.5">
                  L'équipe travaille sur vos retours. Révision {gate.revisionCount}/{gate.revisionLimit}.
                </p>
              </div>
            )}

            {/* Stakeholder comment indicator */}
            {(() => {
              const stakeholderComments = gate.comments.filter((c) => c.authorRole === "stakeholder");
              if (stakeholderComments.length === 0) return null;
              return (
                <div className="flex items-center gap-1.5 ml-8 bg-violet-50/50 border border-violet-200/30 rounded-md px-2.5 py-1.5">
                  <Users size={10} className="text-violet-500 shrink-0" />
                  <span className="text-[10px] font-body text-violet-600">
                    {stakeholderComments.length} commentaire{stakeholderComments.length > 1 ? "s" : ""} de parties prenantes
                  </span>
                </div>
              );
            })()}

            {/* Comments */}
            {gate.comments.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/20 ml-8">
                <p className="text-[10px] text-muted-foreground/40 font-body font-medium uppercase tracking-wide">Commentaires</p>
                {gate.comments.map((comment) => (
                  <CommentBubble key={comment.id} comment={comment} />
                ))}
              </div>
            )}

            {/* Add comment */}
            {(isOpen || isRevision) && (
              <div className="flex items-center gap-2 ml-8">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Ajouter un commentaire..."
                  className="flex-1 min-w-0 text-xs font-body bg-background border border-border/40 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                />
                <button
                  onClick={handleComment}
                  disabled={busy || !commentText.trim()}
                  className="p-2 text-primary/60 hover:text-primary disabled:opacity-30 transition-colors shrink-0"
                >
                  <Send size={12} />
                </button>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

// ── Choice Options Grid ────────────────────────────────────

function ChoiceOptions({ options, selectedId, onSelect }: {
  options: GateOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className={cn(
      "grid gap-2",
      options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
    )}>
      {options.map((opt) => {
        const isSelected = selectedId === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onSelect(opt.id)}
            className={cn(
              "relative flex flex-col rounded-xl border-2 p-4 text-left transition-all touch-manipulation min-h-[48px]",
              isSelected
                ? "border-primary bg-primary/5 shadow-md"
                : opt.isRecommended
                  ? "border-amber-300 bg-amber-50/30 hover:border-amber-400 active:bg-amber-50/50"
                  : "border-border/40 hover:border-border hover:bg-secondary/10 active:bg-secondary/20"
            )}
          >
            {opt.isRecommended && (
              <span className="absolute -top-2 right-2 flex items-center gap-0.5 text-[10px] font-body font-semibold text-amber-600 bg-amber-50 border border-amber-200/50 px-1.5 py-0.5 rounded-full">
                <Star size={10} className="fill-amber-500" /> Recommandé
              </span>
            )}

            {(opt.images?.length > 0 || opt.imageUrl) && (
              <div className="mb-2">
                <OptionImageGallery
                  images={opt.images?.length > 0 ? opt.images : opt.imageUrl ? [opt.imageUrl] : []}
                  alt={opt.title}
                  variant="compact"
                />
              </div>
            )}

            <p className="text-sm font-body font-medium text-foreground/80">{opt.title}</p>
            {opt.description && (
              <p className="text-[11px] text-muted-foreground/50 font-body mt-0.5 leading-relaxed">{opt.description}</p>
            )}

            {opt.linkUrl && (
              <a
                href={opt.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[10px] text-primary/60 hover:text-primary font-body mt-1 flex items-center gap-0.5"
              >
                <ExternalLink size={9} /> Voir
              </a>
            )}

            {isSelected && (
              <div className="absolute top-2 left-2">
                <CheckCircle2 size={14} className="text-primary" />
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Selected Option Summary ────────────────────────────────

function SelectedOptionSummary({ options }: { options: GateOption[] }) {
  const selected = options.find((o) => o.isSelected);
  if (!selected) return null;
  return (
    <div className="flex items-center gap-2 text-xs font-body text-emerald-700 bg-emerald-50/50 rounded-lg p-2.5">
      <CheckCircle2 size={12} className="shrink-0" />
      <span>Choix : <strong>{selected.title}</strong></span>
      {(selected.images?.[0] || selected.imageUrl) && (
        <img src={selected.images?.[0] || selected.imageUrl!} alt={selected.title} className="w-8 h-8 rounded object-cover ml-auto shrink-0" />
      )}
    </div>
  );
}

// ── Comment Bubble ─────────────────────────────────────────

function CommentBubble({ comment }: { comment: GateComment }) {
  const isAdmin = comment.authorRole === "admin";
  return (
    <div className={cn(
      "flex flex-col max-w-[85%] rounded-lg px-3 py-2 break-words",
      isAdmin ? "bg-secondary/40 self-start" : "bg-primary/5 self-end ml-auto"
    )}>
      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
        <span className="text-[10px] font-body font-medium text-foreground/60">
          {comment.authorName || (isAdmin ? "Équipe" : "Client")}
        </span>
        <span className="text-[10px] text-muted-foreground/50 font-body">
          {new Date(comment.createdAt).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="text-xs font-body text-foreground/70 break-words">{comment.message}</p>
    </div>
  );
}
