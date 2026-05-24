import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, ChevronRight, Package, Plus, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listIntakeResponses, type IntakeResponse } from "@/api/funnels";
import { useConvertIntake } from "@/hooks/useConvertIntake";

/**
 * Compact alert for new intake submissions awaiting review. Mirrors the
 * "Nouveau" filter from IntakeManager but lives on Home so the operator
 * sees fresh leads without context-switching to KojimaSpace.
 *
 * Each row offers a one-tap "Convertir" button that runs the full
 * intake → project + quote + client flow without leaving the dashboard,
 * then navigates straight to the new draft quote.
 */
export function NewIntakes() {
  const navigate = useNavigate();
  const [intakes, setIntakes] = useState<IntakeResponse[]>([]);
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const convertToProject = useConvertIntake((updated) => {
    setIntakes((prev) => prev.filter((i) => i.id !== updated.id));
  });

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

  async function handleConvert(e: React.MouseEvent, intake: IntakeResponse) {
    e.stopPropagation();
    if (convertingId) return;
    setConvertingId(intake.id);
    try {
      await convertToProject(intake);
    } finally {
      setConvertingId(null);
    }
  }

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
            className="text-[10px] px-1.5 py-0 bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-300"
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
          const isConverting = convertingId === intake.id;
          return (
            <div
              key={intake.id}
              className="flex items-center gap-2 px-5 py-2.5 hover:bg-secondary/20 transition-colors group"
            >
              <button
                onClick={() => navigate("/space-full")}
                className="flex-1 min-w-0 text-left"
              >
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
              </button>
              <button
                onClick={(e) => handleConvert(e, intake)}
                disabled={isConverting}
                className="inline-flex items-center gap-1 text-[11px] font-body font-medium text-primary hover:text-primary/80 disabled:opacity-50 px-2 py-1 rounded-md hover:bg-primary/5 transition-colors shrink-0"
                title="Créer un projet + devis pré-rempli à partir de cette demande"
                aria-label={`Convertir la demande de ${intake.clientName || "ce contact"} en projet`}
              >
                {isConverting ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
                <span className="hidden sm:inline">Convertir</span>
              </button>
              <button
                onClick={() => navigate("/space-full")}
                className="shrink-0 p-1 text-muted-foreground/30 hover:text-foreground transition-colors"
                aria-label="Ouvrir la demande complète"
              >
                <ChevronRight size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
