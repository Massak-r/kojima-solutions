/**
 * Offline queue — buffers API mutations when offline and replays them on reconnect.
 *
 * Hardening (Sprint 3):
 * - retryCount + MAX_RETRIES so a chronically failing action gives up.
 * - 4xx responses move straight to a dead-letter queue (won't fix on retry).
 * - FIFO replay by queuedAt, so DELETE-then-POST preserves causal order.
 */

const STORAGE_KEY = "kojima-offline-queue";
const DEAD_LETTER_KEY = "kojima-offline-deadletter";
const MAX_RETRIES = 5;

export interface QueuedAction {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  body?: unknown;
  queuedAt: number;
  retryCount?: number;
}

export interface DeadLetterAction extends QueuedAction {
  reason: string;
  failedAt: number;
}

/* ── Read / write queue ──────────────────────────────────────────────── */

function readQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAction[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new CustomEvent("offline-queue-change", { detail: queue.length }));
}

function readDeadLetter(): DeadLetterAction[] {
  try {
    return JSON.parse(localStorage.getItem(DEAD_LETTER_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeDeadLetter(items: DeadLetterAction[]) {
  localStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent("offline-deadletter-change", { detail: items.length }));
}

function moveToDeadLetter(action: QueuedAction, reason: string) {
  const dead = readDeadLetter();
  dead.push({ ...action, reason, failedAt: Date.now() });
  writeDeadLetter(dead);
}

/* ── Public API ──────────────────────────────────────────────────────── */

/** Add a mutation to the offline queue. */
export function queueAction(endpoint: string, method: "POST" | "PUT" | "DELETE", body?: unknown) {
  const queue = readQueue();
  queue.push({
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    endpoint,
    method,
    body,
    queuedAt: Date.now(),
    retryCount: 0,
  });
  writeQueue(queue);
}

/** Number of pending queued actions. */
export function getQueueSize(): number {
  return readQueue().length;
}

/** Number of dead-letter items (failed permanently). */
export function getDeadLetterSize(): number {
  return readDeadLetter().length;
}

/** Inspect the dead-letter queue (UI / debugging). */
export function listDeadLetter(): DeadLetterAction[] {
  return readDeadLetter();
}

/** Replay all queued actions in FIFO order. Removes successes; bumps retryCount
 *  on transient failures; routes 4xx and exceeded-retry items to the dead-letter
 *  queue so they don't loop forever. */
export async function flushQueue(): Promise<{ ok: number; failed: number; deadLettered: number }> {
  const queue = readQueue().slice().sort((a, b) => a.queuedAt - b.queuedAt);
  if (queue.length === 0) return { ok: 0, failed: 0, deadLettered: 0 };

  let ok = 0;
  let failed = 0;
  let deadLettered = 0;
  const remaining: QueuedAction[] = [];

  const csrf = (typeof document !== "undefined"
    && document.cookie.match(/(?:^|; )kojima_csrf=([^;]*)/)?.[1]) || "";
  const writeHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (csrf) writeHeaders["X-CSRF-Token"] = decodeURIComponent(csrf);

  for (const action of queue) {
    try {
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: writeHeaders,
        body: action.body ? JSON.stringify(action.body) : undefined,
        credentials: "include",
      });
      if (res.ok) {
        ok++;
        continue;
      }
      // 4xx → permanent failure (auth, validation, missing resource). Retrying won't help.
      if (res.status >= 400 && res.status < 500) {
        moveToDeadLetter(action, `HTTP ${res.status}`);
        deadLettered++;
        continue;
      }
      // 5xx / other → retry, but cap.
      const next: QueuedAction = { ...action, retryCount: (action.retryCount ?? 0) + 1 };
      if ((next.retryCount ?? 0) >= MAX_RETRIES) {
        moveToDeadLetter(action, `HTTP ${res.status} after ${next.retryCount} attempts`);
        deadLettered++;
      } else {
        remaining.push(next);
        failed++;
      }
    } catch (err) {
      // Network failure → retry, but cap.
      const next: QueuedAction = { ...action, retryCount: (action.retryCount ?? 0) + 1 };
      if ((next.retryCount ?? 0) >= MAX_RETRIES) {
        moveToDeadLetter(action, err instanceof Error ? err.message : "Network failure");
        deadLettered++;
      } else {
        remaining.push(next);
        failed++;
      }
    }
  }

  writeQueue(remaining);
  return { ok, failed, deadLettered };
}

/** Clear entire active queue (e.g. user explicitly discards). */
export function clearQueue() {
  writeQueue([]);
}

/** Clear the dead-letter queue (admin action — implies giving up on these). */
export function clearDeadLetter() {
  writeDeadLetter([]);
}

/** Move an item from dead-letter back to active (a manual "retry once more"). */
export function requeueFromDeadLetter(id: string) {
  const dead = readDeadLetter();
  const item = dead.find((d) => d.id === id);
  if (!item) return;
  writeDeadLetter(dead.filter((d) => d.id !== id));
  const queue = readQueue();
  queue.push({ id: item.id, endpoint: item.endpoint, method: item.method, body: item.body, queuedAt: Date.now(), retryCount: 0 });
  writeQueue(queue);
}

/* ── Auto-flush on reconnect ─────────────────────────────────────────── */

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue();
  });
}
