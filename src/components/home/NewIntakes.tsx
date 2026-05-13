import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, ChevronRight, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listIntakeResponses, type IntakeResponse } from "@/api/funnels";

/**
 * Compact alert for new intake submissions awaiting review. Mirrors the
 * "Nouveau" filter from IntakeManager but lives on Home so the operator
 * sees fresh leads without context-switching to KojimaSpace.
 */
export function NewIntakes() {
  const navigate = useNavigate();
  const [intakes, setIntakes] = useState<IntakeResponse[]>([]);

  useEffect(() => {
    let cancelled = false;
    listIntakeResponses()
      .then((all) => {
        if (cancelled) return;
        setIntakes(all.filter((i) => i.status === "new").slice(0, 8));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (intakes.length === 0) return null;

  return (
    <section className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
        <div className="flex items-center gap-2">
          <Inbox size={14} className="text-primary" />
          <h2 className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Nouvelles demandes
          </h2>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 bg-red-100 text-red-600"
          >
            {intakes.length}
          </Badge>
        </div>
      </div>
      <div className="divide-y divide-border/30">
        {intakes.map((intake) => {
          const responses = (intake.responses ?? {}) as Record<string, unknown>;
          const projectType = (responses.projectType as string) ?? "";
          const selectedModules =
            (responses.selectedModules as { id: string }[]) ?? [];
          const days = Math.floor(
            (Date.now() - new Date(intake.createdAt).getTime()) / 86400000,
          );
          return (
            <button
              key={intake.id}
              onClick={() => navigate("/space-full")}
              className="w-full flex items-center gap-3 px-5 py-2.5 hover:bg-secondary/30 transition-colors text-left group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-body font-medium text-foreground/80 truncate">
                  {intake.clientName || "Anonyme"}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/60 font-body mt-0.5">
                  {projectType && <span className="truncate max-w-[160px]">{projectType}</span>}
                  {selectedModules.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 shrink-0">
                      <Package size={9} /> {selectedModules.length}
                    </span>
                  )}
                  <span className="shrink-0">{days <= 0 ? "Aujourd'hui" : `${days}j`}</span>
                </div>
              </div>
              <ChevronRight
                size={13}
                className="text-muted-foreground/30 group-hover:text-foreground transition-colors shrink-0"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}
