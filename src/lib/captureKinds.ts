import type { CaptureKind } from "@/api/inboxCaptures";

export interface CaptureKindMeta {
  kind: CaptureKind;
  emoji: string;
  label: string;
  /** Tailwind classes for the active chip / inbox badge. */
  badge: string;
}

/** Single source of truth for the optional capture types — shared by the
 *  quick-capture chips and the inbox triage badge so they never drift. */
export const CAPTURE_KINDS: CaptureKindMeta[] = [
  { kind: "idea",   emoji: "💡", label: "Idée",   badge: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { kind: "todo",   emoji: "✅", label: "Todo",   badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { kind: "note",   emoji: "🗒️", label: "Note",   badge: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { kind: "urgent", emoji: "⚡", label: "Urgent", badge: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
];

export const CAPTURE_KIND_MAP: Record<CaptureKind, CaptureKindMeta> =
  Object.fromEntries(CAPTURE_KINDS.map((k) => [k.kind, k])) as Record<CaptureKind, CaptureKindMeta>;
