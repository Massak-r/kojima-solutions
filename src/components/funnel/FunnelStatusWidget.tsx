import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layers, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { listFunnels, type ProjectFunnel, type Tier, type FunnelStatus } from "@/api/funnels";

const STATUS_STYLES: Record<FunnelStatus, { label: string; className: string }> = {
  intake:    { label: "Intake",      className: "bg-gray-100 text-gray-600" },
  proposal:  { label: "Proposition", className: "bg-blue-100 text-blue-700" },
  active:    { label: "Actif",       className: "bg-emerald-100 text-emerald-700" },
  completed: { label: "Terminé",     className: "bg-primary/10 text-primary" },
};

const TIER_COLORS: Record<Tier, string> = {
  essential: "text-gray-500",
  professional: "text-blue-600",
  custom: "text-violet-600",
};

export function FunnelStatusWidget() {
  const navigate = useNavigate();
  const [funnels, setFunnels] = useState<ProjectFunnel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listFunnels()
      .then((data) => setFunnels(data.filter((f) => f.status !== "completed")))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers size={14} className="text-primary" />
          <h3 className="font-display text-sm font-semibold">Parcours actifs</h3>
        </div>
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-muted-foreground/30" />
        </div>
      </div>
    );
  }

  if (funnels.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Layers size={14} className="text-primary" />
        <h3 className="font-display text-sm font-semibold">Parcours actifs</h3>
        <span className="text-[10px] text-muted-foreground/40 font-body ml-auto">{funnels.length}</span>
      </div>

      <div className="space-y-2.5">
        {funnels.map((funnel) => {
          const totalGates = funnel.phases.reduce((s, p) => s + (p.gates?.length ?? 0), 0);
          const approvedGates = funnel.phases.reduce(
            (s, p) => s + (p.gates?.filter((g) => g.status === "approved").length ?? 0), 0
          );
          const progress = totalGates > 0 ? Math.round((approvedGates / totalGates) * 100) : 0;
          const statusInfo = STATUS_STYLES[funnel.status];

          return (
            <button
              key={funnel.id}
              onClick={() => navigate(`/project/${funnel.projectId}/suivi`)}
              className="w-full flex flex-col gap-1.5 p-2.5 rounded-lg hover:bg-secondary/30 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-body font-medium text-foreground/80 truncate flex-1">
                  {funnel.projectTitle || funnel.projectId.slice(0, 8)}
                </span>
                <Badge variant="secondary" className={cn("text-[8px] px-1.5 py-0 shrink-0", statusInfo.className)}>
                  {statusInfo.label}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Progress value={progress} className="h-1 flex-1" />
                <span className="text-[9px] text-muted-foreground/40 font-body shrink-0 w-8 text-right">
                  {progress}%
                </span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground/40 font-body">
                <span>{approvedGates}/{totalGates} étapes</span>
                {funnel.tier && (
                  <span className={TIER_COLORS[funnel.tier]}>
                    {funnel.tier === "essential" ? "Ess." : funnel.tier === "professional" ? "Pro" : "Custom"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
