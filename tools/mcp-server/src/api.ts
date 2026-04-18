// Thin HTTP client that proxies into the existing PHP API.
// All business logic (validation, schema, auth) stays server-side.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Load env from a .env next to the package (so users can edit one file and
// not have to pass --env flags through `claude mcp add`).
function loadDotEnv(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  // dist/api.js → ../  is the package root; src/api.ts via tsx → also ../
  const candidates = [resolve(here, "..", ".env"), resolve(here, "..", "..", ".env")];
  for (const path of candidates) {
    try {
      const text = readFileSync(path, "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq < 0) continue;
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (process.env[key] === undefined) process.env[key] = val;
      }
      return;
    } catch { /* try next */ }
  }
}
loadDotEnv();

const BASE = (process.env.KOJIMA_API_BASE ?? "https://kojima-solutions.ch").replace(/\/$/, "");
const KEY  = process.env.KOJIMA_API_KEY ?? "";

if (!KEY) {
  console.error("[kojima-mcp] WARNING: KOJIMA_API_KEY env is empty. PHP API will reject requests if API_SECRET is configured.");
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (KEY) headers["X-API-Key"] = KEY;

  const res = await fetch(`${BASE}/api/${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} → HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type ObjectiveSource = "admin" | "personal";

export interface ObjectiveSummary {
  id: string;
  text: string;
  completed: boolean;
  category?: string;
  dueDate?: string | null;
  isObjective: boolean;
  priority: "low" | "medium" | "high";
  status: "not_started" | "in_progress" | "done" | "blocked";
  description?: string | null;
  smartSpecific?: string | null;
  smartMeasurable?: string | null;
  smartAchievable?: string | null;
  smartRelevant?: string | null;
  definitionOfDone?: string | null;
  linkedProjectId?: string | null;
  linkedClientId?: string | null;
  order: number;
  createdAt: string;
}

export interface SubtaskItem {
  id: string;
  source: ObjectiveSource;
  parentId: string;
  parentSubtaskId?: string | null;
  text: string;
  completed: boolean;
  dueDate?: string;
  order: number;
  priority: "low" | "medium" | "high";
  status: "not_started" | "in_progress" | "done" | "blocked";
  flaggedToday: boolean;
  effortSize?: "rapide" | "moyen" | "complexe" | null;
  estimatedMinutes?: number | null;
  description?: string | null;
  createdAt: string;
}

export interface ObjectiveSession {
  id: string;
  source: ObjectiveSource;
  objectiveId: string;
  subtaskId?: string | null;
  startedAt: string;
  endedAt?: string | null;
  durationSec?: number | null;
  note?: string | null;
  accuracy?: "faster" | "on_target" | "slower" | null;
}

// ── Objectives ───────────────────────────────────────────────────
export const listAdminObjectives    = ()                                              => call<ObjectiveSummary[]>("admin_todos.php");
export const listPersonalObjectives = ()                                              => call<ObjectiveSummary[]>("personal_todos.php");
export const updateAdminObjective   = (id: string, patch: Partial<ObjectiveSummary>)  => call<ObjectiveSummary>(`admin_todos.php?id=${id}`,    { method: "PUT", body: JSON.stringify(patch) });
export const updatePersonalObjective= (id: string, patch: Partial<ObjectiveSummary>)  => call<ObjectiveSummary>(`personal_todos.php?id=${id}`, { method: "PUT", body: JSON.stringify(patch) });

// ── Subtasks ─────────────────────────────────────────────────────
export const listSubtasks = (objectiveId: string, source: ObjectiveSource) =>
  call<SubtaskItem[]>(`todo_subtasks.php?source=${source}&parent_id=${objectiveId}`);

export const createSubtask = (data: {
  parentId: string;
  source: ObjectiveSource;
  text: string;
  parentSubtaskId?: string | null;
  dueDate?: string;
  priority?: SubtaskItem["priority"];
  effortSize?: SubtaskItem["effortSize"];
  estimatedMinutes?: number | null;
  flaggedToday?: boolean;
  description?: string;
}) => call<SubtaskItem>("todo_subtasks.php", { method: "POST", body: JSON.stringify(data) });

export const updateSubtask = (id: string, patch: Partial<SubtaskItem>) =>
  call<SubtaskItem>(`todo_subtasks.php?id=${id}`, { method: "PUT", body: JSON.stringify(patch) });

// ── Sessions ─────────────────────────────────────────────────────
export const listSessions = (source: ObjectiveSource, objectiveId: string) =>
  call<ObjectiveSession[]>(`objective_sessions.php?source=${source}&objective_id=${objectiveId}`);

export const startSession = (data: {
  source: ObjectiveSource;
  objectiveId: string;
  subtaskId?: string | null;
}) => call<ObjectiveSession>("objective_sessions.php", { method: "POST", body: JSON.stringify(data) });

export const stopSession = (id: string, note?: string) =>
  call<ObjectiveSession>(`objective_sessions.php?id=${id}&action=stop`, { method: "POST", body: JSON.stringify({ note }) });

export const patchSession = (id: string, data: { accuracy?: ObjectiveSession["accuracy"]; note?: string | null }) =>
  call<ObjectiveSession>(`objective_sessions.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const getGlobalWeekSummary = () =>
  call<{
    totalSec: number;
    sessionCount: number;
    byDay: { date: string; sec: number }[];
    weekStart: string;
    byObjective: { source: ObjectiveSource; objectiveId: string; sec: number; sessionCount: number }[];
  }>("objective_sessions.php?summary=week&all=1");
