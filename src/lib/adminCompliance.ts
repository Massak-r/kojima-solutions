// Admin compliance engine — the brains behind the "Centre admin" overview.
//
// Pure, framework-free derivation of the admin help-center cockpit from Kojima's
// own objects: the "Sàrl — Checklists admin" objective subtasks + admin payables.
// It answers the three questions the center poses ("suis-je en règle ? que faire
// et quand ? comment ?") as compliance gauges + a bucketed deadline timeline.
//
// Design contract (see Soroban/CENTRE-ADMIN-KOJIMA.md §3-§5):
//  - Gauges are derived from real facts, never declared green by hand.
//  - Seasonal obligations (bouclement, impôts, gouvernance) go N-A when out of
//    season instead of red — we only alarm what is truly due.
//  - HONESTY CAP (Phase 1): domains whose ground truth lives in Soroban (salaire
//    comptabilisé, compta/rapprochement, real TVA threshold) never assert "red"
//    without the Soroban signal — they cap at amber ("à confirmer"). When the
//    `signal` (admin_compliance snapshot) is imported in Phase 2, those gauges
//    sharpen to real green/red.
//
// No Date.now() here — callers pass `today` so the logic stays deterministic and
// testable, matching forecast.ts / recurrencePeriod.ts.

import type { SubtaskItem, Recurrence } from "@/api/todoSubtasks";
import type { Payable } from "@/types/payable";
import { formatDateSwiss } from "./dateFormat";

/** The seeded "Sàrl — Checklists admin" objective (admin source). Stable id. */
export const ADMIN_CHECKLIST_OBJECTIVE_ID = "96c0b590-8edf-45b2-a93f-9aff24c2ffd2";

export type GaugeStatus = "green" | "amber" | "red" | "na";

export type DomainKey =
  | "salaire" | "charges" | "compta" | "bouclement" | "impots" | "tva" | "gouvernance";

export interface DomainMeta {
  key: DomainKey;
  label: string;
  /** Ongoing domains are always applicable; seasonal ones go N-A when the next
   *  obligation is beyond the season horizon. */
  seasonal: boolean;
  /** Days before due where an obligation flips to "à préparer" (amber). */
  amberDays: number;
  /** Set when the honest gauge needs a Soroban signal we don't import yet
   *  (Phase 2). Presence also caps Phase-1 severity at amber (no false red). */
  phase2Note?: string;
}

/** Order matters for display (most operational first, seasonal last). */
export const DOMAINS: DomainMeta[] = [
  { key: "salaire",     label: "Salaire",          seasonal: false, amberDays: 7,  phase2Note: "Confirmé « versé + comptabilisé » via Soroban en Phase 2." },
  { key: "charges",     label: "Charges sociales", seasonal: false, amberDays: 21 },
  { key: "compta",      label: "Comptabilité",     seasonal: false, amberDays: 7,  phase2Note: "Saisie + rapprochement bancaire confirmés via Soroban en Phase 2." },
  { key: "tva",         label: "TVA (seuil)",      seasonal: false, amberDays: 21, phase2Note: "Seuil réel (CA 12 mois glissants) via Soroban en Phase 2." },
  { key: "bouclement",  label: "Bouclement",       seasonal: true,  amberDays: 60 },
  { key: "impots",      label: "Impôts",           seasonal: true,  amberDays: 60 },
  { key: "gouvernance", label: "Gouvernance (AG)", seasonal: true,  amberDays: 60 },
];

/** Beyond this many days a seasonal obligation reads as "hors saison" (N-A). */
const SEASON_HORIZON_DAYS = 120;

/** Soroban admin_compliance snapshot (Phase 2 signal). Optional & forward-only:
 *  fields are read defensively so a partial payload still refines what it can. */
export interface AdminComplianceSignal {
  as_of?: string;
  accounting?: { last_entry_date?: string; bank_reconciled_through?: string | null; captures_pending?: number };
  payroll?: { booked_through?: string; months_booked?: string[]; social_charges_provision_cents?: number; social_charges_due_hint?: string };
  closing?: { exercise?: { start?: string; end?: string }; status?: string; financial_statements_ready?: boolean; last_closed_end?: string | null };
  vat?: { revenue_rolling_12m_cents?: number; threshold_cents?: number; headroom_cents?: number; status?: string };
}

export interface ComplianceInput {
  subtasks: SubtaskItem[];
  payables: Payable[];
  today: Date;
  /** When present (Phase 2), refines the Soroban-truth gauges. */
  signal?: AdminComplianceSignal;
}

export interface Obligation {
  id: string;
  label: string;
  domain: DomainKey | null;
  dueISO: string | null;       // effective due (recurrence resolved to next occurrence)
  daysUntil: number | null;
  completed: boolean;
  completedAtISO?: string | null;
  recurring: boolean;
  kind: "subtask" | "payable";
  amount?: number | null;
}

export interface Gauge {
  key: DomainKey;
  label: string;
  status: GaugeStatus;
  reason: string;
  nextAction?: { label: string; href: string };
  phase2Note?: string;
  obligations: Obligation[];
}

export interface TimelineItem {
  id: string;
  label: string;
  dueISO: string;
  daysUntil: number;
  kind: "subtask" | "payable";
  domain?: DomainKey;
  amount?: number | null;
}

export type TimelineBucketKey = "overdue" | "week" | "month" | "quarter" | "year" | "later";
export interface TimelineBucket { key: TimelineBucketKey; label: string; items: TimelineItem[]; }

// ── date helpers (local, midnight-anchored; storage stays ISO) ───────────

export function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function atMidnight(d: Date): Date { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function parseISO(iso: string): Date { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); }

export function daysUntilISO(iso: string, today: Date): number {
  return Math.round((parseISO(iso).getTime() - atMidnight(today).getTime()) / 86_400_000);
}
function sameMonth(iso: string, today: Date): boolean {
  const [y, m] = iso.split("-").map(Number);
  return y === today.getFullYear() && m === today.getMonth() + 1;
}

/** Next calendar occurrence (>= today) of a recurrence, or null. Monthly clamps
 *  the day to the month length so a "day 31" never overflows. */
export function nextOccurrenceISO(today: Date, recurrence: Recurrence | null | undefined, day: number | null | undefined): string | null {
  if (!recurrence) return null;
  const t = atMidnight(today);
  if (recurrence === "monthly") {
    const want = Math.max(day ?? 1, 1);
    const mk = (y: number, mIdx: number) => {
      const dim = new Date(y, mIdx + 1, 0).getDate();
      return new Date(y, mIdx, Math.min(want, dim));
    };
    const thisMonth = mk(t.getFullYear(), t.getMonth());
    return isoOf(thisMonth >= t ? thisMonth : mk(t.getFullYear(), t.getMonth() + 1));
  }
  if (recurrence === "weekly") {
    const wantJs = (day ?? 1) % 7; // ISO 1..7 (Mon=1) → JS 0..6 (Sun=0)
    for (let i = 0; i < 7; i++) {
      const cand = new Date(t); cand.setDate(t.getDate() + i);
      if (cand.getDay() === wantJs) return isoOf(cand);
    }
  }
  // daily / weekdays → today is the next applicable day (good enough for the timeline)
  return isoOf(t);
}

// ── domain assignment (ordered keyword rules; first match wins) ──────────

/** Map a subtask/payable label to its compliance domain, or null (e.g. a
 *  frequency-group header like "Chaque mois"). Order is deliberate: the more
 *  specific / higher-priority concepts are tested first so "déclaration des
 *  salaires à l'OCAS" lands in `charges`, not `salaire`. */
export function assignDomain(text: string): DomainKey | null {
  const s = text.toLowerCase();
  if (/\btva\b|seuil/.test(s)) return "tva";
  if (/boucl|états? financiers|amortissement|exercice/.test(s)) return "bouclement";
  if (/assembl|associés|\bpv\b|procès-verbal/.test(s)) return "gouvernance";
  if (/fiscal|impôt|imposition/.test(s)) return "impots";
  if (/ocas|\blaa\b|\bavs\b|accidents|charges sociales|affilier/.test(s)) return "charges";
  if (/salaire|iban/.test(s)) return "salaire";
  if (/compta|rapprochement|justificatif|pièces/.test(s)) return "compta";
  return null;
}

// ── obligations ─────────────────────────────────────────────────────────

function subtaskObligation(s: SubtaskItem, today: Date): Obligation {
  const recurring = !!s.recurrence;
  const dueISO = s.dueDate ?? (recurring ? nextOccurrenceISO(today, s.recurrence, s.recurrenceDay) : null);
  return {
    id: s.id,
    label: s.text,
    domain: assignDomain(s.text),
    dueISO,
    daysUntil: dueISO ? daysUntilISO(dueISO, today) : null,
    completed: s.completed,
    completedAtISO: s.completedAt ?? null,
    recurring,
    kind: "subtask",
  };
}

function payableObligation(p: Payable, today: Date): Obligation {
  return {
    id: p.id,
    label: p.label,
    domain: assignDomain(`${p.label} ${p.category ?? ""}`),
    dueISO: p.dueDate ?? null,
    daysUntil: p.dueDate ? daysUntilISO(p.dueDate, today) : null,
    completed: p.status === "paid" || p.status === "cancelled",
    completedAtISO: p.paidAt ?? null,
    recurring: p.recurrence !== "none",
    kind: "payable",
    amount: p.amount,
  };
}

/** All actionable obligations (drops frequency-group headers: no domain & no due). */
export function buildObligations(input: ComplianceInput): Obligation[] {
  const { subtasks, payables, today } = input;
  return [
    ...subtasks.map((s) => subtaskObligation(s, today)),
    ...payables.map((p) => payableObligation(p, today)),
  ].filter((o) => o.domain !== null || o.dueISO !== null);
}

// ── gauges ───────────────────────────────────────────────────────────────

function doneThisPeriod(o: Obligation, today: Date): boolean {
  if (!o.completed) return false;
  if (!o.completedAtISO) return true; // completed, no timestamp → assume current period
  return sameMonth(o.completedAtISO.slice(0, 10), today);
}

function nearestOpen(obs: Obligation[]): Obligation | null {
  return obs
    .filter((o) => !o.completed && o.dueISO)
    .sort((a, b) => (a.daysUntil! - b.daysUntil!))[0] ?? null;
}

function nextAction(meta: DomainMeta, nearest: Obligation | null): { label: string; href: string } {
  const trunc = (s: string) => (s.length > 38 ? s.slice(0, 37) + "…" : s);
  if (nearest?.kind === "payable") return { label: "Voir le paiement", href: "/tresorerie?tab=payables" };
  return {
    label: nearest ? `Ouvrir : ${trunc(nearest.label)}` : "Ouvrir la checklist",
    href: `/objective/admin/${ADMIN_CHECKLIST_OBJECTIVE_ID}`,
  };
}

function signalRefine(meta: DomainMeta, signal: AdminComplianceSignal, today: Date): Pick<Gauge, "status" | "reason"> | null {
  // Minimal, presence-guarded Phase-2 refinements. Returns null to fall through
  // to the task-based logic when the signal can't speak to this domain.
  if (meta.key === "salaire" && signal.payroll?.booked_through) {
    const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const booked = signal.payroll.months_booked?.includes(cur) || signal.payroll.booked_through >= cur;
    return booked
      ? { status: "green", reason: "Salaire du mois versé et comptabilisé (Soroban)." }
      : { status: "amber", reason: "Salaire du mois pas encore comptabilisé (Soroban)." };
  }
  if (meta.key === "compta" && (signal.accounting?.last_entry_date || signal.accounting?.captures_pending != null)) {
    const pending = signal.accounting?.captures_pending ?? 0;
    const last = signal.accounting?.last_entry_date;
    const stale = last ? daysUntilISO(last, today) < -31 : true;
    if (pending > 0) return { status: "amber", reason: `${pending} pièce(s) « À classer » en attente (Soroban).` };
    if (stale) return { status: "amber", reason: "Saisie comptable en retard (Soroban)." };
    return { status: "green", reason: "Saisie à jour, rien en attente (Soroban)." };
  }
  if (meta.key === "tva" && signal.vat && signal.vat.threshold_cents) {
    const rev = signal.vat.revenue_rolling_12m_cents ?? 0;
    const thr = signal.vat.threshold_cents;
    const ratio = thr > 0 ? rev / thr : 0;
    if (ratio >= 1) return { status: "red", reason: "Seuil TVA atteint — assujettissement déclenché (Soroban)." };
    if (ratio >= 0.8) return { status: "amber", reason: `CA 12 mois à ${Math.round(ratio * 100)} % du seuil (Soroban).` };
    return { status: "green", reason: `CA 12 mois à ${Math.round(ratio * 100)} % du seuil — marge confortable.` };
  }
  return null;
}

function gaugeFor(meta: DomainMeta, all: Obligation[], today: Date, signal?: AdminComplianceSignal): Gauge {
  const obs = all.filter((o) => o.domain === meta.key);
  const n = nearestOpen(obs);

  let status: GaugeStatus;
  let reason: string;

  const refined = signal ? signalRefine(meta, signal, today) : null;
  if (refined) {
    ({ status, reason } = refined);
  } else if (meta.seasonal) {
    if (!n) { status = obs.length ? "green" : "na"; reason = obs.length ? "Tout est à jour." : "Rien en cours."; }
    else if (n.daysUntil! < 0) { status = "red"; reason = `${n.label} : échéance dépassée (${formatDateSwiss(n.dueISO!)}).`; }
    else if (n.daysUntil! > SEASON_HORIZON_DAYS) { status = "na"; reason = `Hors saison — prochaine échéance le ${formatDateSwiss(n.dueISO!)}.`; }
    else if (n.daysUntil! <= meta.amberDays) { status = "amber"; reason = `À préparer : ${n.label} (${formatDateSwiss(n.dueISO!)}).`; }
    else { status = "green"; reason = `Prochaine échéance le ${formatDateSwiss(n.dueISO!)}.`; }
  } else if (meta.key === "salaire" || meta.key === "compta") {
    const monthly = obs.find((o) => o.recurring) ?? null;
    if (monthly && doneThisPeriod(monthly, today)) {
      status = "green";
      reason = meta.key === "salaire" ? "Salaire du mois fait." : "Saisie du mois faite.";
    } else {
      const targetDay = meta.key === "salaire" ? 25 : 5;
      if (today.getDate() <= targetDay - meta.amberDays) {
        status = "green";
        reason = `À faire vers le ${targetDay} du mois.`;
      } else {
        status = "amber";
        reason = meta.key === "salaire" ? `À verser / établir (le ${targetDay}).` : "Saisie du mois à confirmer.";
      }
    }
  } else {
    // discrete ongoing domains (charges, …)
    if (!n) { status = obs.length ? "green" : "na"; reason = obs.length ? "Tout est à jour." : "Rien en attente."; }
    else if (n.daysUntil! < 0) { status = "red"; reason = `${n.label} : en retard (${formatDateSwiss(n.dueISO!)}).`; }
    else if (n.daysUntil! <= meta.amberDays) { status = "amber"; reason = `À préparer : ${n.label} (${formatDateSwiss(n.dueISO!)}).`; }
    else { status = "green"; reason = `Prochaine : ${n.label} (${formatDateSwiss(n.dueISO!)}).`; }
  }

  // Honesty cap: a Soroban-truth domain can't be asserted "red" without the signal.
  if (meta.phase2Note && !signal && status === "red") status = "amber";

  return {
    key: meta.key,
    label: meta.label,
    status,
    reason,
    nextAction: nextAction(meta, n),
    phase2Note: signal ? undefined : meta.phase2Note,
    obligations: obs,
  };
}

export function computeGauges(input: ComplianceInput): Gauge[] {
  const all = buildObligations(input);
  return DOMAINS.map((meta) => gaugeFor(meta, all, input.today, input.signal));
}

// ── timeline ─────────────────────────────────────────────────────────────

const BUCKET_LABELS: Record<TimelineBucketKey, string> = {
  overdue: "En retard",
  week: "Cette semaine",
  month: "Ce mois-ci",
  quarter: "Ce trimestre",
  year: "Cette année",
  later: "Plus tard",
};
const BUCKET_ORDER: TimelineBucketKey[] = ["overdue", "week", "month", "quarter", "year", "later"];

function bucketOf(daysUntil: number): TimelineBucketKey {
  if (daysUntil < 0) return "overdue";
  if (daysUntil <= 7) return "week";
  if (daysUntil <= 31) return "month";
  if (daysUntil <= 92) return "quarter";
  if (daysUntil <= 366) return "year";
  return "later";
}

/** Merge open subtask + payable deadlines into rolling-window buckets, soonest first. */
export function buildTimeline(input: ComplianceInput): TimelineBucket[] {
  const items = buildObligations(input)
    .filter((o) => !o.completed && o.dueISO)
    .map<TimelineItem>((o) => ({
      id: o.id,
      label: o.label,
      dueISO: o.dueISO!,
      daysUntil: o.daysUntil!,
      kind: o.kind,
      domain: o.domain ?? undefined,
      amount: o.amount,
    }))
    .sort((a, b) => a.dueISO.localeCompare(b.dueISO));

  const grouped: Record<TimelineBucketKey, TimelineItem[]> =
    { overdue: [], week: [], month: [], quarter: [], year: [], later: [] };
  for (const it of items) grouped[bucketOf(it.daysUntil)].push(it);

  return BUCKET_ORDER
    .map((key) => ({ key, label: BUCKET_LABELS[key], items: grouped[key] }))
    .filter((b) => b.items.length > 0);
}

// ── summary ──────────────────────────────────────────────────────────────

const SEVERITY: Record<GaugeStatus, number> = { red: 3, amber: 2, green: 1, na: 0 };

export interface ComplianceSummary {
  upToDate: number;     // green among applicable
  applicable: number;   // not N-A
  naCount: number;      // N-A (hors saison)
  allClear: boolean;
  worst: Gauge | null;  // most pressing applicable, non-green domain
}

export function summarize(gauges: Gauge[]): ComplianceSummary {
  const applicable = gauges.filter((g) => g.status !== "na");
  const upToDate = applicable.filter((g) => g.status === "green").length;
  const worst = applicable
    .filter((g) => g.status !== "green")
    .sort((a, b) => SEVERITY[b.status] - SEVERITY[a.status])[0] ?? null;
  return {
    upToDate,
    applicable: applicable.length,
    naCount: gauges.length - applicable.length,
    allClear: applicable.length > 0 && upToDate === applicable.length,
    worst,
  };
}
