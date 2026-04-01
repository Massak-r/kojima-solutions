/**
 * Offline queue — queues API mutations when offline and replays them on reconnect.
 */

const STORAGE_KEY = "kojima-offline-queue";

export interface QueuedAction {
  id: string;
  endpoint: string;
  method: "POST" | "PUT" | "DELETE";
  body?: unknown;
  queuedAt: number;
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
  });
  writeQueue(queue);
}

/** Number of pending queued actions. */
export function getQueueSize(): number {
  return readQueue().length;
}

/** Replay all queued actions sequentially, removing each on success. */
export async function flushQueue(): Promise<{ ok: number; failed: number }> {
  const queue = readQueue();
  if (queue.length === 0) return { ok: 0, failed: 0 };

  let ok = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    try {
      const res = await fetch(action.endpoint, {
        method: action.method,
        headers: { "Content-Type": "application/json" },
        body: action.body ? JSON.stringify(action.body) : undefined,
      });
      if (res.ok) {
        ok++;
      } else {
        // Keep failed actions for retry
        remaining.push(action);
        failed++;
      }
    } catch {
      remaining.push(action);
      failed++;
    }
  }

  writeQueue(remaining);
  return { ok, failed };
}

/** Clear entire queue (e.g. user explicitly discards). */
export function clearQueue() {
  writeQueue([]);
}

/* ── Auto-flush on reconnect ─────────────────────────────────────────── */

if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    flushQueue();
  });
}
