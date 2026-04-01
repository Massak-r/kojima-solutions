import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  Loader2, CheckCircle2, Circle, Lock, MessageSquare, AlertTriangle,
  CalendarDays, Users, Vote, Image, FileUp, Type, ChevronDown, Star,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getProjectByShareToken, type StakeholderProject, type StakeholderStep } from "@/api/stakeholder";
import { addStepComment, castStakeholderVote } from "@/api/steps";
import { OptionImageGallery } from "@/components/funnel/OptionImageGallery";
import type { FeedbackRequest, StakeholderVote, VoteOption } from "@/types/timeline";
import type { ProjectPhase } from "@/types/phase";

const STATUS_STYLES = {
  locked:    { icon: Lock,         bg: "bg-gray-100", text: "text-gray-500",    label: "A venir" },
  open:      { icon: Circle,       bg: "bg-blue-50",  text: "text-blue-600",    label: "En cours" },
  completed: { icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-600", label: "Termine" },
} as const;

const REQUEST_ICONS: Record<string, { icon: typeof Type; color: string }> = {
  text:       { icon: Type,   color: "text-blue-500" },
  file:       { icon: FileUp, color: "text-violet-500" },
  validation: { icon: Image,  color: "text-emerald-500" },
  vote:       { icon: Vote,   color: "text-amber-500" },
};

// ── Deadline badge with urgency coloring ──

function DeadlineBadge({ deadline }: { deadline: string }) {
  const diff = Math.ceil((new Date(deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const label = new Date(deadline).toLocaleDateString("fr-CH");

  let cls = "text-muted-foreground border-border";
  if (diff < 0) cls = "text-red-600 bg-red-50 border-red-200 font-semibold";
  else if (diff <= 3) cls = "text-amber-600 bg-amber-50 border-amber-200";
  else cls = "text-emerald-600 bg-emerald-50 border-emerald-200";

  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1", cls)}>
      <CalendarDays size={10} />
      {diff < 0 ? `En retard (${label})` : diff === 0 ? `Aujourd'hui` : diff <= 3 ? `${diff}j restants` : label}
    </Badge>
  );
}

// ── Vote tally ──

function VoteTally({ votes, options }: { votes: StakeholderVote[]; options?: VoteOption[] }) {
  if (!options || options.length === 0) return null;

  const counts: Record<string, number> = {};
  for (const v of votes) {
    if (v.optionId) counts[v.optionId] = (counts[v.optionId] || 0) + 1;
  }
  const total = votes.filter((v) => v.optionId).length;

  return (
    <div className="space-y-1.5 mt-2">
      <p className="text-[10px] font-body text-muted-foreground font-semibold uppercase tracking-wider">
        Votes ({total})
      </p>
      {options.map((opt) => {
        const count = counts[opt.id] || 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={opt.id} className="flex items-center gap-2 text-xs font-body">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className={cn("truncate", opt.isRecommended && "font-semibold")}>{opt.label}</span>
                <span className="text-muted-foreground shrink-0 ml-2">{count} vote{count !== 1 ? "s" : ""}</span>
              </div>
              <div className="h-1.5 bg-secondary/50 rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Stakeholder vote form ──

function StakeholderVoteForm({ request, stepId, stakeholderName, onVoted }: {
  request: FeedbackRequest;
  stepId: string;
  stakeholderName: string;
  onVoted: () => void;
}) {
  const { toast } = useToast();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [approvalVote, setApprovalVote] = useState<"approve" | "revise" | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isVoteType = request.type === "vote" && request.options && request.options.length >= 2;
  const isValidationType = request.type === "validation";

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await castStakeholderVote(stepId, request.id, {
        name: stakeholderName,
        optionId: selectedOption || undefined,
        vote: approvalVote || undefined,
        comment: comment.trim() || undefined,
      });
      toast({ title: "Vote enregistre" });
      onVoted();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3 p-3 bg-secondary/20 rounded-lg border border-border/40">

      {isVoteType && (
        <div className={cn(
          "grid gap-3",
          request.options!.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"
        )}>
          {request.options!.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedOption(opt.id)}
              className={cn(
                "w-full text-left rounded-lg border transition-all overflow-hidden flex flex-col",
                selectedOption === opt.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border hover:border-primary/30"
              )}
            >
              {/* Image at top for side-by-side comparison */}
              {opt.images && opt.images.length > 0 && (
                <div onClick={(e) => e.stopPropagation()}>
                  <OptionImageGallery images={opt.images} />
                </div>
              )}
              <div className="p-3 flex-1">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                    selectedOption === opt.id ? "border-primary bg-primary" : "border-border"
                  )}>
                    {selectedOption === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span className="font-display text-xs font-semibold">{opt.label}</span>
                  {opt.isRecommended && (
                    <Badge className="text-[8px] bg-amber-100 text-amber-700 border-amber-200">Recommande</Badge>
                  )}
                </div>
                {opt.description && <p className="text-[10px] font-body text-muted-foreground mt-1 ml-6">{opt.description}</p>}
              </div>
            </button>
          ))}
        </div>
      )}

      {isValidationType && (
        <div className="flex gap-2">
          <Button
            variant={approvalVote === "approve" ? "default" : "outline"}
            size="sm" className="flex-1 text-xs gap-1"
            onClick={() => setApprovalVote("approve")}
          >
            <CheckCircle2 size={12} /> Approuver
          </Button>
          <Button
            variant={approvalVote === "revise" ? "destructive" : "outline"}
            size="sm" className="flex-1 text-xs gap-1"
            onClick={() => setApprovalVote("revise")}
          >
            Reviser
          </Button>
        </div>
      )}

      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Commentaire (optionnel)"
        className="text-xs min-h-[60px]"
      />

      <Button
        size="sm" onClick={handleSubmit}
        disabled={submitting || (isVoteType && !selectedOption) || (isValidationType && !approvalVote)}
        className="w-full text-xs"
      >
        {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
        Envoyer mon avis
      </Button>
    </div>
  );
}

// ── Step card for stakeholder ──

function StakeholderStepCard({ step, phaseTitle, stakeholderName, onRefresh }: {
  step: StakeholderStep;
  phaseTitle?: string;
  stakeholderName: string;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const hasHighlight = step.requests.some((r) => r.stakeholderHighlight);
  const [expanded, setExpanded] = useState(step.status === "open" || hasHighlight);
  const [commentMsg, setCommentMsg] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const statusCfg = STATUS_STYLES[step.status] || STATUS_STYLES.open;
  const StatusIcon = statusCfg.icon;
  const isCompleted = step.status === "completed";

  async function handleAddComment() {
    if (!commentMsg.trim()) return;
    setSubmittingComment(true);
    try {
      await addStepComment(step.id, {
        message: commentMsg.trim(),
        authorName: stakeholderName || "Stakeholder",
        authorRole: "stakeholder",
      });
      setCommentMsg("");
      toast({ title: "Commentaire ajoute" });
      onRefresh();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  }

  return (
    <div className={cn(
      "bg-card border rounded-xl overflow-hidden transition-all",
      step.status === "locked" ? "border-border/40 opacity-50" : "border-border",
      isCompleted && "border-emerald-200/50",
    )}>
      <button
        onClick={() => step.status !== "locked" && setExpanded(!expanded)}
        className={cn(
          "w-full text-left p-4 flex items-center gap-3 transition-colors",
          step.status === "locked" ? "cursor-default" : "hover:bg-secondary/20"
        )}
      >
        <StatusIcon size={16} className={statusCfg.text} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              "font-display text-sm font-semibold truncate",
              isCompleted && "line-through text-muted-foreground"
            )}>
              {step.title}
            </span>
            {hasHighlight && (
              <Badge className="text-[8px] bg-amber-50 text-amber-600 border-amber-200 gap-0.5">
                <Star size={8} className="fill-amber-500" /> Prioritaire
              </Badge>
            )}
            {step.deadline && <DeadlineBadge deadline={step.deadline} />}
          </div>
          {step.description && (
            <p className="text-[11px] font-body text-muted-foreground/60 mt-0.5 truncate">{step.description}</p>
          )}
        </div>
        {step.status !== "locked" && (
          <ChevronDown size={14} className={cn("text-muted-foreground/40 transition-transform shrink-0", expanded && "rotate-180")} />
        )}
      </button>

      {expanded && step.status !== "locked" && (
        <div className="border-t border-border/30 px-4 pb-4 space-y-4">
          {/* Completed step warning */}
          {isCompleted && (
            <div className="flex items-start gap-2 p-3 mt-3 bg-amber-50 border border-amber-200/50 rounded-lg">
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-body font-semibold text-amber-700">Cette etape a ete validee</p>
                <p className="text-[10px] font-body text-amber-600/80 mt-0.5">
                  Toute modification a ce stade pourra entrainer des couts supplementaires.
                </p>
              </div>
            </div>
          )}

          {/* Requests */}
          {step.requests.map((req) => {
            const cfg = REQUEST_ICONS[req.type] || REQUEST_ICONS.text;
            const Icon = cfg.icon;
            const votes = req.stakeholderVotes || [];

            return (
              <div key={req.id} className="space-y-2 pt-3">
                <div className="flex items-center gap-2">
                  <Icon size={13} className={cfg.color} />
                  <span className="text-xs font-body font-semibold text-foreground/80">{req.message}</span>
                  {req.stakeholderHighlight && (
                    <Badge className="text-[8px] bg-amber-50 text-amber-600 border-amber-200 gap-0.5">
                      <Star size={7} className="fill-amber-500" /> Prioritaire
                    </Badge>
                  )}
                  {req.resolved && (
                    <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-600 border-emerald-200">
                      Resolu
                    </Badge>
                  )}
                </div>

                {/* Show images for validation type */}
                {req.type === "validation" && req.images && req.images.length > 0 && (
                  <OptionImageGallery images={req.images} />
                )}

                {/* Show options for vote type (only when resolved or step not open — otherwise vote form shows them) */}
                {req.type === "vote" && req.options && req.options.length > 0 && (req.resolved || step.status !== "open") && (
                  <div className="space-y-1.5">
                    {req.options.map((opt) => (
                      <div key={opt.id} className="flex items-center gap-2 text-xs font-body p-2 bg-secondary/20 rounded-lg border border-border/40">
                        <span className="font-display font-semibold">{opt.label}</span>
                        {opt.isRecommended && (
                          <Badge className="text-[8px] bg-amber-100 text-amber-700 border-amber-200">Recommande</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Vote tally */}
                {votes.length > 0 && req.type === "vote" && (
                  <VoteTally votes={votes} options={req.options} />
                )}

                {/* Approval vote tally */}
                {votes.length > 0 && req.type === "validation" && (
                  <div className="text-xs font-body space-y-1 mt-1">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                      Avis ({votes.length})
                    </p>
                    {votes.map((v) => (
                      <div key={v.id} className="flex items-center gap-2">
                        <span className="font-medium">{v.name}</span>
                        {v.vote === "approve" && <Badge className="text-[8px] bg-emerald-50 text-emerald-600">Approuve</Badge>}
                        {v.vote === "revise" && <Badge className="text-[8px] bg-amber-50 text-amber-600">A reviser</Badge>}
                        {v.comment && <span className="text-muted-foreground truncate">{v.comment}</span>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Vote form (only for open steps with unresolved requests) */}
                {!req.resolved && step.status === "open" && (req.type === "vote" || req.type === "validation") && (
                  <StakeholderVoteForm
                    request={req}
                    stepId={step.id}
                    stakeholderName={stakeholderName}
                    onVoted={onRefresh}
                  />
                )}
              </div>
            );
          })}

          {/* Comments section */}
          {step.status === "open" && (
            <div className="pt-3 border-t border-border/30 space-y-2">
              <p className="text-[10px] font-body font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <MessageSquare size={10} />
                Commentaires ({step.comments.length})
              </p>

              {step.comments.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {step.comments.map((c) => (
                    <div key={c.id} className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded-full bg-secondary/60 flex items-center justify-center shrink-0">
                        <Users size={10} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-body font-semibold">{c.authorName}</span>
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString("fr-CH")}
                          </span>
                        </div>
                        <p className="text-[11px] font-body text-foreground/70">{c.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <Input
                  value={commentMsg}
                  onChange={(e) => setCommentMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                  placeholder="Votre commentaire..."
                  className="text-xs h-8 flex-1"
                />
                <Button size="sm" onClick={handleAddComment} disabled={!commentMsg.trim() || submittingComment} className="h-8 px-2.5">
                  {submittingComment ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──

export default function StakeholderView() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<StakeholderProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [stakeholderName, setStakeholderName] = useState(() =>
    localStorage.getItem("kojima-stakeholder-name") ?? ""
  );
  const [nameInput, setNameInput] = useState("");

  const fetchData = useCallback(() => {
    if (!token) return;
    getProjectByShareToken(token, stakeholderName || undefined)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token, stakeholderName]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={24} className="text-muted-foreground" />
          </div>
          <p className="font-display text-xl text-foreground font-bold mb-2">Lien invalide</p>
          <p className="font-body text-sm text-muted-foreground">Ce lien de partage est invalide ou a expire.</p>
        </div>
      </div>
    );
  }

  function handleSetName() {
    const name = nameInput.trim();
    if (!name) return;
    setStakeholderName(name);
    localStorage.setItem("kojima-stakeholder-name", name);
  }

  const phases = data.phases;
  const steps = data.steps;
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);

  // Group by phase
  const stepsByPhase: Record<string, StakeholderStep[]> = {};
  const unphased: StakeholderStep[] = [];
  for (const step of sortedSteps) {
    if (step.phaseId) {
      if (!stepsByPhase[step.phaseId]) stepsByPhase[step.phaseId] = [];
      stepsByPhase[step.phaseId].push(step);
    } else {
      unphased.push(step);
    }
  }

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const openCount = steps.filter((s) => s.status === "open").length;
  const progress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-display text-xl md:text-2xl font-bold text-foreground">
            {data.projectTitle}
          </h1>
          <p className="font-body text-sm text-muted-foreground">
            Vue de suivi du projet
          </p>
        </div>

        {/* Name gate */}
        {!stakeholderName ? (
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <p className="text-sm font-body text-foreground/70">
              Entrez votre nom pour participer aux discussions :
            </p>
            <div className="flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Votre nom..."
                className="flex-1 text-sm font-body bg-background border border-border/50 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              />
              <button
                onClick={handleSetName}
                disabled={!nameInput.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 transition-colors hover:bg-primary/90"
              >
                Continuer
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Consolidation reminder */}
            <div className="bg-violet-50/60 border border-violet-200/40 rounded-xl p-4 flex items-start gap-3">
              <Users size={16} className="text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-display font-semibold text-violet-700">Avis des parties prenantes</p>
                <p className="text-[11px] font-body text-violet-600/80 mt-0.5">
                  Votez sur les etapes en cours et partagez vos commentaires. Le client consolidera les retours avant de prendre sa decision.
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground/40 font-body">
              Connecte en tant que <strong className="text-foreground/60">{stakeholderName}</strong>
              <button
                onClick={() => { setStakeholderName(""); localStorage.removeItem("kojima-stakeholder-name"); }}
                className="ml-2 text-primary/60 hover:text-primary underline"
              >
                Changer de personne
              </button>
            </p>
            {/* Progress */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-body">
                <span className="text-muted-foreground">Progression</span>
                <span className="font-semibold">{completedCount}/{steps.length} etapes</span>
              </div>
              <div className="h-2 bg-secondary/50 rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              {openCount > 0 && (
                <p className="text-[10px] font-body text-primary font-medium">
                  {openCount} etape{openCount > 1 ? "s" : ""} en cours - votre avis est attendu
                </p>
              )}
            </div>

            {/* Steps by phase */}
            {phases.map((phase) => {
              const phaseSteps = stepsByPhase[phase.id] || [];
              if (phaseSteps.length === 0) return null;
              return (
                <div key={phase.id}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-0.5 h-4 rounded-full bg-primary/40" />
                    <h2 className="font-display text-xs font-bold text-foreground/70 uppercase tracking-wider">
                      {phase.title}
                    </h2>
                  </div>
                  <div className="space-y-2">
                    {phaseSteps.map((step) => (
                      <StakeholderStepCard
                        key={step.id}
                        step={step}
                        phaseTitle={phase.title}
                        stakeholderName={stakeholderName}
                        onRefresh={fetchData}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Unphased steps */}
            {unphased.length > 0 && (
              <div>
                {phases.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-0.5 h-4 rounded-full bg-muted-foreground/20" />
                    <h2 className="font-display text-xs font-bold text-muted-foreground/60 uppercase tracking-wider">
                      Autres etapes
                    </h2>
                  </div>
                )}
                <div className="space-y-2">
                  {unphased.map((step) => (
                    <StakeholderStepCard
                      key={step.id}
                      step={step}
                      stakeholderName={stakeholderName}
                      onRefresh={fetchData}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
