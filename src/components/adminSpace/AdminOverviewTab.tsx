import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ShieldCheck, ShieldAlert, Banknote, Landmark, Calculator, Archive, Receipt,
  Percent, Users, CalendarClock, FileText, BookOpen, ArrowRight, ChevronRight,
  ChevronDown, Loader2, ScanLine, Inbox, Wallet, BellRing, Sparkles, Check,
  Circle, Crosshair,
} from "lucide-react";
import { SectionCard } from "@/components/ui/section-card";
import { cn } from "@/lib/utils";
import { formatChf } from "@/lib/currency";
import { formatDateSwiss } from "@/lib/dateFormat";
import { useObjectives } from "@/hooks/useObjectives";
import { useObjectiveSubtasks, useUpdateSubtask } from "@/hooks/useSubtasks";
import { useAdminDocs } from "@/hooks/useAdminDocs";
import { useInboxCount } from "@/hooks/useInboxCount";
import { listPayables } from "@/api/payables";
import { listNotes, type ObjectiveNote } from "@/api/objectiveNotes";
import { getAdminComplianceSignal } from "@/api/sorobanSnapshot";
import {
  ADMIN_CHECKLIST_OBJECTIVE_ID, computeGauges, buildTimeline, summarize, assignDomain,
  type Gauge, type GaugeStatus, type DomainKey, type TimelineItem, type ComplianceSummary,
} from "@/lib/adminCompliance";

interface Props {
  /** Switch to a sibling tab within AdminSpace (triage / documents). */
  onNavigateTab?: (tab: "triage" | "documents") => void;
}

/** Anything within this many days (or overdue) is "Maintenant"; further out is calm. */
const NOW_HORIZON_DAYS = 14;

const DOMAIN_ICONS: Record<DomainKey, typeof Banknote> = {
  salaire: Banknote, charges: Landmark, compta: Calculator, bouclement: Archive,
  impots: Receipt, tva: Percent, gouvernance: Users,
};
const DOMAIN_LABELS: Record<DomainKey, string> = {
  salaire: "Salaire", charges: "Charges sociales", compta: "Comptabilité",
  bouclement: "Bouclement", impots: "Impôts", tva: "TVA", gouvernance: "Gouvernance",
};
const STATUS_UI: Record<GaugeStatus, { dot: string; chip: string; label: string }> = {
  green: { dot: "bg-emerald-500", chip: "bg-emerald-50 border-emerald-200 text-emerald-700", label: "À jour" },
  amber: { dot: "bg-amber-400",   chip: "bg-amber-50 border-amber-200 text-amber-700",       label: "À préparer" },
  red:   { dot: "bg-red-500",     chip: "bg-red-50 border-red-200 text-red-700",             label: "En retard" },
  na:    { dot: "bg-muted-foreground/40", chip: "bg-muted/50 border-border text-muted-foreground", label: "Hors saison" },
};

function dueLabel(days: number, iso: string): { text: string; cls: string } {
  if (days < 0)  return { text: `En retard ${Math.abs(days)} j`, cls: "text-destructive font-semibold" };
  if (days === 0) return { text: "Aujourd'hui", cls: "text-destructive font-semibold" };
  if (days <= 7)  return { text: `Dans ${days} j`, cls: "text-amber-600 font-medium" };
  if (days <= 30) return { text: `Dans ${days} j`, cls: "text-amber-600" };
  return { text: `le ${formatDateSwiss(iso)}`, cls: "text-muted-foreground" };
}
function stripColor(days: number): string {
  if (days < 0)  return "bg-red-500";
  if (days <= 7) return "bg-amber-400";
  if (days <= 30) return "bg-amber-300";
  return "bg-emerald-400";
}

/** Pull numbered / bulleted lines out of a how-to note as guided micro-steps. */
function parseSteps(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^(\d+[.)]|[-*•])\s+/.test(l))
    .map((l) => l.replace(/^(\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean);
}

function NowCard({
  now, nextUp, summary, guideNote, objectiveHref, onDone, busy, focus, onToggleFocus,
}: {
  now: TimelineItem | null;
  nextUp: TimelineItem | null;
  summary: ComplianceSummary;
  guideNote: ObjectiveNote | null;
  objectiveHref: string;
  onDone: (item: TimelineItem) => void;
  busy: boolean;
  focus: boolean;
  onToggleFocus: () => void;
}) {
  const [openGuide, setOpenGuide] = useState(false);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  useEffect(() => { setDoneSteps(new Set()); setOpenGuide(false); }, [now?.id]);

  const steps = useMemo(() => (guideNote ? parseSteps(guideNote.content) : []), [guideNote]);
  const allStepsDone = steps.length > 0 && doneSteps.size >= steps.length;

  const focusToggle = (
    <button
      type="button"
      onClick={onToggleFocus}
      aria-pressed={focus}
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border transition shrink-0",
        focus ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      <Crosshair size={12} /> Focus
    </button>
  );

  const summaryLine = (
    <p className="text-xs text-muted-foreground/80 mt-3 flex items-center gap-1.5 flex-wrap">
      <ShieldCheck size={12} className={summary.allClear ? "text-emerald-600" : "text-muted-foreground"} />
      {summary.allClear ? "Tous les domaines applicables sont à jour" : `${summary.upToDate}/${summary.applicable} domaines à jour`}
      {summary.naCount > 0 && <span className="text-muted-foreground/60">· {summary.naCount} hors saison</span>}
    </p>
  );

  if (!now) {
    return (
      <div className="rounded-2xl border bg-emerald-50/50 border-emerald-200 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-xl p-2.5 bg-emerald-100 text-emerald-700 shrink-0"><ShieldCheck size={22} /></div>
            <div className="min-w-0">
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">Tout est en ordre</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {nextUp ? (
                  <>Rien d'urgent. Prochaine échéance : <span className="font-medium text-foreground">{nextUp.label}</span> {dueLabel(nextUp.daysUntil, nextUp.dueISO).text.toLowerCase()}.</>
                ) : (
                  "Rien à l'horizon. Profite."
                )}
              </p>
            </div>
          </div>
          {focusToggle}
        </div>
        {summaryLine}
      </div>
    );
  }

  const dl = dueLabel(now.daysUntil, now.dueISO);
  return (
    <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-eyebrow text-primary">Maintenant</span>
        {focusToggle}
      </div>
      <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight leading-snug">{now.label}</h2>
      <div className="flex items-center gap-2 mt-1.5 text-xs flex-wrap">
        {now.domain && <span className="text-muted-foreground">{DOMAIN_LABELS[now.domain]}</span>}
        <span className={dl.cls}>{dl.text}</span>
        {now.amount != null && <span className="text-muted-foreground tabular-nums">· {formatChf(now.amount)} CHF</span>}
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {now.kind === "subtask" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onDone(now)}
            className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground px-3.5 py-2 hover:bg-primary/90 transition disabled:opacity-60"
          >
            <Check size={15} /> C'est fait
          </button>
        ) : (
          <Link
            to="/tresorerie?tab=payables"
            className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground px-3.5 py-2 hover:bg-primary/90 transition"
          >
            <Wallet size={15} /> Voir le paiement
          </Link>
        )}
        {steps.length > 0 && (
          <button
            type="button"
            onClick={() => setOpenGuide((o) => !o)}
            className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg border px-3 py-2 hover:border-primary/40 transition"
          >
            <BookOpen size={14} /> Comment faire
            <ChevronDown size={13} className={cn("transition", openGuide && "rotate-180")} />
          </button>
        )}
        <Link to={objectiveHref} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition px-1">
          Ouvrir la checklist <ArrowRight size={12} />
        </Link>
      </div>

      {openGuide && steps.length > 0 && (
        <div className="mt-3 rounded-xl border bg-card/60 p-3 space-y-1.5">
          {steps.map((s, i) => {
            const done = doneSteps.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setDoneSteps((prev) => {
                  const n = new Set(prev);
                  if (n.has(i)) n.delete(i); else n.add(i);
                  return n;
                })}
                className="flex items-start gap-2 w-full text-left text-sm"
              >
                {done
                  ? <Check size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                  : <Circle size={15} className="text-muted-foreground/40 mt-0.5 shrink-0" />}
                <span className={cn(done && "line-through text-muted-foreground")}>{s}</span>
              </button>
            );
          })}
          {allStepsDone && (
            <p className="text-xs text-emerald-700 pt-1 flex items-center gap-1">
              <Sparkles size={11} /> Étapes faites — coche « C'est fait ».
            </p>
          )}
        </div>
      )}

      {summaryLine}
    </div>
  );
}

function GaugeCard({ gauge }: { gauge: Gauge }) {
  const ui = STATUS_UI[gauge.status];
  const Icon = DOMAIN_ICONS[gauge.key];
  return (
    <div className="rounded-xl border p-3.5 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", ui.dot)} />
        <Icon size={15} className="text-muted-foreground shrink-0" />
        <span className="font-medium text-sm truncate">{gauge.label}</span>
        <span className={cn("ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0", ui.chip)}>
          {ui.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{gauge.reason}</p>
      {gauge.phase2Note && (
        <p className="text-[10px] text-muted-foreground/70 italic flex items-start gap-1">
          <Sparkles size={10} className="mt-0.5 shrink-0" />
          {gauge.phase2Note}
        </p>
      )}
      {gauge.nextAction && (
        <Link
          to={gauge.nextAction.href}
          className="text-xs font-medium text-primary inline-flex items-center gap-1 mt-auto pt-0.5 hover:underline"
        >
          {gauge.nextAction.label}
          <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const dl = dueLabel(item.daysUntil, item.dueISO);
  return (
    <li className="flex items-center gap-3 border rounded-lg p-2.5">
      <div className={cn("w-1.5 h-8 rounded-full shrink-0", stripColor(item.daysUntil))} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.label}</div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
          {item.domain && <span>{DOMAIN_LABELS[item.domain]}</span>}
          <span className={dl.cls}>{dl.text}</span>
        </div>
      </div>
      {item.amount != null && (
        <span className="text-xs text-muted-foreground tabular-nums shrink-0">{formatChf(item.amount)} CHF</span>
      )}
    </li>
  );
}

function Shortcut({ icon: Icon, label, count }: { icon: typeof Banknote; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border p-2.5 bg-card hover:border-primary/40 transition h-full">
      <Icon size={16} className="text-primary shrink-0" />
      <span className="text-xs font-medium truncate">{label}</span>
      {count != null && count > 0 && (
        <span className="ml-auto text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </div>
  );
}

export function AdminOverviewTab({ onNavigateTab }: Props) {
  const today = useMemo(() => new Date(), []);
  const [focus, setFocus] = useState(false);

  const { data: objectives, isLoading: objLoading } = useObjectives();
  const adminObj = objectives?.find(
    (o) => o.source === "admin" && (o.id === ADMIN_CHECKLIST_OBJECTIVE_ID || /checklists?\s+admin/i.test(o.text)),
  );
  const objectiveId = adminObj?.id ?? ADMIN_CHECKLIST_OBJECTIVE_ID;

  const { data: subtasks = [], isLoading: subLoading } = useObjectiveSubtasks(objectiveId);
  const { data: payables = [] } = useQuery({
    queryKey: ["admin-center", "payables"],
    queryFn: () => listPayables(),
    staleTime: 60_000,
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["objective-notes", "admin", objectiveId],
    queryFn: () => listNotes("admin", objectiveId),
    staleTime: 60_000,
    enabled: !!objectiveId,
  });
  const { data: signal } = useQuery({
    queryKey: ["soroban", "admin-compliance"],
    queryFn: getAdminComplianceSignal,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const { pendingCount: pendingDocs } = useAdminDocs();
  const { pendingCount: inboxCount } = useInboxCount({ enabled: true });
  const updateSubtask = useUpdateSubtask();

  const gauges = useMemo(() => computeGauges({ subtasks, payables, today, signal: signal ?? undefined }), [subtasks, payables, today, signal]);
  const timeline = useMemo(() => buildTimeline({ subtasks, payables, today }), [subtasks, payables, today]);
  const summary = useMemo(() => summarize(gauges), [gauges]);
  const pinned = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  const flatTimeline = useMemo(() => timeline.flatMap((b) => b.items), [timeline]);
  const nextUp = flatTimeline[0] ?? null;
  const now = nextUp && nextUp.daysUntil <= NOW_HORIZON_DAYS ? nextUp : null;
  const guideNote = useMemo(
    () => (now?.domain ? pinned.find((n) => assignDomain(n.title) === now.domain) ?? null : null),
    [now, pinned],
  );

  function markDone(item: TimelineItem) {
    if (item.kind === "subtask") updateSubtask.mutate({ id: item.id, patch: { completed: true } });
  }

  if ((objLoading || subLoading) && subtasks.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!objLoading && !subLoading && subtasks.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="border rounded-2xl px-5 py-12 text-center">
          <ShieldAlert size={28} className="mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">Checklist admin introuvable</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            L'objectif « Sàrl — Checklists admin » n'a pas encore de sous-tâches. Le centre s'alimente
            automatiquement dès qu'elles existent.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Maintenant — the one next action */}
      <NowCard
        now={now}
        nextUp={nextUp}
        summary={summary}
        guideNote={guideNote}
        objectiveHref={`/objective/admin/${objectiveId}`}
        onDone={markDone}
        busy={updateSubtask.isPending}
        focus={focus}
        onToggleFocus={() => setFocus((f) => !f)}
      />

      {!focus && (
        <>
          {/* Raccourcis */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button type="button" onClick={() => onNavigateTab?.("triage")} className="block text-left">
              <Shortcut icon={ScanLine} label="À trier" count={pendingDocs} />
            </button>
            <Link to="/home" className="block"><Shortcut icon={Inbox} label="Captures" count={inboxCount} /></Link>
            <Link to="/tresorerie?tab=payables" className="block"><Shortcut icon={Wallet} label="Paiements" /></Link>
            <Link to="/relances" className="block"><Shortcut icon={BellRing} label="Relances" /></Link>
          </div>

          {/* Jauges de conformité */}
          <SectionCard
            icon={ShieldCheck}
            title="Conformité"
            subtitle={`${summary.upToDate}/${summary.applicable} à jour`}
            action={signal ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 inline-flex items-center gap-1 shrink-0">
                <Sparkles size={10} /> Soroban{signal.as_of ? ` · ${formatDateSwiss(signal.as_of)}` : ""}
              </span>
            ) : undefined}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {gauges.map((g) => <GaugeCard key={g.key} gauge={g} />)}
            </div>
          </SectionCard>

          {/* Timeline */}
          <SectionCard icon={CalendarClock} title="À faire" subtitle="échéances">
            {timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-6">Aucune échéance à venir. 🎉</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((bucket) => (
                  <div key={bucket.key}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className={cn("text-eyebrow", bucket.key === "overdue" && "text-destructive")}>{bucket.label}</h3>
                      <span className="text-[10px] text-muted-foreground">{bucket.items.length}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {bucket.items.map((it) => <TimelineRow key={`${it.kind}-${it.id}`} item={it} />)}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Aide & modes d'emploi */}
          <SectionCard icon={BookOpen} title="Aide & modes d'emploi">
            <div className="space-y-3">
              {pinned.length > 0 ? (
                pinned.map((n) => (
                  <details key={n.id} className="group rounded-lg border px-3 py-2">
                    <summary className="cursor-pointer list-none flex items-center gap-2 text-sm font-medium">
                      <FileText size={14} className="text-primary shrink-0" />
                      <span className="truncate">{n.title || "Note"}</span>
                      <ChevronRight size={14} className="ml-auto text-muted-foreground transition group-open:rotate-90" />
                    </summary>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-2 leading-relaxed">{n.content}</p>
                  </details>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">Aucun mode d'emploi épinglé pour l'instant.</p>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  to={`/objective/admin/${objectiveId}`}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border px-3 py-1.5 hover:border-primary/40 hover:text-primary transition"
                >
                  <ArrowRight size={13} /> Toute la checklist
                </Link>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.("documents")}
                  className="inline-flex items-center gap-1.5 text-xs font-medium rounded-lg border px-3 py-1.5 hover:border-primary/40 hover:text-primary transition"
                >
                  <BookOpen size={13} /> Bibliothèque de documents
                </button>
              </div>

              <p className="text-[11px] text-muted-foreground/70 flex items-start gap-1.5 pt-1">
                <Landmark size={12} className="mt-0.5 shrink-0" />
                Fiche de salaire &amp; états financiers : générés dans <span className="font-medium">Soroban</span> (application comptable locale).
              </p>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
