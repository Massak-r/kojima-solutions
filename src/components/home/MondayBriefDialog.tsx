import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sunrise, Sparkles, Flame, Inbox, Target, Clock, ArrowRight, Loader2, Wand2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveDialog, ResponsiveDialogContent,
} from "@/components/ui/responsive-dialog";
import { DialogTitle } from "@/components/ui/dialog";
import { formatDateShort } from "@/lib/dateFormat";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useObjectives } from "@/hooks/useObjectives";
import { useAllSubtasks } from "@/hooks/useSubtasks";
import { useSubtaskCompletions } from "@/hooks/useSubtaskCompletions";
import { getGlobalWeekSummary, type GlobalWeekSummary } from "@/api/objectiveSessions";
import { listInboxCaptures, type InboxList } from "@/api/inboxCaptures";
import { getWeeklyRecap, type WeeklyRecap } from "@/api/weeklyRecap";
import {
  isoWeekOf,
  startOfIsoWeek,
  currentPeriodFor,
  previousPeriod,
  isPeriodDone,
  periodEnd,
} from "@/lib/recurrencePeriod";
import type { Recurrence } from "@/api/todoSubtasks";

interface MondayBriefDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDuration(sec: number): string {
  if (sec === 0) return "0min";
  if (sec < 60) return `${sec}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

function computeStreak(recurrence: Recurrence, createdAtISO: string, dates: string[] | undefined): number {
  if (!dates || dates.length === 0) return 0;
  const today = new Date();
  const created = new Date(createdAtISO);
  let cursor = currentPeriodFor(recurrence, today);
  let streak = isPeriodDone(cursor, dates) ? 1 : 0;
  cursor = previousPeriod(cursor);
  while (periodEnd(cursor) >= created) {
    if (!isPeriodDone(cursor, dates)) break;
    streak++;
    cursor = previousPeriod(cursor);
  }
  return streak;
}

export function MondayBriefDialog({ open, onOpenChange }: MondayBriefDialogProps) {
  const navigate = useNavigate();
  const { data: objectives = [] }   = useObjectives();
  const { data: allSubtasks = [] }  = useAllSubtasks();
  const { data: adminCompl }        = useSubtaskCompletions("admin");
  const { data: personalCompl }     = useSubtaskCompletions("personal");
  const [weekSummary, setWeekSummary] = useState<GlobalWeekSummary | null>(null);
  const [inbox, setInbox]             = useState<InboxList | null>(null);
  const [recap, setRecap]             = useState<WeeklyRecap | null>(null);
  const [loading, setLoading]         = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.allSettled([
      getGlobalWeekSummary().then(setWeekSummary).catch(() => {}),
      listInboxCaptures({ status: "pending", limit: 1 }).then(setInbox).catch(() => {}),
      getWeeklyRecap().then(setRecap).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [open]);

  const now = new Date();
  const { year, week } = isoWeekOf(now);
  const weekStart = startOfIsoWeek(year, week);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const dateRange = `${formatDateShort(weekStart)} – ${formatDateShort(weekEnd)}`;

  const completionsMap = useMemo(
    () => ({ ...(adminCompl ?? {}), ...(personalCompl ?? {}) }),
    [adminCompl, personalCompl],
  );

  // Last week: prev ISO week
  const lastWeekTotal = weekSummary?.totalSec ?? 0;
  const lastWeekSessions = weekSummary?.sessionCount ?? 0;
  const topObjective = useMemo(() => {
    const top = weekSummary?.byObjective?.[0];
    if (!top) return null;
    const obj = objectives.find(o => o.id === top.objectiveId && o.source === top.source);
    return obj ? { text: obj.text, sec: top.sec } : null;
  }, [weekSummary, objectives]);

  // Current week: counts + streaks
  const sprintCounts = useMemo(() => {
    const flagged = allSubtasks.filter(s => s.flaggedToday && !s.completed);
    const must = flagged.filter(s => (s.sprintTier ?? "nice") === "must").length;
    const nice = flagged.filter(s => (s.sprintTier ?? "nice") === "nice").length;
    return { must, nice };
  }, [allSubtasks]);

  const topStreaks = useMemo(() => {
    return allSubtasks
      .filter(s => s.recurrence && !s.completed)
      .map(s => ({
        text: s.text,
        recurrence: s.recurrence!,
        streak: computeStreak(s.recurrence!, s.createdAt, completionsMap[s.id]),
      }))
      .filter(s => s.streak > 0)
      .sort((a, b) => b.streak - a.streak)
      .slice(0, 3);
  }, [allSubtasks, completionsMap]);

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent
        padded={false}
        className="max-w-xl p-0 overflow-hidden gap-0 bg-card"
        aria-describedby={undefined}
      >
        {/* sr-only title — required by Radix/vaul for a11y; the visual title
            is rendered inside the gradient header below. */}
        <DialogTitle className="sr-only">Bonjour — Lundi · Semaine {week}</DialogTitle>
        {/* Gradient header */}
        <div className="relative px-7 pt-7 pb-6 bg-gradient-to-br from-primary via-primary to-primary/85 text-primary-foreground overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none" aria-hidden="true">
            <Sparkles className="absolute top-4 right-6 w-20 h-20 text-primary-foreground/30 -rotate-12" />
            <Sparkles className="absolute -bottom-4 -left-2 w-16 h-16 text-primary-foreground/20 rotate-12" />
          </div>
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] font-body font-bold uppercase tracking-widest text-primary-foreground/70 mb-1">
              <Sunrise size={11} />
              Bonjour — Lundi
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold leading-tight">
              Semaine {week}
            </h2>
            <p className="text-xs font-body text-primary-foreground/80 mt-1.5 tabular-nums">
              {dateRange}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={22} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: 0.05 }}
              className="px-7 py-6 space-y-6 max-h-[70vh] overflow-y-auto"
            >
              {/* Agent recap (if posted by the Sunday remote routine) */}
              {recap?.exists && recap.content_md && (
                <section className="rounded-xl border border-violet-200/50 bg-gradient-to-br from-violet-50/60 via-card/40 to-card/30 dark:from-violet-500/10 dark:via-card/40 p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Wand2 size={11} className="text-violet-500" />
                    <h3 className="text-[10px] font-display font-bold text-violet-700 dark:text-violet-300 uppercase tracking-widest">
                      Récap de l'agent dominical
                    </h3>
                    {recap.generated_at && (
                      <span className="text-[10px] font-mono text-muted-foreground/50 ml-auto tabular-nums">
                        {formatDateShort(recap.generated_at)}
                      </span>
                    )}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/85 font-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{recap.content_md}</ReactMarkdown>
                  </div>
                </section>
              )}

              {/* Semaine passée */}
              <section>
                <h3 className="text-[10px] font-display font-bold text-foreground/60 uppercase tracking-widest mb-3">
                  La semaine dernière
                </h3>
                {lastWeekTotal === 0 ? (
                  <div className="text-xs font-body text-muted-foreground/60 italic">
                    Pas de session de focus tracée — c'est une nouvelle page blanche.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-border/40 bg-card/40 p-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-body font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5">
                        <Clock size={10} />
                        Focus total
                      </div>
                      <div className="font-mono text-2xl font-bold text-foreground tabular-nums">
                        {formatDuration(lastWeekTotal)}
                      </div>
                      <div className="text-[10px] font-body text-muted-foreground/60 mt-0.5">
                        {lastWeekSessions} session{lastWeekSessions > 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="rounded-xl border border-border/40 bg-card/40 p-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-body font-semibold text-muted-foreground/70 uppercase tracking-wider mb-1.5">
                        <Target size={10} />
                        Top objectif
                      </div>
                      {topObjective ? (
                        <>
                          <div className="font-body text-sm font-semibold text-foreground truncate">
                            {topObjective.text}
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground/70 tabular-nums mt-0.5">
                            {formatDuration(topObjective.sec)}
                          </div>
                        </>
                      ) : (
                        <div className="text-xs font-body text-muted-foreground/50 italic">—</div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Streaks actifs */}
              {topStreaks.length > 0 && (
                <section>
                  <h3 className="text-[10px] font-display font-bold text-foreground/60 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Flame size={11} className="text-amber-500 fill-current" />
                    Habitudes en cours
                  </h3>
                  <ul className="space-y-1.5">
                    {topStreaks.map((s, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-3 rounded-lg border border-amber-200/40 bg-amber-50/40 dark:bg-amber-500/5 dark:border-amber-500/20 px-3 py-2"
                      >
                        <span className="text-sm font-body text-foreground truncate flex-1">
                          {s.text}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300 tabular-nums shrink-0">
                          <Flame size={10} className="fill-current" />
                          {s.streak}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* Cette semaine — sprint + inbox */}
              <section>
                <h3 className="text-[10px] font-display font-bold text-foreground/60 uppercase tracking-widest mb-3">
                  Cette semaine
                </h3>
                <div className="space-y-2">
                  <BriefRow
                    icon={<Target size={13} className="text-red-500" />}
                    label="Sprint actif"
                    value={
                      sprintCounts.must + sprintCounts.nice === 0
                        ? "Rien de flaggé — à toi de définir"
                        : `${sprintCounts.must} must · ${sprintCounts.nice} nice`
                    }
                    onClick={() => { onOpenChange(false); navigate("/sprint"); }}
                  />
                  <BriefRow
                    icon={<Inbox size={13} className="text-violet-500" />}
                    label="Captures à trier"
                    value={
                      !inbox || inbox.pendingCount === 0
                        ? "Inbox vide"
                        : `${inbox.pendingCount} en attente — /triage quand tu veux`
                    }
                  />
                </div>
              </section>

              {/* Footer CTA */}
              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => onOpenChange(false)}
                  className="text-xs font-body text-muted-foreground/60 hover:text-foreground transition-colors"
                >
                  Plus tard
                </button>
                <Button
                  size="sm"
                  onClick={() => { onOpenChange(false); navigate("/sprint"); }}
                  className="gap-1.5 rounded-full"
                >
                  Lancer la semaine
                  <ArrowRight size={13} />
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function BriefRow({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="shrink-0">{icon}</span>
      <span className="text-[11px] font-body font-semibold text-muted-foreground uppercase tracking-wider w-32 shrink-0">
        {label}
      </span>
      <span className="text-sm font-body text-foreground/85 flex-1 truncate">
        {value}
      </span>
      {onClick && <ArrowRight size={12} className="text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />}
    </>
  );

  return onClick ? (
    <button onClick={onClick} className={cn(
      "group w-full flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5 text-left",
      "hover:border-border hover:bg-card/60 transition-colors",
    )}>
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5">
      {content}
    </div>
  );
}
