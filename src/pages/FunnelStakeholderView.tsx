import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Layers, Lock, CheckCircle2, ChevronDown, MessageSquare, List,
  AlertCircle, Send, ExternalLink, Star, Clock, Loader2, Image as ImageIcon,
  AlertTriangle, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  getFunnel, getFunnelByShareToken, addGateComment,
  type ProjectFunnel, type FunnelPhase, type FunnelGate, type GateOption, type GateComment, type Tier,
} from "@/api/funnels";
import { OptionImageGallery } from "@/components/funnel/OptionImageGallery";

const TIER_LABELS: Record<Tier, string> = {
  essential: "Essentiel",
  professional: "Professionnel",
  custom: "Sur mesure",
};

const GATE_STATUS: Record<string, { label: string; icon: typeof Lock; className: string }> = {
  locked:   { label: "Verrouillé", icon: Lock,          className: "bg-gray-100 text-gray-500" },
  open:     { label: "En attente", icon: AlertCircle,   className: "bg-blue-100 text-blue-700" },
  approved: { label: "Validé",     icon: CheckCircle2,  className: "bg-emerald-100 text-emerald-700" },
  revision: { label: "Révision",   icon: Clock,         className: "bg-amber-100 text-amber-700" },
};

const GATE_TYPE_ICONS: Record<string, typeof List> = {
  choice: List,
  approval: CheckCircle2,
  feedback: MessageSquare,
};

export default function FunnelStakeholderView() {
  const { id, token } = useParams<{ id?: string; token?: string }>();
  const { toast } = useToast();
  const [funnel, setFunnel] = useState<ProjectFunnel | null>(null);
  const [error, setError] = useState(false);
  const [stakeholderName, setStakeholderName] = useState(() =>
    localStorage.getItem("kojima-stakeholder-name") ?? ""
  );
  const [nameInput, setNameInput] = useState("");
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());

  const fetchFunnel = useCallback(async () => {
    if (!id && !token) return;
    try {
      const f = token
        ? await getFunnelByShareToken(token)
        : await getFunnel(id!);
      setFunnel(f);
      // Auto-expand phases with open gates
      const openPhases = new Set<string>();
      for (const phase of f.phases) {
        if (phase.gates.some((g) => g.status === "open" || g.status === "revision")) {
          openPhases.add(phase.id);
        }
      }
      if (openPhases.size > 0) setExpandedPhases(openPhases);
    } catch {
      setError(true);
    }
  }, [id]);

  useEffect(() => { fetchFunnel(); }, [fetchFunnel]);

  function handleSetName() {
    const name = nameInput.trim();
    if (!name) return;
    setStakeholderName(name);
    localStorage.setItem("kojima-stakeholder-name", name);
  }

  if (error || (!funnel && (id || token))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground font-body">Document introuvable.</p>
          <Link to="/" className="text-primary text-sm font-body hover:underline">Retour</Link>
        </div>
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 size={24} className="animate-spin text-muted-foreground/30" />
      </div>
    );
  }

  const totalGates = funnel.phases.reduce((s, p) => s + p.gates.length, 0);
  const approvedGates = funnel.phases.reduce((s, p) => s + p.gates.filter((g) => g.status === "approved").length, 0);
  const totalBudget = funnel.phases.reduce((s, p) => s + (p.budget ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers size={18} className="text-primary" />
            <h1 className="font-display text-lg font-bold text-foreground/90">
              Suivi du projet
            </h1>
            {funnel.tier && (
              <Badge variant="secondary" className={cn(
                "text-[10px] ml-auto",
                funnel.tier === "essential" ? "bg-gray-100 text-gray-600" :
                funnel.tier === "professional" ? "bg-blue-100 text-blue-700" :
                "bg-violet-100 text-violet-700"
              )}>
                {TIER_LABELS[funnel.tier]}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground/50 font-body">
            Vue en lecture seule. Vous pouvez ajouter des commentaires.
          </p>
        </div>

        {/* Stakeholder name input */}
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
          <p className="text-xs text-muted-foreground/40 font-body">
            Connecté en tant que <strong className="text-foreground/60">{stakeholderName}</strong>
            <button
              onClick={() => { setStakeholderName(""); localStorage.removeItem("kojima-stakeholder-name"); }}
              className="ml-2 text-primary/60 hover:text-primary underline"
            >
              Changer
            </button>
          </p>
        )}

        {/* Progress overview */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center justify-between text-xs font-body text-muted-foreground mb-2">
            <span>{approvedGates}/{totalGates} décisions validées</span>
            {totalBudget > 0 && (
              <span>{totalBudget.toLocaleString("fr-CH")} CHF</span>
            )}
          </div>
          <Progress value={totalGates > 0 ? (approvedGates / totalGates) * 100 : 0} className="h-1.5" />
        </div>

        {/* Consolidation reminder */}
        <div className="flex items-start gap-2.5 bg-violet-50/50 border border-violet-200/30 rounded-lg px-3.5 py-2.5">
          <Users size={13} className="text-violet-500 shrink-0 mt-0.5" />
          <p className="text-[11px] font-body text-violet-700/70 leading-relaxed">
            Rassemblez tous les retours de votre equipe avant de les transmettre au responsable du projet, afin de tout traiter en un seul tour de revision.
          </p>
        </div>

        {/* Phase list */}
        <div className="space-y-3">
          {funnel.phases.map((phase) => {
            const phaseApproved = phase.gates.filter((g) => g.status === "approved").length;
            const hasOpen = phase.gates.some((g) => g.status === "open" || g.status === "revision");
            const expanded = expandedPhases.has(phase.id);

            return (
              <div key={phase.id} className={cn(
                "border rounded-xl overflow-hidden transition-colors",
                hasOpen ? "border-primary/30 bg-primary/[0.02]" : "border-border"
              )}>
                <button
                  onClick={() => setExpandedPhases((prev) => {
                    const next = new Set(prev);
                    next.has(phase.id) ? next.delete(phase.id) : next.add(phase.id);
                    return next;
                  })}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/20 transition-colors"
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold",
                    phase.status === "completed" ? "bg-emerald-100 text-emerald-700" :
                    phase.status === "active" ? "bg-primary/10 text-primary" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {phase.status === "completed" ? <CheckCircle2 size={14} /> : phaseApproved}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display text-sm font-semibold text-foreground/90 truncate">{phase.title}</h3>
                    <p className="text-[10px] text-muted-foreground/50 font-body">
                      {phaseApproved}/{phase.gates.length} validé{phaseApproved !== 1 ? "s" : ""}
                      {phase.budget != null && phase.budget > 0 && ` · ${phase.budget.toLocaleString("fr-CH")} CHF`}
                    </p>
                  </div>
                  {hasOpen && (
                    <Badge variant="secondary" className="text-[9px] bg-blue-100 text-blue-700 shrink-0">En cours</Badge>
                  )}
                  <ChevronDown size={14} className={cn("text-muted-foreground/30 transition-transform shrink-0", expanded && "rotate-180")} />
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-2">
                    {phase.gates.map((gate) => (
                      <StakeholderGateCard
                        key={gate.id}
                        gate={gate}
                        stakeholderName={stakeholderName}
                        onRefresh={fetchFunnel}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="text-center pt-8 pb-4">
          <p className="text-[10px] text-muted-foreground/30 font-body">
            Kojima Solutions - kojima-solutions.ch
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Stakeholder Gate Card (read-only + comments) ─────────────

function DeadlineBadgeStakeholder({ deadline }: { deadline: string }) {
  const now = new Date();
  const dl = new Date(deadline);
  const diffMs = dl.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const isOverdue = daysLeft < 0;
  const isUrgent = daysLeft >= 0 && daysLeft <= 2;
  const isSoon = daysLeft > 2 && daysLeft <= 5;

  const color = isOverdue ? "text-red-600 bg-red-50 border-red-200/50"
    : isUrgent ? "text-amber-700 bg-amber-50 border-amber-200/50"
    : isSoon ? "text-amber-600 bg-amber-50/50 border-amber-200/30"
    : "text-muted-foreground/60 bg-secondary/30 border-border/30";

  const label = isOverdue
    ? "Delai depasse. Le client principal peut deja avoir pris sa decision."
    : daysLeft === 0
    ? "Dernier jour pour commenter"
    : daysLeft === 1
    ? "Il reste 1 jour pour commenter"
    : `Il reste ${daysLeft} jours pour commenter`;

  return (
    <div className={cn("flex items-center gap-1.5 text-[10px] font-body rounded-md border px-2 py-1", color)}>
      <Clock size={10} className="shrink-0" />
      <span>{label}</span>
    </div>
  );
}

function StakeholderGateCard({ gate, stakeholderName, onRefresh }: {
  gate: FunnelGate;
  stakeholderName: string;
  onRefresh: () => void;
}) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(gate.status === "open" || gate.status === "revision");
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState(false);

  const StatusInfo = GATE_STATUS[gate.status] ?? GATE_STATUS.locked;
  const TypeIcon = GATE_TYPE_ICONS[gate.gateType] ?? MessageSquare;
  const isLocked = gate.status === "locked";

  async function handleComment() {
    if (!commentText.trim() || !stakeholderName) return;
    setBusy(true);
    try {
      await addGateComment(gate.id, {
        message: commentText.trim(),
        authorName: stakeholderName,
        authorRole: "stakeholder",
      });
      setCommentText("");
      onRefresh();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn(
      "border rounded-lg transition-all",
      gate.status === "open" ? "border-blue-200 bg-blue-50/30" :
      gate.status === "approved" ? "border-emerald-200/50 bg-emerald-50/20" :
      gate.status === "revision" ? "border-amber-200 bg-amber-50/20" :
      "border-border/30 bg-card"
    )}>
      <button
        onClick={() => !isLocked && setExpanded(!expanded)}
        disabled={isLocked}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors rounded-lg",
          !isLocked && "hover:bg-secondary/20",
          isLocked && "opacity-50 cursor-not-allowed"
        )}
      >
        <TypeIcon size={14} className={cn(
          gate.status === "open" ? "text-blue-600" :
          gate.status === "approved" ? "text-emerald-600" :
          gate.status === "revision" ? "text-amber-600" :
          "text-muted-foreground/30"
        )} />
        <span className={cn(
          "flex-1 text-sm font-body font-medium truncate",
          isLocked ? "text-muted-foreground/40" : "text-foreground/80"
        )}>
          {gate.title}
        </span>
        <Badge variant="secondary" className={cn("text-[9px] px-1.5 py-0", StatusInfo.className)}>
          {StatusInfo.label}
        </Badge>
        {gate.deadline && !isLocked && gate.status !== "approved" && (
          <span className={cn(
            "text-[9px] font-body px-1.5 py-0 rounded shrink-0",
            (() => {
              const d = Math.ceil((new Date(gate.deadline).getTime() - Date.now()) / 86400000);
              return d < 0 ? "text-red-600" : d <= 2 ? "text-amber-600" : "text-muted-foreground/40";
            })()
          )}>
            <Clock size={9} className="inline mr-0.5" />
            {new Date(gate.deadline).toLocaleDateString("fr-CH", { day: "2-digit", month: "short" })}
          </span>
        )}
        {!isLocked && (
          <ChevronDown size={12} className={cn("text-muted-foreground/20 transition-transform", expanded && "rotate-180")} />
        )}
      </button>

      {expanded && !isLocked && (
        <div className="px-3 pb-3 space-y-3">
          {gate.description && (
            <p className="text-xs text-muted-foreground/60 font-body">{gate.description}</p>
          )}

          {/* Deadline detail (for open/revision gates) */}
          {gate.deadline && gate.status !== "approved" && (
            <DeadlineBadgeStakeholder deadline={gate.deadline} />
          )}

          {/* Approved summary */}
          {gate.status === "approved" && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-body">
              <CheckCircle2 size={12} />
              Validé {gate.approvedAt && `le ${new Date(gate.approvedAt).toLocaleDateString("fr-CH")}`}
              {gate.approvedBy && ` par ${gate.approvedBy}`}
            </div>
          )}

          {/* Warning for validated steps */}
          {gate.status === "approved" && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200/50 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[10px] font-body text-amber-700/80 leading-relaxed">
                Cette etape a ete validee. Tout commentaire pourrait entrainer des modifications supplementaires et des couts additionnels.
              </p>
            </div>
          )}

          {/* Selected option for choice gates */}
          {gate.gateType === "choice" && gate.options.length > 0 && (
            <div className={cn(
              "grid gap-2",
              gate.options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            )}>
              {gate.options.map((opt) => (
                <div
                  key={opt.id}
                  className={cn(
                    "relative flex flex-col rounded-lg border-2 p-3",
                    opt.isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/30 opacity-60"
                  )}
                >
                  {opt.isRecommended && (
                    <span className="absolute -top-2 right-2 flex items-center gap-0.5 text-[9px] font-body font-semibold text-amber-600 bg-amber-50 border border-amber-200/50 px-1.5 py-0 rounded-full">
                      <Star size={8} className="fill-amber-500" /> Recommandé
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
                    <p className="text-[10px] text-muted-foreground/50 font-body mt-0.5 line-clamp-2">{opt.description}</p>
                  )}
                  {opt.linkUrl && (
                    <a
                      href={opt.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-primary/60 hover:text-primary font-body mt-1 flex items-center gap-0.5"
                    >
                      <ExternalLink size={9} /> Voir l'aperçu
                    </a>
                  )}
                  {opt.isSelected && (
                    <div className="absolute top-2 left-2">
                      <CheckCircle2 size={14} className="text-primary" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Revision status */}
          {gate.status === "revision" && (
            <div className="bg-amber-50 border border-amber-200/50 rounded-lg p-3 text-xs font-body text-amber-700">
              <p className="font-medium">Révision en cours</p>
              <p className="text-amber-600/70 mt-0.5">
                Révision {gate.revisionCount}/{gate.revisionLimit}
              </p>
            </div>
          )}

          {/* Comments thread */}
          {gate.comments.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/20">
              <p className="text-[10px] text-muted-foreground/40 font-body font-medium uppercase tracking-wide">Commentaires</p>
              {gate.comments.map((comment) => {
                const isAdmin = comment.authorRole === "admin";
                const isStakeholder = comment.authorRole === "stakeholder";
                return (
                  <div
                    key={comment.id}
                    className={cn(
                      "flex flex-col max-w-[85%] rounded-lg px-3 py-2",
                      isAdmin ? "bg-secondary/40 self-start" :
                      isStakeholder ? "bg-violet-50 self-end ml-auto" :
                      "bg-primary/5 self-end ml-auto"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-body font-medium text-foreground/60">
                        {comment.authorName || (isAdmin ? "Équipe" : isStakeholder ? "Partie prenante" : "Client")}
                      </span>
                      {isStakeholder && (
                        <Badge variant="secondary" className="text-[7px] px-1 py-0 bg-violet-100 text-violet-600">Stakeholder</Badge>
                      )}
                      <span className="text-[9px] text-muted-foreground/30 font-body">
                        {new Date(comment.createdAt).toLocaleDateString("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs font-body text-foreground/70">{comment.message}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add comment (stakeholders can comment on any non-locked gate) */}
          {stakeholderName && (
            <div className="flex items-center gap-2 pt-1">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Ajouter un commentaire..."
                className="flex-1 text-xs font-body bg-background border border-border/40 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/20"
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
              />
              <button
                onClick={handleComment}
                disabled={busy || !commentText.trim()}
                className="p-1.5 text-primary/60 hover:text-primary disabled:opacity-30 transition-colors"
              >
                <Send size={12} />
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
