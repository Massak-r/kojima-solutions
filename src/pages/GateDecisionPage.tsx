import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ChevronLeft, CheckCircle2, AlertCircle, AlertTriangle, Send,
  Star, Clock, Loader2, ExternalLink, MessageSquare, List,
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

const TYPE_LABELS: Record<string, string> = {
  choice: "Quelle direction preferez-vous ?",
  approval: "Validation requise",
  feedback: "Votre retour est attendu",
};

export default function GateDecisionPage() {
  const { id: projectId, gateId, token } = useParams<{ id?: string; gateId: string; token?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    try {
      await selectOption(gate.id, optionId);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  }

  async function handleApprove() {
    if (!isOpen || !gate) return;
    if (gate.gateType === "choice" && !selectedOptionId) {
      toast({ title: "Selectionnez une option d'abord" });
      return;
    }
    setBusy(true);
    try {
      await approveGate(gate.id, "client");
      toast({ title: "Etape validee !" });
      fetchFunnel();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
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
        toast({ title: "Limite de revisions atteinte", description: "Un ajustement budgetaire sera propose.", variant: "destructive" });
      } else {
        toast({ title: "Revision demandee" });
      }
      setRevisionMessage("");
      setShowRevisionInput(false);
      fetchFunnel();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
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
      toast({ title: "Erreur", variant: "destructive" });
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
          <p className="font-display text-lg font-bold text-foreground/80">Decision introuvable</p>
          <p className="text-sm text-muted-foreground font-body">Cette etape n'existe pas ou n'est plus disponible.</p>
          <button onClick={() => navigate(backPath)} className="text-sm text-primary font-body hover:underline">
            ← Retour au projet
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
          <ChevronLeft size={14} /> Retour au projet
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
            {TYPE_LABELS[gate.gateType] || "Votre avis est attendu"}
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
            <Badge variant="secondary" className="text-xs bg-emerald-100 text-emerald-700 gap-1">
              <CheckCircle2 size={12} /> Valide
              {gate.approvedAt && ` le ${new Date(gate.approvedAt).toLocaleDateString("fr-CH")}`}
              {gate.approvedBy && ` par ${gate.approvedBy}`}
            </Badge>
          )}
          {isRevision && (
            <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 gap-1">
              <AlertTriangle size={12} /> Revision en cours ({gate.revisionCount}/{gate.revisionLimit})
            </Badge>
          )}
          {gate.deadline && (
            <Badge variant="secondary" className={cn(
              "text-xs gap-1",
              isOverdue ? "bg-red-100 text-red-700" :
              isUrgent ? "bg-amber-100 text-amber-700" :
              "bg-secondary text-muted-foreground",
            )}>
              <Clock size={10} />
              Echeance : {new Date(gate.deadline).toLocaleDateString("fr-CH")}
              {deadlineDays !== null && (
                isOverdue ? " (depassee)" :
                deadlineDays === 0 ? " (aujourd'hui)" :
                ` (${deadlineDays}j)`
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
                    <div className="absolute top-3 right-3 z-10 flex items-center gap-1 text-[10px] font-body font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-full shadow-sm">
                      <Star size={10} className="fill-amber-500" /> Recommande
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
                        <ExternalLink size={11} /> Voir l'apercu
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
                          {isSelected ? "Selectionne" : "Selectionner"}
                        </span>
                      </div>
                    )}

                    {/* Approved selection indicator */}
                    {isApproved && opt.isSelected && (
                      <div className="flex items-center gap-2 py-2 text-emerald-700 text-sm font-body mt-auto">
                        <CheckCircle2 size={14} /> Choix valide
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
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto">
              <CheckCircle2 size={22} className="text-blue-600" />
            </div>
            <p className="font-display text-base font-semibold text-foreground">
              Cette etape est prete pour votre validation
            </p>
            <p className="text-sm font-body text-muted-foreground max-w-md mx-auto">
              Validez pour confirmer et passer a la suite, ou demandez des modifications si necessaire.
            </p>
          </div>
        )}

        {/* Revision info */}
        {isRevision && (
          <div className="bg-amber-50 border border-amber-200/50 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-display text-sm font-bold text-amber-800">Revision en cours</p>
                <p className="text-xs font-body text-amber-700/70 mt-1">
                  L'equipe travaille sur vos retours. Revision {gate.revisionCount}/{gate.revisionLimit}.
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
              ? "bg-red-50 border border-red-200/50 text-red-700"
              : "bg-amber-50 border border-amber-200/50 text-amber-700",
          )}>
            {gate.revisionCount >= gate.revisionLimit ? (
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-medium">{gate.revisionCount}/{gate.revisionLimit} revision{gate.revisionLimit > 1 ? "s" : ""} utilisee{gate.revisionCount > 1 ? "s" : ""}</p>
              {gate.revisionCount >= gate.revisionLimit ? (
                <p className="mt-0.5 opacity-70">Limite atteinte. Les prochaines revisions feront l'objet d'un ajustement tarifaire.</p>
              ) : (
                <p className="mt-0.5 opacity-70">Derniere revision incluse. Les suivantes pourront faire l'objet d'un ajustement tarifaire.</p>
              )}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {isOpen && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={handleApprove}
                disabled={busy || (gate.gateType === "choice" && !selectedOptionId)}
                className="text-sm h-12 px-6 gap-2"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {gate.gateType === "choice"
                  ? (selectedOptionId ? "Valider mon choix" : "Selectionnez une option")
                  : gate.gateType === "feedback" ? "Envoyer" : "Approuver"}
              </Button>
              {gate.gateType !== "feedback" && !showRevisionInput && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setShowRevisionInput(true)}
                  className="text-sm h-12 text-amber-600 border-amber-200 hover:bg-amber-50 gap-2"
                >
                  <AlertTriangle size={14} /> Demander des modifications
                </Button>
              )}
            </div>

            {showRevisionInput && (
              <div className="flex flex-col sm:flex-row gap-2 bg-amber-50/50 border border-amber-200/30 rounded-xl p-3">
                <input
                  value={revisionMessage}
                  onChange={(e) => setRevisionMessage(e.target.value)}
                  placeholder="Decrivez les modifications souhaitees..."
                  className="flex-1 text-sm font-body bg-background border border-border/50 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onKeyDown={(e) => e.key === "Enter" && handleRevision()}
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={handleRevision} disabled={busy || !revisionMessage.trim()} className="text-xs gap-1">
                    <Send size={10} /> Envoyer
                  </Button>
                  <button onClick={() => setShowRevisionInput(false)} className="text-xs text-muted-foreground/50 hover:text-muted-foreground">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comments section */}
        {(gate.comments.length > 0 || isOpen || isRevision) && (
          <div className="border-t border-border/30 pt-6 space-y-3">
            <h3 className="text-xs font-display font-bold text-muted-foreground/50 uppercase tracking-wider">
              Commentaires ({gate.comments.length})
            </h3>

            {gate.comments.length > 0 && (
              <div className="space-y-2">
                {gate.comments.map((comment) => (
                  <CommentBubble key={comment.id} comment={comment} />
                ))}
              </div>
            )}

            {(isOpen || isRevision) && (
              <div className="flex items-center gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Ajouter un commentaire..."
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
            Kojima Solutions - kojima-solutions.ch
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Comment Bubble ─────────────────────────────────────────

function CommentBubble({ comment }: { comment: GateComment }) {
  const isAdmin = comment.authorRole === "admin";
  return (
    <div className={cn(
      "flex flex-col max-w-[85%] rounded-xl px-4 py-2.5 break-words",
      isAdmin ? "bg-secondary/40 self-start" : "bg-primary/5 self-end ml-auto",
    )}>
      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
        <span className="text-[10px] font-body font-medium text-foreground/60">
          {comment.authorName || (isAdmin ? "Equipe" : "Client")}
        </span>
        <span className="text-[10px] text-muted-foreground/40 font-body">
          {new Date(comment.createdAt).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="text-sm font-body text-foreground/70 break-words">{comment.message}</p>
    </div>
  );
}
