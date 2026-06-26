import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sunrise, Play, ArrowRight, Coins, CalendarClock, Sparkles, X, Target, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic } from "@/lib/haptics";
import { toISODate } from "@/lib/weekDates";
import { formatCHF } from "@/components/kojimaSpace/helpers";
import { useTodaysSprint } from "@/hooks/useTodaysSprint";
import { useQuotes } from "@/hooks/useQuotes";
import { useClients } from "@/contexts/ClientsContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { computeRelances } from "@/lib/relances";
import { listDeadlines } from "@/api/adminDeadlines";
import { startSession } from "@/api/objectiveSessions";

/**
 * "L'essentiel" — a daily morning brief that consolidates the three things a
 * solo founder actually needs at a glance, which otherwise live on separate
 * pages: (1) the single thing to start with, (2) money to collect, (3) the
 * next compliance deadline. All derived from existing engines (computeRelances,
 * useTodaysSprint, admin deadlines). Dismissible per day so it never nags.
 */
export function BriefDuJour() {
  const navigate = useNavigate();
  const { flagged } = useTodaysSprint();
  const { quotes } = useQuotes();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { data: deadlines = [] } = useQuery({ queryKey: ["admin-deadlines"], queryFn: listDeadlines, staleTime: 60_000 });

  const today = toISODate(new Date());
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(`koji-brief-${today}`) === "1"; } catch { return false; }
  });

  const relances = useMemo(
    () => computeRelances(quotes, clients, projects, new Date()),
    [quotes, clients, projects],
  );

  const deadlinesSoon = useMemo(() => {
    const now = Date.now();
    return (deadlines ?? [])
      .filter((d) => !d.completed && d.dueDate)
      .map((d) => ({ ...d, days: Math.ceil((new Date(d.dueDate + "T00:00:00").getTime() - now) / 86400000) }))
      .filter((d) => d.days <= 7)
      .sort((a, b) => a.days - b.days);
  }, [deadlines]);

  if (dismissed) return null;

  const topItem = flagged[0] ?? null;
  const collectCount = relances.overdueInvoices.length + relances.toInvoice.length;
  const hasMoney = relances.atStake > 0 && collectCount > 0;
  const hasDeadlines = deadlinesSoon.length > 0;
  const nothing = !topItem && !hasMoney && !hasDeadlines;

  const topTitle = topItem ? (topItem.kind === "subtask" ? topItem.subtask.text : topItem.task.title) : null;
  const topSource = topItem ? (topItem.kind === "subtask" ? (topItem.objective?.text ?? "Objectif") : (topItem.project.title || "Projet")) : null;
  const TopIcon = topItem?.kind === "task" ? FolderKanban : Target;

  function dismiss() {
    haptic("tap");
    setDismissed(true);
    try { localStorage.setItem(`koji-brief-${today}`, "1"); } catch { /* ignore */ }
  }

  async function startHere() {
    haptic("success");
    if (topItem && topItem.kind === "subtask" && topItem.objective) {
      const o = topItem.objective;
      // Start a focus session, then drop into the objective workspace — the
      // session reconciles even if the call fails, so navigate regardless.
      try { await startSession({ source: o.source, objectiveId: topItem.subtask.parentId, subtaskId: topItem.subtask.id }); } catch { /* non-blocking */ }
      navigate(`/objective/${o.source}/${o.id}`);
    } else if (topItem && topItem.kind === "task") {
      navigate(`/project/${topItem.project.id}/etapes`);
    }
  }

  const nextDl = deadlinesSoon[0];

  return (
    <section className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.05] via-card to-card shadow-card overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-5 py-3 border-b border-primary/10">
        <div className="flex items-center gap-2">
          <Sunrise size={15} className="text-primary" />
          <h2 className="text-eyebrow">L'essentiel</h2>
        </div>
        <button
          onClick={dismiss}
          title="Masquer pour aujourd'hui"
          aria-label="Masquer le brief"
          className="p-1 -mr-1 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </header>

      <div className="divide-y divide-border/40">
        {/* Start here — the single hardest ADHD step, pre-decided */}
        {topItem ? (
          <div className="flex items-center gap-3 px-5 py-3">
            <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Play size={14} className="text-primary fill-primary/20" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground/70">Commence par</p>
              <p className="text-sm font-body font-semibold text-foreground truncate">{topTitle}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/70 truncate">
                <TopIcon size={11} className="shrink-0" /> <span className="truncate">{topSource}</span>
              </p>
            </div>
            <button
              onClick={startHere}
              className="shrink-0 inline-flex items-center gap-1.5 text-xs font-body font-semibold rounded-full px-3.5 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Play size={13} /> Démarrer
            </button>
          </div>
        ) : !nothing ? (
          <button
            onClick={() => navigate("/sprint")}
            className="group w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-secondary/30 transition-colors"
          >
            <span className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles size={14} className="text-primary" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground/70">Commence par</p>
              <p className="text-sm font-body font-medium text-foreground">Planifie ta journée — rien n'est encore engagé.</p>
            </div>
            <ArrowRight size={14} className="shrink-0 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
          </button>
        ) : null}

        {/* Money to collect — highest-ROI morning action */}
        {hasMoney && (
          <button
            onClick={() => navigate("/relances")}
            className="group w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-secondary/30 transition-colors"
          >
            <span className="shrink-0 w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <Coins size={14} className="text-emerald-600 dark:text-emerald-400" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground/70">À encaisser</p>
              <p className="text-sm font-body text-foreground/90">
                <span className="font-semibold tabular-nums">{formatCHF(relances.atStake)}</span>
                <span className="text-muted-foreground"> · {collectCount} relance{collectCount > 1 ? "s" : ""}</span>
              </p>
            </div>
            <ArrowRight size={14} className="shrink-0 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
          </button>
        )}

        {/* Next compliance deadline */}
        {hasDeadlines && nextDl && (
          <button
            onClick={() => navigate("/documents")}
            className="group w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-secondary/30 transition-colors"
          >
            <span className="shrink-0 w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
              <CalendarClock size={14} className="text-indigo-600 dark:text-indigo-400" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-body font-semibold uppercase tracking-wider text-muted-foreground/70">Échéance</p>
              <p className="text-sm font-body text-foreground/90 truncate">
                <span className="font-semibold">{nextDl.title}</span>
                <span className={cn("ml-1.5 tabular-nums", nextDl.days <= 3 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400")}>
                  {nextDl.days < 0 ? `+${Math.abs(nextDl.days)}j` : nextDl.days === 0 ? "auj." : `${nextDl.days}j`}
                </span>
                {deadlinesSoon.length > 1 && <span className="text-muted-foreground"> · +{deadlinesSoon.length - 1}</span>}
              </p>
            </div>
            <ArrowRight size={14} className="shrink-0 text-muted-foreground/30 group-hover:text-foreground transition-colors" />
          </button>
        )}

        {/* All clear */}
        {nothing && (
          <div className="px-5 py-4 text-sm font-body text-muted-foreground">
            Rien d'urgent ce matin — à toi de jouer. ☕
          </div>
        )}
      </div>
    </section>
  );
}
