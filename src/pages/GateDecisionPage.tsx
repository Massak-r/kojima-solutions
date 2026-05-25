import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, CheckCircle2, AlertCircle, AlertTriangle, Send,
  Star, Clock, Loader2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getFunnelByProject, getFunnelByShareToken,
  approveGate, selectOption, requestRevision, addGateComment,
  type ProjectFunnel, type FunnelGate, type GateOption, type GateComment,
} from "@/api/funnels";
import { OptionImageGallery } from "@/components/funnel/OptionImageGallery";
import { SlideToConfirm } from "@/components/feedback/SlideToConfirm";
import { useLanguage } from "@/hooks/useLanguage";
import { formatDateSwiss, formatDateTime } from "@/lib/dateFormat";

function typeLabel(gateType: string, t: (fr: string, en: string) => string): string {
  switch (gateType) {
    case "choice":   return t("Quelle direction préférez-vous ?", "Which direction do you prefer?");
    case "approval": return t("Validation requise", "Approval required");
    case "feedback": return t("Votre retour est attendu", "Your feedback is awaited");
    default:         return t("Votre avis est attendu", "Your input is awaited");
  }
}

export default function GateDecisionPage() {
  const { id: projectId, gateId, token } = useParams<{ id?: string; gateId: string; token?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [funnel, setFunnel] = useState<ProjectFunnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [showRevisionInput, setShowRevisionInput] = useState(false);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [commentText, setCommentText] = useState("");

  const fetchFunnel = useCallback(async () => {
    try {
      const f = token
        ? await getFunnelByShareToken(token)
        : projectId
          ? await getFunnelByProject(projectId)
          : null;
      setFunnel(f);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

  // Find the gate in the nested funnel structure
  const gate = funnel?.phases
    .flatMap((p) => p.gates.map((g) => ({ ...g, phaseTitle: p.title })))
    .find((g) => g.id === gateId) as (FunnelGate & { phaseTitle: string }) | undefined;

  // Set initial selected option
  useEffect(() => {
    if (gate) {
      const selected = gate.options.find((o) => o.isSelected);
      if (selected) setSelectedOptionId(selected.id);
    }
  }, [gate?.id]);

  const isOpen = gate?.status === "open";
  const isApproved = gate?.status === "approved";
  const isRevision = gate?.status === "revision";
  const backPath = token
    ? `/funnel/s/${token}`
    : `/client/${projectId}`;

  async function handleSelectOption(optionId: string) {
    if (!isOpen || !gate) return;
    setSelectedOptionId(optionId);
    try { navigator.vibrate?.(6); } catch { /* ignore */ }
    try {
      await selectOption(gate.id, optionId);
    } catch {
      toast({ title: t("Erreur", "Error"), variant: "destructive" });
    }
  }

  async function handleApprove() {
    if (!isOpen || !gate) return;
    if (gate.gateType === "choice" && !selectedOptionId) {
      toast({ title: t("Sélectionnez une option d'abord", "Select an option first") });
      return;
    }
    setBusy(true);
    try {
      await approveGate(gate.id, "client");
      try { navigator.vibrate?.(20); } catch { /* ignore */ }
      toast({ title: t("Étape validée !", "Step approved!") });
      fetchFunnel();
    } catch (err: any) {
      toast({ title: t("Erreur", "Error"), description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleRevision() {
    if (!revisionMessage.trim() || !gate) return;
    setBusy(true);
    try {
      const res = await requestRevision(gate.id, { message: revisionMessage.trim() });
      if (res.overLimit) {
        toast({
          title: t("Limite de révisions atteinte", "Revision limit reached"),
          description: t("Un ajustement budgétaire sera proposé.", "A budget adjustment will be proposed."),
          variant: "destructive",
        });
      } else {
        toast({ title: t("Révision demandée", "Revision requested") });
      }
      setRevisionMessage("");
      setShowRevisionInput(false);
      fetchFunnel();
    } catch {
      toast({ title: t("Erreur", "Error"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  async function handleComment() {
    if (!commentText.trim() || !gate) return;
    setBusy(true);
    try {
      await addGateComment(gate.id, { message: commentText.trim(), authorRole: "client" });
      setCommentText("");
      fetchFunnel();
    } catch {
      toast({ title: t("Erreur", "Error"), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground/30" />
      </div>
    );
  }

  // Error / not found
  if (error || !funnel || !gate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <AlertCircle size={32} className="text-muted-foreground/20 mx-auto" />
          <p className="font-display text-lg font-bold text-foreground/80">
            {t("Décision introuvable", "Decision not found")}
          </p>
          <p className="text-sm text-muted-foreground font-body">
            {t("Cette étape n'existe pas ou n'est plus disponible.", "This step doesn't exist or is no longer available.")}
          </p>
          <button onClick={() => navigate(backPath)} className="text-sm text-primary font-body hover:underline">
            ← {t("Retour au projet", "Back to project")}
          </button>
        </div>
      </div>
    );
  }

  // Deadline calculation
  const deadlineDays = gate.deadline
    ? Math.ceil((new Date(gate.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isOverdue = deadlineDays !== null && deadlineDays < 0;
  const isUrgent = deadlineDays !== null && deadlineDays <= 3 && deadlineDays >= 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">

        {/* Back link */}
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-1 text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> {t("Retour au projet", "Back to project")}
        </button>

        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-body text-muted-foreground/50 uppercase tracking-wider">
            {gate.phaseTitle}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            {gate.title}
          </h1>
          <p className="font-display text-base sm:text-lg text-muted-foreground/60">
            {typeLabel(gate.gateType, t)}
          </p>
          {gate.description && (
            <p className="text-sm font-body text-foreground/60 max-w-2xl leading-relaxed mt-1">
              {gate.description}
            </p>
          )}
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2">
          {isApproved && (
            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 gap-1">
              <CheckCircle2 size={12} /> {t("Validé", "Approved")}
              {gate.approvedAt && ` ${t("le", "on")} ${formatDateSwiss(gate.approvedAt)}`}
              {gate.approvedBy && ` ${t("par", "by")} ${gate.approvedBy}`}
            </Badge>
          )}
          {isRevision && (
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300 gap-1">
              <AlertTriangle size={12} /> {t("Révision en cours", "Revision in progress")} ({gate.revisionCount}/{gate.revisionLimit})
            </Badge>
          )}
          {gate.deadline && (
            <Badge variant="secondary" className={cn(
              "text-xs gap-1",
              isOverdue ? "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" :
              isUrgent ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" :
              "bg-secondary text-muted-foreground",
            )}>
              <Clock size={10} />
              {t("Échéance", "Deadline")} : {formatDateSwiss(gate.deadline)}
              {deadlineDays !== null && (
                isOverdue ? ` (${t("dépassée", "overdue")})` :
                deadlineDays === 0 ? ` (${t("aujourd'hui", "today")})` :
                ` (${deadlineDays}${t("j", "d")})`
              )}
            </Badge>
          )}
        </div>

        {/* Options comparison grid */}
        {gate.gateType === "choice" && gate.options.length > 0 && (
          <div className={cn(
            "grid gap-4 sm:gap-5",
            gate.options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" :
            gate.options.length === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
            "grid-cols-1 sm:grid-cols-2",
          )}>
            {gate.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              const optImages = opt.images?.length > 0 ? opt.images : opt.imageUrl ? [opt.imageUrl] : [];

              return (
                <div
                  key={opt.id}
                  onClick={() => isOpen && handleSelectOption(opt.id)}
                  className={cn(
                    "relative flex flex-col rounded-2xl border-2 overflow-hidden transition-all",
                    isOpen && "cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary/[0.02] shadow-lg ring-1 ring-primary/20"
                      : isApproved && opt.isSelected
                        ? "border-emerald-300 bg-emerald-50/30"
                        : opt.isRecommended
                          ? "border-amber-300 bg-amber-50/20 hover:border-amber-400"
                          : "border-border/40 hover:border-border hover:shadow-sm",
                  )}
                >
                  {/* Recommended badge */}
                  {opt.isRecommended && (
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[10px] font-body font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30 px-2 py-0.5 rounded-full shadow-sm">
                      <Star size={10} className="fill-amber-500" /> {t("Recommandé", "Recommended")}
                    </div>
                  )}

                  {/* Selected indicator */}
                  {isSelected && (
                    <div className="absolute top-3 left-3 z-10">
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                        <CheckCircle2 size={14} className="text-white" />
                      </div>
                    </div>
                  )}

                  {/* Image gallery */}
                  {optImages.length > 0 && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <OptionImageGallery
                        images={optImages}
                        alt={opt.title}
                        variant="full"
                      />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4 sm:p-5 flex-1 flex flex-col">
                    <h3 className="font-display text-lg font-bold text-foreground mb-1">
                      {opt.title}
                    </h3>
                    {opt.description && (
                      <p className="text-sm font-body text-muted-foreground/70 leading-relaxed mb-3 flex-1">
                        {opt.description}
                      </p>
                    )}

                    {opt.linkUrl && (
                      <a
                        href={opt.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-body mb-3"
                      >
                        <ExternalLink size={11} /> {t("Voir l'aperçu", "View preview")}
                      </a>
                    )}

                    {/* Selection radio */}
                    {isOpen && (
                      <div className={cn(
                        "flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 mt-auto transition-all",
                        isSelected
                          ? "border-primary bg-primary text-white"
                          : "border-border/40 text-muted-foreground hover:border-primary/40",
                      )}>
                        <div className={cn(
                          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                          isSelected ? "border-white" : "border-current",
                        )}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                        </div>
                        <span className="text-sm font-body font-medium">
                          {isSelected ? t("Sélectionné", "Selected") : t("Sélectionner", "Select")}
                        </span>
                      </div>
                    )}

                    {/* Approved selection indicator */}
                    {isApproved && opt.isSelected && (
                      <div className="flex items-center gap-2 py-2 text-emerald-700 dark:text-emerald-300 text-sm font-body mt-auto">
                        <CheckCircle2 size={14} /> {t("Choix validé", "Choice approved")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Approval-only gate (no options) */}
        {gate.gateType === "approval" && isOpen && (
          <div className="bg-card border border-border rounded-xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-500/15 flex items-center justify-center mx-auto">
              <CheckCircle2 size={22} className="text-blue-600 dark:text-blue-300" />
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              {t("Cette étape est prête pour votre validation", "This step is ready for your approval")}
            </p>
            <p className="text-sm font-body text-muted-foreground max-w-md mx-auto">
              {t(
                "Validez pour confirmer et passer à la suite, ou demandez des modifications si nécessaire.",
                "Approve to confirm and move on, or request changes if needed.",
              )}
            </p>
          </div>
        )}

        {/* Revision info */}
        {isRevision && (
          <div className="bg-amber-50 border border-amber-200/50 dark:bg-amber-500/10 dark:border-amber-500/30 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 dark:text-amber-300 shrink-0 mt-0.5" />
              <div>
                <p className="font-display text-sm font-bold text-amber-800 dark:text-amber-200">
                  {t("Révision en cours", "Revision in progress")}
                </p>
                <p className="text-xs font-body text-amber-700/70 dark:text-amber-300/70 mt-1">
                  {t("L'équipe travaille sur vos retours.", "The team is working on your feedback.")} {t("Révision", "Revision")} {gate.revisionCount}/{gate.revisionLimit}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Revision limit warning */}
        {(isOpen || isRevision) && gate.gateType !== "feedback" && gate.revisionLimit > 0 && gate.revisionCount >= gate.revisionLimit - 1 && (
          <div className={cn(
            "rounded-xl p-4 text-xs font-body flex items-start gap-2",
            gate.revisionCount >= gate.revisionLimit
              ? "bg-red-50 border border-red-200/50 text-red-700 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-300"
              : "bg-amber-50 border border-amber-200/50 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/30 dark:text-amber-300",
          )}>
            {gate.revisionCount >= gate.revisionLimit ? (
              <AlertCircle size={14} className="text-red-500 dark:text-red-300 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={14} className="text-amber-500 dark:text-amber-300 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">
                {gate.revisionCount}/{gate.revisionLimit}{" "}
                {t(
                  `révision${gate.revisionLimit > 1 ? "s" : ""} utilisée${gate.revisionCount > 1 ? "s" : ""}`,
                  `revision${gate.revisionLimit > 1 ? "s" : ""} used`,
                )}
              </p>
              {gate.revisionCount >= gate.revisionLimit ? (
                <p className="mt-0.5 opacity-70">
                  {t(
                    "Limite atteinte. Les prochaines révisions feront l'objet d'un ajustement tarifaire.",
                    "Limit reached. Further revisions will trigger a pricing adjustment.",
                  )}
                </p>
              ) : (
                <p className="mt-0.5 opacity-70">
                  {t(
                    "Dernière révision incluse. Les suivantes pourront faire l'objet d'un ajustement tarifaire.",
                    "Last included revision. Further ones may trigger a pricing adjustment.",
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isOpen && (() => {
          const approveDisabled = busy || (gate.gateType === "choice" && !selectedOptionId);
          const approveLabel = gate.gateType === "choice"
            ? (selectedOptionId
                ? t("Valider mon choix", "Confirm my choice")
                : t("Sélectionnez une option", "Select an option"))
            : gate.gateType === "feedback"
              ? t("Envoyer", "Send")
              : t("Approuver", "Approve");
          const slideLabel = gate.gateType === "choice" && !selectedOptionId
            ? t("Sélectionnez une option ci-dessus", "Select an option above")
            : t("Glisser pour confirmer", "Slide to confirm");
          return (
            <div className="space-y-3">
              {/* Mobile: slide-to-confirm — a deliberate commitment gesture. */}
              <div className="sm:hidden">
                <SlideToConfirm
                  label={slideLabel}
                  confirmingLabel={t("Confirmation…", "Confirming…")}
                  confirmedLabel={t("Confirmé", "Confirmed")}
                  loading={busy}
                  disabled={approveDisabled}
                  onConfirm={handleApprove}
                />
              </div>

              {/* Desktop: standard button. Also a11y/keyboard fallback on mobile. */}
              <div className="hidden sm:flex flex-wrap items-center gap-3">
                <Button
                  size="lg"
                  onClick={handleApprove}
                  disabled={approveDisabled}
                  className="text-sm h-12 px-6 gap-2"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  {approveLabel}
                </Button>
                {gate.gateType !== "feedback" && !showRevisionInput && (
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setShowRevisionInput(true)}
                    className="text-sm h-12 text-amber-600 border-amber-200 hover:bg-amber-50 dark:text-amber-300 dark:border-amber-500/30 dark:hover:bg-amber-500/10 gap-2"
                  >
                    <AlertTriangle size={14} /> {t("Demander des modifications", "Request changes")}
                  </Button>
                )}
              </div>

              {/* Mobile-only revision trigger sits below the slide. */}
              {gate.gateType !== "feedback" && !showRevisionInput && (
                <button
                  type="button"
                  onClick={() => setShowRevisionInput(true)}
                  className="sm:hidden w-full flex items-center justify-center gap-2 text-sm font-body text-amber-600 dark:text-amber-300 py-2.5"
                >
                  <AlertTriangle size={14} /> {t("Demander des modifications", "Request changes")}
                </button>
              )}

              {showRevisionInput && (
                <div className="flex flex-col sm:flex-row gap-2 bg-amber-50/50 border border-amber-200/30 dark:bg-amber-500/5 dark:border-amber-500/20 rounded-xl p-3">
                  <input
                    value={revisionMessage}
                    onChange={(e) => setRevisionMessage(e.target.value)}
                    placeholder={t("Décrivez les modifications souhaitées…", "Describe the changes you'd like…")}
                    className="flex-1 text-sm font-body bg-background border border-border/50 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    onKeyDown={(e) => e.key === "Enter" && handleRevision()}
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleRevision} disabled={busy || !revisionMessage.trim()} className="text-xs gap-1">
                      <Send size={10} /> {t("Envoyer", "Send")}
                    </Button>
                    <button onClick={() => setShowRevisionInput(false)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground">
                      {t("Annuler", "Cancel")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        {/* Comments section */}
        {(gate.comments.length > 0 || isOpen || isRevision) && (
          <div className="border-t border-border/30 pt-6 space-y-3">
            <h3 className="text-xs font-display font-bold text-muted-foreground/50 uppercase tracking-wider">
              {t("Commentaires", "Comments")} ({gate.comments.length})
            </h3>

            {gate.comments.length > 0 && (
              <div className="space-y-2">
                {gate.comments.map((comment) => (
                  <CommentBubble key={comment.id} comment={comment} t={t} />
                ))}
              </div>
            )}

            {(isOpen || isRevision) && (
              <div className="flex items-center gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={t("Ajouter un commentaire…", "Add a comment…")}
                  className="flex-1 min-w-0 text-sm font-body bg-card border border-border/40 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                />
                <button
                  onClick={handleComment}
                  disabled={busy || !commentText.trim()}
                  className="p-2.5 text-primary/60 hover:text-primary disabled:opacity-30 transition-colors shrink-0"
                >
                  <Send size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pt-6 pb-4">
          <p className="text-[10px] text-muted-foreground/25 font-body">
            Kojima Solutions · kojima-solutions.ch
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Comment Bubble ─────────────────────────────────────────

function CommentBubble({ comment, t }: { comment: GateComment; t: (fr: string, en: string) => string }) {
  const isAdmin = comment.authorRole === "admin";
  return (
    <div className={cn(
      "flex flex-col max-w-[85%] rounded-xl px-4 py-2.5 break-words",
      isAdmin ? "bg-secondary/40 self-start" : "bg-primary/5 self-end ml-auto",
    )}>
      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
        <span className="text-[10px] font-body font-medium text-foreground/60">
          {comment.authorName || (isAdmin ? t("Équipe", "Team") : t("Client", "Client"))}
        </span>
        <span className="text-[10px] text-muted-foreground/40 font-body">
          {formatDateTime(comment.createdAt)}
        </span>
      </div>
      <p className="text-sm font-body text-foreground/70 break-words">{comment.message}</p>
    </div>
  );
}
