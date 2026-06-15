import type { CaptureKind } from "@/api/inboxCaptures";

/**
 * Triage suggestion engine — given a capture and the live objectives/projects,
 * compute the single most-likely destination so the operator can route it in
 * one tap instead of walking a picker every time.
 *
 * Pure + structurally typed (real UnifiedObjective / StoredProject satisfy the
 * Like shapes). Only ever suggests when there's a real signal (a project tag
 * or a name/keyword hit) — never a blind default, so the suggestion stays
 * trustworthy. Returns null when there's nothing confident to propose.
 */

export interface SuggestCaptureLike {
  text: string;
  kind: CaptureKind | null;
  project_hint: string | null;
}
export interface SuggestObjectiveLike {
  id: string;
  text: string;
  category?: string | null;
}
export interface SuggestProjectLike {
  id: string;
  title: string;
  client?: string;
}

export interface TriageSuggestion {
  /** Notes can land on a project or objective; subtasks only on an objective. */
  action: "subtask" | "note";
  targetKind: "objective" | "project";
  targetId: string;
  /** Ready-to-render pill label, e.g. "Étape · Refonte Acme". */
  label: string;
  confidence: "high" | "medium";
}

function trimLabel(s: string): string {
  const t = s.trim();
  return t.length > 40 ? t.slice(0, 39) + "…" : t;
}

/** Score how well a candidate (name + secondary field) matches the capture. */
function scoreCandidate(name: string, secondary: string | undefined, hint: string, text: string): number {
  const nameL = name.toLowerCase().trim();
  const secL = (secondary ?? "").toLowerCase().trim();
  const hintL = hint.toLowerCase().trim();
  const textL = text.toLowerCase();
  let s = 0;
  if (hintL) {
    if (nameL && nameL === hintL) s += 10;
    else if (nameL && (nameL.includes(hintL) || hintL.includes(nameL))) s += 6;
    if (secL && secL.includes(hintL)) s += 4;
  }
  if (nameL.length >= 3 && textL.includes(nameL)) s += 5;
  if (secL.length >= 3 && textL.includes(secL)) s += 4;
  return s;
}

function bestMatch<T>(
  items: T[],
  name: (t: T) => string,
  secondary: (t: T) => string | undefined,
  hint: string,
  text: string,
): { item: T; score: number } | null {
  let best: { item: T; score: number } | null = null;
  for (const it of items) {
    const score = scoreCandidate(name(it), secondary(it), hint, text);
    if (score > 0 && (!best || score > best.score)) best = { item: it, score };
  }
  return best;
}

const conf = (score: number): "high" | "medium" => (score >= 6 ? "high" : "medium");

/**
 * @param objectives  Active objectives only (caller filters out completed).
 * @param projects    Active projects only (caller filters out completed).
 */
export function suggestTriage(
  capture: SuggestCaptureLike,
  objectives: SuggestObjectiveLike[],
  projects: SuggestProjectLike[],
): TriageSuggestion | null {
  const hint = capture.project_hint ?? "";
  const text = capture.text ?? "";
  const actionable = capture.kind === "todo" || capture.kind === "urgent";

  const bestObj = bestMatch(objectives, (o) => o.text, (o) => o.category ?? undefined, hint, text);

  // Actionable captures want to become a step → only an objective can host a
  // subtask. No objective match → no confident suggestion (user picks).
  if (actionable) {
    if (!bestObj) return null;
    return {
      action: "subtask",
      targetKind: "objective",
      targetId: bestObj.item.id,
      label: `Étape · ${trimLabel(bestObj.item.text)}`,
      confidence: conf(bestObj.score),
    };
  }

  // Note-ish (note / idea) and untyped → file as a note on the best target.
  const bestProj = bestMatch(projects, (p) => p.title, (p) => p.client, hint, text);
  const candidates: { kind: "project" | "objective"; id: string; label: string; score: number }[] = [];
  if (bestProj) candidates.push({ kind: "project", id: bestProj.item.id, label: bestProj.item.title, score: bestProj.score });
  if (bestObj) candidates.push({ kind: "objective", id: bestObj.item.id, label: bestObj.item.text, score: bestObj.score });
  if (candidates.length === 0) return null;

  // Highest score wins; on a tie prefer the project (a tagged client note is
  // more often a project meeting note than an objective note).
  candidates.sort((a, b) => b.score - a.score || (a.kind === "project" ? -1 : 1));
  const top = candidates[0];
  return {
    action: "note",
    targetKind: top.kind,
    targetId: top.id,
    label: `Note · ${trimLabel(top.label)}`,
    confidence: conf(top.score),
  };
}
