import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, CheckCircle2, AlertCircle, Send,
  Star, Loader2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useProjects } from "@/contexts/ProjectsContext";
import type { FeedbackRequest, VoteOption } from "@/types/timeline";
import { OptionImageGallery } from "@/components/funnel/OptionImageGallery";
import { RevisionCounter } from "@/components/feedback/RevisionCounter";
import { FeedbackAuditLog } from "@/components/feedback/FeedbackAuditLog";
import { StakeholderVoteSummary } from "@/components/feedback/StakeholderVoteSummary";

export default function FeedbackDecisionPage() {
  const { id: projectId, taskId, requestId } = useParams<{ id: string; taskId: string; requestId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getProject, respondToFeedbackRequest, loading } = useProjects();

  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const project = getProject(projectId!);
  const task = project?.tasks.find((t) => t.id === taskId);
  const request = task?.feedbackRequests?.find((r) => r.id === requestId);

  // Set initial selected option (if already selected)
  useEffect(() => {
    if (request?.response) {
      const opt = request.options?.find((o) => o.label === request.response);
      if (opt) setSelected(opt.id);
    }
  }, [request?.id]);

  const backPath = `/client/${projectId}`;

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground/30" />
      </div>
    );
  }

  // Not found
  if (!project || !task || !request || request.type !== "vote") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <AlertCircle size={32} className="text-muted-foreground/20 mx-auto" />
          <p className="font-display text-lg font-bold text-foreground/80">Choix introuvable</p>
          <p className="text-sm text-muted-foreground font-body">Cette demande n'existe pas ou n'est plus disponible.</p>
          <button onClick={() => navigate(backPath)} className="text-sm text-primary font-body hover:underline">
            ← Retour au projet
          </button>
        </div>
      </div>
    );
  }

  const options: VoteOption[] = request.options || [];
  const isResolved = request.resolved;

  // Deadline calculation
  const deadlineDays = request.deadline
    ? Math.ceil((new Date(request.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isOverdue = deadlineDays !== null && deadlineDays < 0;
  const isUrgent = deadlineDays !== null && deadlineDays <= 3 && deadlineDays >= 0;

  const getOptionImages = (opt: VoteOption): string[] => {
    if (opt.images && opt.images.length > 0) return opt.images;
    if (opt.imageUrl) return [opt.imageUrl];
    return [];
  };

  function handleSelect(optionId: string) {
    if (isResolved) return;
    setSelected(optionId);
  }

  async function handleConfirm() {
    if (!selected) {
      toast({ title: "Sélectionnez une option d'abord" });
      return;
    }
    const opt = options.find((o) => o.id === selected);
    if (!opt) return;
    setBusy(true);
    try {
      respondToFeedbackRequest(projectId!, taskId!, requestId!, opt.label);
      toast({ title: "Choix confirme !", description: `Direction choisie : "${opt.label}". L'equipe va affiner dans cette direction.` });
      navigate(backPath);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">

        {/* Back link */}
        <button
          onClick={() => navigate(backPath)}
          className="flex items-center gap-1 text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Retour au projet
        </button>

        {/* Header */}
        <div className="space-y-2">
          <p className="text-xs font-body text-muted-foreground/50 uppercase tracking-wider">
            {task.title}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground">
            Quelle direction préférez-vous ?
          </h1>
          <p className="font-display text-base sm:text-lg text-muted-foreground/60">
            {request.message}
          </p>
          <p className="text-sm font-body text-muted-foreground/40 mt-1">
            Ce choix definit la direction — nous affinerons les details ensemble par la suite.
          </p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2">
          {isResolved && (
            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 gap-1">
              <CheckCircle2 size={12} /> Choix confirmé
              {request.respondedAt && ` le ${new Date(request.respondedAt).toLocaleDateString("fr-CH")}`}
            </Badge>
          )}
          {request.deadline && (
            <Badge variant="secondary" className={cn(
              "text-xs gap-1",
              isOverdue ? "bg-red-100 text-red-700" :
              isUrgent ? "bg-amber-100 text-amber-700" :
              "bg-secondary text-muted-foreground",
            )}>
              Echéance : {new Date(request.deadline).toLocaleDateString("fr-CH")}
              {deadlineDays !== null && (
                isOverdue ? " (dépassée)" :
                deadlineDays === 0 ? " (aujourd'hui)" :
                ` (${deadlineDays}j)`
              )}
            </Badge>
          )}
          {request.revisionLimit != null && (
            <RevisionCounter current={request.revisionCount ?? 0} limit={request.revisionLimit} compact />
          )}
        </div>

        {/* Options comparison grid */}
        <div className={cn(
          "grid gap-4 sm:gap-5",
          options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" :
          options.length === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
          "grid-cols-1 sm:grid-cols-2",
        )}>
          {options.map((opt) => {
            const isSelected = selected === opt.id;
            const optImages = getOptionImages(opt);

            return (
              <div
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={cn(
                  "relative flex flex-col rounded-2xl border-2 overflow-hidden transition-all",
                  !isResolved && "cursor-pointer",
                  isSelected
                    ? "border-palette-violet bg-palette-violet/[0.02] shadow-lg ring-1 ring-palette-violet/20"
                    : isResolved && opt.label === request.response
                      ? "border-emerald-300 bg-emerald-50/30"
                      : opt.isRecommended
                        ? "border-amber-300 bg-amber-50/20 hover:border-amber-400"
                        : "border-border/40 hover:border-border hover:shadow-sm",
                )}
              >
                {/* Recommended badge */}
                {opt.isRecommended && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[10px] font-body font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full shadow-sm">
                    <Star size={10} className="fill-amber-500" /> Recommandé
                  </div>
                )}

                {/* Selected indicator */}
                {isSelected && (
                  <div className="absolute top-3 left-3 z-10">
                    <div className="w-6 h-6 rounded-full bg-palette-violet flex items-center justify-center shadow-sm">
                      <CheckCircle2 size={14} className="text-white" />
                    </div>
                  </div>
                )}

                {/* Image gallery */}
                {optImages.length > 0 && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <OptionImageGallery
                      images={optImages}
                      alt={opt.label}
                      variant="full"
                    />
                  </div>
                )}

                {/* Content */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col">
                  <h3 className="font-display text-lg font-bold text-foreground mb-1">
                    {opt.label}
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
                      className="inline-flex items-center gap-1.5 text-sm font-body text-primary hover:text-primary/80 transition-colors mt-auto"
                    >
                      Voir l'aperçu <ExternalLink size={12} />
                    </a>
                  )}
                </div>

                {/* Selection radio at bottom */}
                <div className={cn(
                  "px-4 sm:px-5 py-3 border-t",
                  isSelected ? "border-palette-violet/20 bg-palette-violet/5" : "border-border/30",
                )}>
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isSelected ? "border-palette-violet bg-palette-violet" : "border-border",
                    )}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <span className={cn(
                      "text-sm font-body",
                      isSelected ? "font-semibold text-palette-violet" : "text-muted-foreground",
                    )}>
                      {isSelected ? "Sélectionné" : "Choisir cette option"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Stakeholder votes */}
        {request.stakeholderVotes && request.stakeholderVotes.length > 0 && (
          <StakeholderVoteSummary votes={request.stakeholderVotes} options={request.options} type="vote" />
        )}

        {/* Confirm button */}
        {!isResolved && (
          <div className="sticky bottom-6 z-20">
            <Button
              size="lg"
              className="w-full gap-2 h-12 text-base shadow-lg"
              disabled={!selected || busy}
              onClick={handleConfirm}
            >
              {busy ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              {selected
                ? `Confirmer : ${options.find((o) => o.id === selected)?.label}`
                : "Sélectionnez une option ci-dessus"
              }
            </Button>
          </div>
        )}

        {/* Resolved summary */}
        {isResolved && request.response && (
          <div className="bg-emerald-50 border border-emerald-200/50 rounded-xl p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <CheckCircle2 size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="font-display text-sm font-bold text-emerald-800">
                Choix confirmé : {request.response}
              </p>
              {request.respondedAt && (
                <p className="font-body text-xs text-emerald-600/70">
                  {new Date(request.respondedAt).toLocaleDateString("fr-CH", {
                    day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Audit log */}
        {request.responseHistory && request.responseHistory.length > 0 && (
          <FeedbackAuditLog history={request.responseHistory} defaultExpanded />
        )}

        {/* Footer */}
        <div className="pt-6 border-t border-border text-center">
          <button
            onClick={() => navigate(backPath)}
            className="text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Retour au tableau de bord
          </button>
        </div>
      </div>
    </div>
  );
}
