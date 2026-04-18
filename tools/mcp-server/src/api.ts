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

// ── Notes ────────────────────────────────────────────────────────
export interface ObjectiveNote {
  id: string;
  source: ObjectiveSource;
  objectiveId: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listNotes = (source: ObjectiveSource, objectiveId: string) =>
  call<ObjectiveNote[]>(`objective_notes.php?source=${source}&objective_id=${objectiveId}`);

export const createNote = (data: {
  source: ObjectiveSource;
  objectiveId: string;
  title?: string;
  content?: string;
  pinned?: boolean;
}) => call<ObjectiveNote>("objective_notes.php", { method: "POST", body: JSON.stringify(data) });

export const updateNote = (id: string, patch: Partial<Pick<ObjectiveNote, "title" | "content" | "pinned">>) =>
  call<ObjectiveNote>(`objective_notes.php?id=${id}`, { method: "PUT", body: JSON.stringify(patch) });

export const deleteNote = (id: string) =>
  call<void>(`objective_notes.php?id=${id}`, { method: "DELETE" });

// ── Decisions ────────────────────────────────────────────────────
export interface ObjectiveDecision {
  id: string;
  source: ObjectiveSource;
  objectiveId: string;
  title: string;
  rationale?: string | null;
  decidedAt: string;
}

export const listDecisions = (source: ObjectiveSource, objectiveId: string) =>
  call<ObjectiveDecision[]>(`objective_decisions.php?source=${source}&objective_id=${objectiveId}`);

export const createDecision = (data: {
  source: ObjectiveSource;
  objectiveId: string;
  title: string;
  rationale?: string;
  decidedAt?: string;
}) => call<ObjectiveDecision>("objective_decisions.php", { method: "POST", body: JSON.stringify(data) });

export const updateDecision = (id: string, patch: Partial<Pick<ObjectiveDecision, "title" | "rationale" | "decidedAt">>) =>
  call<ObjectiveDecision>(`objective_decisions.php?id=${id}`, { method: "PUT", body: JSON.stringify(patch) });

// ── Activity ─────────────────────────────────────────────────────
export interface ObjectiveActivity {
  id: string;
  source: ObjectiveSource;
  objectiveId: string;
  kind: string;
  payload: unknown | null;
  createdAt: string;
}

export const listActivity = (source: ObjectiveSource, objectiveId: string, limit = 50) =>
  call<ObjectiveActivity[]>(`objective_activity.php?source=${source}&objective_id=${objectiveId}&limit=${limit}`);

// ─────────────────────────────────────────────────────────────────
// Layer 1 — broader workspace surface (loose typing; PHP validates)
// ─────────────────────────────────────────────────────────────────

export const listClients   = ()                                 => call<any[]>("clients.php");
export const getClient     = (id: string)                       => call<any>(`clients.php?id=${id}`);
export const createClient  = (data: Record<string, unknown>)    => call<any>("clients.php", { method: "POST", body: JSON.stringify(data) });
export const updateClient  = (id: string, data: Record<string, unknown>) => call<any>(`clients.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const listProjects  = ()                                 => call<any[]>("projects.php");
export const getProject    = (id: string)                       => call<any>(`projects.php?id=${id}`);
export const createProject = (data: Record<string, unknown>)    => call<any>("projects.php", { method: "POST", body: JSON.stringify(data) });
export const updateProject = (id: string, data: Record<string, unknown>) => call<any>(`projects.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const getProjectModules  = (projectId: string)                              => call<any>(`modules.php?project_id=${projectId}`);
export const saveProjectModules = (projectId: string, data: Record<string, unknown>) => call<any>(`modules.php?project_id=${projectId}`, { method: "PUT", body: JSON.stringify(data) });

export const getCadrage  = (projectId: string)                              => call<any>(`cadrage.php?project_id=${projectId}`);
export const saveCadrage = (projectId: string, data: Record<string, unknown>) => call<any>(`cadrage.php?project_id=${projectId}`, { method: "PUT", body: JSON.stringify(data) });

export const listIntakes        = ()                          => call<any[]>("intake.php");
export const getIntakeByProject = (projectId: string)         => call<any[]>(`intake.php?project_id=${projectId}`);
export const updateIntake       = (id: string, data: Record<string, unknown>) => call<any>(`intake.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const listQuotes        = ()                          => call<any[]>("quotes.php");
export const listProjectQuotes = (projectId: string)         => call<any[]>(`quotes.php?projectId=${projectId}`);
export const getQuote          = (id: string)                => call<any>(`quotes.php?id=${id}`);
export const createQuote       = (data: Record<string, unknown>) => call<any>("quotes.php", { method: "POST", body: JSON.stringify(data) });
export const updateQuote       = (id: string, data: Record<string, unknown>) => call<any>(`quotes.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const listAdminDocs    = ()                          => call<any[]>("admin_docs.php");
export const updateAdminDoc   = (id: string, data: Record<string, unknown>) => call<any>(`admin_docs.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteAdminDoc   = (id: string)                => call<void>(`admin_docs.php?id=${id}`, { method: "DELETE" });
export const listAdminFolders = ()                          => call<any[]>("admin_doc_folders.php");
export const createAdminFolder= (data: Record<string, unknown>) => call<any>("admin_doc_folders.php", { method: "POST", body: JSON.stringify(data) });
export const updateAdminFolder= (id: string, data: Record<string, unknown>) => call<any>(`admin_doc_folders.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const listPersonalDocs   = ()                          => call<any[]>("personal_docs.php");
export const updatePersonalDoc  = (id: string, data: Record<string, unknown>) => call<any>(`personal_docs.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const listExpenses    = (year?: number)             => call<any[]>(`expenses.php${year ? `?year=${year}` : ""}`);
export const createExpense   = (data: Record<string, unknown>) => call<any>("expenses.php", { method: "POST", body: JSON.stringify(data) });
export const updateExpense   = (id: string, data: Record<string, unknown>) => call<any>(`expenses.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });

export const listPersonalCosts  = ()                          => call<any[]>("personal_costs.php");
export const createPersonalCost = (data: Record<string, unknown>) => call<any>("personal_costs.php", { method: "POST", body: JSON.stringify(data) });
export const updatePersonalCost = (id: string, data: Record<string, unknown>) => call<any>(`personal_costs.php?id=${id}`, { method: "PUT", body: JSON.stringify(data) });
