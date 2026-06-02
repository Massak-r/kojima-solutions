import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Compass, Battery, BatteryMedium, BatteryLow, Play, Shuffle, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { useObjectives } from "@/hooks/useObjectives";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { startSession } from "@/api/objectiveSessions";
import type { ObjectiveSource } from "@/api/objectiveSource";
import type { SubtaskItem } from "@/api/todoSubtasks";

/** Dispatch this on window to open the "Et maintenant ?" picker from anywhere. */
export const OPEN_NEXT_ACTION_EVENT = "open-next-action";

type Energy = "high" | "med" | "low";

const TIME_OPTIONS = [
  { min: 15, label: "15 min" },
  { min: 30, label: "30 min" },
  { min: 60, label: "1 h" },
  { min: 120, label: "2 h+" },
];

const ENERGY_OPTIONS: { key: Energy; label: string; icon: typeof Battery }[] = [
  { key: "high", label: "Haute", icon: Battery },
  { key: "med", label: "Moyenne", icon: BatteryMedium },
  { key: "low", label: "Basse", icon: BatteryLow },
];

/** Best-guess duration for a subtask: explicit estimate, else effort tier. */
function estimateMin(s: SubtaskItem): number {
  if (s.estimatedMinutes && s.estimatedMinutes > 0) return s.estimatedMinutes;
  switch (s.effortSize) {
    case "rapide": return 15;
    case "complexe": return 90;
    case "moyen": return 45;
    default: return 30;
  }
}

/**
 * Fit score for "what should I do right now" given the time window + energy.
 * Tasks that fit the window win; energy steers easy-vs-hard; must-tier and
 * high priority break ties.
 */
function scoreFor(s: SubtaskItem, timeBudget: number, energy: Energy): number {
  const est = estimateMin(s);
  let score = est <= timeBudget * 1.15 ? 100 : 100 - (est - timeBudget);
  const effort = s.effortSize ?? "moyen";
  const byEnergy: Record<Energy, Record<string, number>> = {
    high: { complexe: 30, moyen: 18, rapide: 6 },
    med: { moyen: 30, rapide: 16, complexe: 14 },
    low: { rapide: 34, moyen: 12, complexe: -8 },
  };
  score += byEnergy[energy][effort] ?? 12;
  if (s.sprintTier === "must") score += 40;
  score += s.priority === "high" ? 20 : s.priority === "low" ? -4 : 6;
  return score;
}

function effortLabel(s: SubtaskItem): string {
  const est = estimateMin(s);
  const eff = s.effortSize
    ? ({ rapide: "Rapide", moyen: "Moyen", complexe: "Complexe" } as Record<string, string>)[s.effortSize]
    : null;
  return eff ? `${eff} · ~${est} min` : `~${est} min`;
}

/**
 * "Et maintenant ?" — externalizes the hardest ADHD step (deciding what to do
 * next). Pick a time window + energy level and it surfaces ONE flagged subtask,
 * then starts a focus session and drops you into that objective. Globally
 * mounted; opened via OPEN_NEXT_ACTION_EVENT.
 */
export function NextActionDialog() {
  const navigate = useNavigate();
  const { data: objectives = [] } = useObjectives();
  const { data: allSubtasks = [] } = useAllSubtasks();
  const [open, setOpen] = useState(false);
  const [timeBudget, setTimeBudget] = useState(30);
  const [energy, setEnergy] = useState<Energy>("med");
  const [skipIds, setSkipIds] = useState<string[]>([]);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    function onOpen() { setSkipIds([]); setStarting(false); setOpen(true); }
    window.addEventListener(OPEN_NEXT_ACTION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NEXT_ACTION_EVENT, onOpen);
  }, []);

  const objectiveById = useMemo(() => {
    const m: Record<string, { text: string; source: ObjectiveSource }> = {};
    for (const o of objectives) m[o.id] = { text: o.text, source: o.source };
    return m;
  }, [objectives]);

  // Candidate pool: flagged-today, not done, parent objective still present.
  const ranked = useMemo(() =>
    allSubtasks
      .filter((s) => s.flaggedToday && !s.completed && objectiveById[s.parentId])
      .map((s) => ({ s, score: scoreFor(s, timeBudget, energy) }))
      .sort((a, b) => b.score - a.score),
  [allSubtasks, objectiveById, timeBudget, energy]);

  const pick = useMemo(() => {
    if (ranked.length === 0) return null;
    return (ranked.find((r) => !skipIds.includes(r.s.id)) ?? ranked[0]).s;
  }, [ranked, skipIds]);

  const obj = pick ? objectiveById[pick.parentId] : null;

  async function go() {
    if (!pick || !obj) return;
    setStarting(true);
    try {
      await startSession({ source: obj.source, objectiveId: pick.parentId, subtaskId: pick.id });
    } catch { /* non-blocking: navigate anyway, the workspace reconciles state */ }
    setOpen(false);
    setStarting(false);
    toast.success("Focus lancé", { description: pick.text });
    navigate(`/objective/${obj.source}/${pick.parentId}`);
  }

  function other() {
    if (pick) setSkipIds((prev) => [...prev, pick.id]);
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogContent className="sm:max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" /> Et maintenant ?
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            Dis-moi ton temps et ton énergie — je choisis UNE chose à faire.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-body">J'ai…</p>
            <div className="flex gap-1.5">
              {TIME_OPTIONS.map((o) => (
                <button
                  key={o.min}
                  onClick={() => setTimeBudget(o.min)}
                  className={cn(
                    "flex-1 text-xs font-body px-2 py-1.5 rounded-lg border transition-colors",
                    timeBudget === o.min ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:bg-secondary",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-body">Énergie</p>
            <div className="flex gap-1.5">
              {ENERGY_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  onClick={() => setEnergy(o.key)}
                  className={cn(
                    "flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-body px-2 py-1.5 rounded-lg border transition-colors",
                    energy === o.key ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:bg-secondary",
                  )}
                >
                  <o.icon size={13} /> {o.label}
                </button>
              ))}
            </div>
          </div>

          {pick && obj ? (
            <div className="rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-body truncate">{obj.text}</p>
              <p className="font-display text-base font-semibold text-foreground leading-snug mt-0.5">{pick.text}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">{effortLabel(pick)}</span>
                {pick.sprintTier === "must" && (
                  <span className="text-[10px] font-body px-1.5 py-0.5 rounded-full border border-amber-300/60 text-amber-700 dark:text-amber-300">Priorité du jour</span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted-foreground font-body">Aucune tâche flaggée pour aujourd'hui.</p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => { setOpen(false); navigate("/sprint"); }}>
                <ListChecks size={14} /> Composer mon sprint
              </Button>
            </div>
          )}
        </div>

        {pick && (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-1.5" onClick={other} disabled={ranked.length <= 1 || starting}>
              <Shuffle size={14} /> Autre
            </Button>
            <Button className="flex-1 gap-1.5" onClick={go} disabled={starting}>
              <Play size={14} /> C'est parti
            </Button>
          </div>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
