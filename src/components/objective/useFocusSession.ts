import { useCallback, useEffect, useRef, useState } from "react";
import { startSession, stopSession, listSessions } from "@/api/objectiveSessions";
import type { ObjectiveSource } from "@/api/objectiveSource";
import type { ObjectiveSession } from "@/api/objectiveSessions";

interface StoredSession {
  sessionId: string;
  startedAt: string;   // ISO string
  subtaskId?: string | null;
}

function storageKey(source: ObjectiveSource, objectiveId: string) {
  return `focus_session_${source}_${objectiveId}`;
}

function readStored(key: string): StoredSession | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

function writeStored(key: string, v: StoredSession | null) {
  try {
    if (v) localStorage.setItem(key, JSON.stringify(v));
    else localStorage.removeItem(key);
  } catch {}
  try { window.dispatchEvent(new CustomEvent("focus-session-change")); } catch {}
}

interface UseFocusSessionOpts {
  source: ObjectiveSource;
  objectiveId: string;
  apiBase?: string;   // for sendBeacon URL
  apiKey?: string;
}

export interface FocusSessionState {
  active: boolean;
  startedAt: string | null;
  elapsedSec: number;
  subtaskId: string | null;
  start: (subtaskId?: string | null) => Promise<void>;
  stop: (note?: string) => Promise<void>;
}

export function useFocusSession({ source, objectiveId }: UseFocusSessionOpts): FocusSessionState {
  const key = storageKey(source, objectiveId);
  const [stored, setStored] = useState<StoredSession | null>(() => readStored(key));
  const [now, setNow] = useState(Date.now());
  const tickRef = useRef<number | null>(null);

  // Reconcile with server on mount: if stored is stale or missing an active session,
  // check server state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sessions = await listSessions(source, objectiveId);
        const open = sessions.find(s => !s.endedAt);
        if (cancelled) return;
        if (open) {
          // Server has an open session: adopt it
          const adopted: StoredSession = {
            sessionId: open.id,
            startedAt: open.startedAt,
            subtaskId: open.subtaskId ?? null,
          };
          // If older than 8 hours, auto-close it
          const ageSec = (Date.now() - new Date(open.startedAt).getTime()) / 1000;
          if (ageSec > 8 * 3600) {
            try { await stopSession(open.id, "auto-closed (stale)"); } catch {}
            writeStored(key, null);
            setStored(null);
          } else {
            writeStored(key, adopted);
            setStored(adopted);
          }
        } else if (readStored(key)) {
          // Local says running, server says not → clear local
          writeStored(key, null);
          setStored(null);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [source, objectiveId, key]);

  // Tick every second while active
  useEffect(() => {
    if (!stored) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    tickRef.current = window.setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [stored]);

  // sendBeacon on tab close for clean session stop
  useEffect(() => {
    function onBeforeUnload() {
      const s = readStored(key);
      if (!s) return;
      const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");
      const apiKey  = import.meta.env.VITE_API_KEY ?? "";
      const url = `${apiBase}/api/objective_sessions.php?id=${s.sessionId}&action=stop`;
      try {
        const fd = new FormData();
        if (apiKey) fd.append("api_key", apiKey);
        navigator.sendBeacon(url, fd);
      } catch {}
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [key]);

  const start = useCallback(async (subtaskId?: string | null) => {
    try {
      const s: ObjectiveSession = await startSession({ source, objectiveId, subtaskId: subtaskId ?? null });
      const next: StoredSession = { sessionId: s.id, startedAt: s.startedAt, subtaskId: s.subtaskId ?? null };
      writeStored(key, next);
      setStored(next);
      setNow(Date.now());
    } catch (e) {
      console.error("Failed to start session", e);
    }
  }, [source, objectiveId, key]);

  const stop = useCallback(async (note?: string) => {
    const s = readStored(key);
    writeStored(key, null);
    setStored(null);
    if (!s) return;
    try { await stopSession(s.sessionId, note); } catch {}
    // Notify any retro-prompt listeners that a session just ended
    try {
      window.dispatchEvent(new CustomEvent("focus-session-stopped", {
        detail: { sessionId: s.sessionId, source, objectiveId, subtaskId: s.subtaskId ?? null },
      }));
    } catch {}
  }, [key, source, objectiveId]);

  const startedAtMs = stored ? new Date(stored.startedAt).getTime() : 0;
  const elapsedSec = stored ? Math.max(0, Math.floor((now - startedAtMs) / 1000)) : 0;

  return {
    active:    !!stored,
    startedAt: stored?.startedAt ?? null,
    elapsedSec,
    subtaskId: stored?.subtaskId ?? null,
    start,
    stop,
  };
}

export function formatElapsed(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}
