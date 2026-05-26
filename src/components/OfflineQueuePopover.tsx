import { useEffect, useState } from "react";
import {
  CloudOff, RefreshCw, Trash2, RotateCcw, AlertTriangle, Check, Loader2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  flushQueue, getQueueSize, getDeadLetterSize, listDeadLetter,
  clearQueue, clearDeadLetter, requeueFromDeadLetter,
  type QueuedAction, type DeadLetterAction,
} from "@/lib/offlineQueue";
import { toast } from "sonner";

const STORAGE_KEY = "kojima-offline-queue";

function readQueue(): QueuedAction[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function shortEndpoint(ep: string): string {
  // Strip the host + /api/ prefix + query so the line stays readable.
  return ep
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/?api\//, "")
    .split("?")[0];
}

function ageLabel(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60)    return `${sec}s`;
  if (sec < 3600)  return `${Math.floor(sec / 60)}min`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}j`;
}

const METHOD_TONES: Record<string, string> = {
  POST:   "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-500/15",
  PUT:    "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-500/15",
  DELETE: "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-500/15",
};

interface OfflineQueuePopoverProps {
  /** Active-queue count surfaced as the badge. Re-renders when this changes. */
  queueSize: number;
}

export function OfflineQueuePopover({ queueSize }: OfflineQueuePopoverProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<QueuedAction[]>([]);
  const [dead, setDead]     = useState<DeadLetterAction[]>([]);
  const [flushing, setFlushing] = useState(false);
  const [confirmClear, setConfirmClear] = useState<null | "queue" | "dead">(null);

  // Refresh both lists whenever the popover opens or storage emits a change.
  useEffect(() => {
    const refresh = () => {
      setActive(readQueue());
      setDead(listDeadLetter());
    };
    refresh();
    window.addEventListener("offline-queue-change", refresh);
    window.addEventListener("offline-deadletter-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("offline-queue-change", refresh);
      window.removeEventListener("offline-deadletter-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  // Re-read on each open so timestamps stay fresh even if no event fired.
  useEffect(() => {
    if (open) {
      setActive(readQueue());
      setDead(listDeadLetter());
    }
  }, [open]);

  const totalDead   = getDeadLetterSize();
  const activeTotal = getQueueSize();
  const hasAnything = active.length > 0 || dead.length > 0;

  // Nothing pending and no historic failures → don't render the trigger at all.
  if (queueSize === 0 && totalDead === 0) return null;

  async function handleFlush() {
    setFlushing(true);
    try {
      const result = await flushQueue();
      if (result.ok > 0) {
        toast.success(`${result.ok} action${result.ok > 1 ? "s" : ""} synchronisée${result.ok > 1 ? "s" : ""}`);
      }
      if (result.deadLettered > 0) {
        toast.error(`${result.deadLettered} action${result.deadLettered > 1 ? "s" : ""} en échec définitif`);
      }
      if (result.ok === 0 && result.deadLettered === 0 && result.failed > 0) {
        toast.warning("Toujours hors-ligne — réessaye plus tard.");
      }
    } finally {
      setFlushing(false);
    }
  }

  function handleClearQueue() {
    clearQueue();
    setConfirmClear(null);
    toast.success("Queue vidée");
  }

  function handleClearDead() {
    clearDeadLetter();
    setConfirmClear(null);
    toast.success("Échecs purgés");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="ml-1 flex items-center gap-1 text-[10px] font-body text-amber-700 bg-amber-100/80 dark:text-amber-300 dark:bg-amber-500/15 rounded-full px-2 py-0.5 hover:bg-amber-200/80 dark:hover:bg-amber-500/25 transition-colors"
          aria-label={`${queueSize} action${queueSize > 1 ? "s" : ""} en attente · ${totalDead} échec${totalDead > 1 ? "s" : ""}`}
        >
          <CloudOff size={10} />
          {queueSize > 0 ? queueSize : ""}
          {totalDead > 0 && (
            <span className="inline-flex items-center gap-0.5 text-red-700 dark:text-red-300">
              <AlertTriangle size={9} /> {totalDead}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[340px] sm:w-[380px] p-0 overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-secondary/40">
          <div className="flex items-center gap-2">
            <CloudOff size={14} className="text-amber-700 dark:text-amber-300" />
            <h3 className="font-display text-xs font-bold uppercase tracking-wider">
              File de synchronisation
            </h3>
          </div>
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1.5"
            onClick={handleFlush}
            disabled={flushing || activeTotal === 0}
          >
            {flushing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
            Réessayer
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {/* Pending queue */}
          <section className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body font-semibold">
                En attente · {active.length}
              </p>
              {active.length > 0 && (
                confirmClear === "queue" ? (
                  <div className="flex items-center gap-1">
                    <button onClick={handleClearQueue} className="text-[10px] text-destructive hover:underline">Confirmer</button>
                    <span className="text-muted-foreground/40">·</span>
                    <button onClick={() => setConfirmClear(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Annuler</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear("queue")}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 size={10} /> Vider
                  </button>
                )
              )}
            </div>
            {active.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic">
                <Check size={11} className="inline mr-1 text-emerald-600" /> Tout est synchronisé.
              </p>
            ) : (
              <ul className="space-y-1">
                {active.map((q) => (
                  <li
                    key={q.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card/60 border border-border/60"
                  >
                    <span className={`text-[9px] font-mono font-bold rounded px-1.5 py-0.5 ${METHOD_TONES[q.method] ?? ""}`}>
                      {q.method}
                    </span>
                    <span className="text-[11px] font-mono text-foreground/80 truncate flex-1" title={q.endpoint}>
                      {shortEndpoint(q.endpoint)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/70 shrink-0">{ageLabel(q.queuedAt)}</span>
                    {(q.retryCount ?? 0) > 0 && (
                      <span className="text-[9px] text-amber-600 dark:text-amber-400 shrink-0" title={`${q.retryCount} tentative(s)`}>
                        ×{q.retryCount}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Dead-letter */}
          {dead.length > 0 && (
            <section className="border-t border-border/60 p-3 space-y-2 bg-destructive/[0.02]">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-wider text-destructive font-body font-semibold inline-flex items-center gap-1">
                  <AlertTriangle size={10} /> Échecs · {dead.length}
                </p>
                {confirmClear === "dead" ? (
                  <div className="flex items-center gap-1">
                    <button onClick={handleClearDead} className="text-[10px] text-destructive hover:underline">Confirmer</button>
                    <span className="text-muted-foreground/40">·</span>
                    <button onClick={() => setConfirmClear(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Annuler</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClear("dead")}
                    className="text-[10px] text-muted-foreground hover:text-destructive transition-colors inline-flex items-center gap-1"
                  >
                    <Trash2 size={10} /> Purger
                  </button>
                )}
              </div>
              <ul className="space-y-1">
                {dead.map((d) => (
                  <li
                    key={d.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-card/60 border border-destructive/20"
                  >
                    <span className={`text-[9px] font-mono font-bold rounded px-1.5 py-0.5 ${METHOD_TONES[d.method] ?? ""}`}>
                      {d.method}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-mono text-foreground/80 truncate" title={d.endpoint}>
                        {shortEndpoint(d.endpoint)}
                      </p>
                      <p className="text-[10px] text-destructive/80 truncate" title={d.reason}>
                        {d.reason}
                      </p>
                    </div>
                    <button
                      onClick={() => { requeueFromDeadLetter(d.id); }}
                      className="text-[10px] text-primary hover:underline shrink-0 inline-flex items-center gap-1"
                      title="Remettre en file"
                    >
                      <RotateCcw size={11} /> Réessayer
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {!hasAnything && (
          <p className="px-4 py-3 text-xs text-muted-foreground/70 border-t border-border/60">
            Plus rien à synchroniser. Tu peux fermer.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
