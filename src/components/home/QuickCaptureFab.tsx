import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X, Send, Loader2, Inbox, Sparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { addInboxCapture } from "@/api/inboxCaptures";
import { useToast } from "@/hooks/use-toast";

interface QuickCaptureFabProps {
  /** Optional pre-filled project tag (slug or title) shown to the user as a chip. */
  projectHint?: string;
}

const PENDING_COUNT_KEY = ["inbox-captures", "admin", "pending"] as const;

/** Floating capture button on /home and project pages. Tap → small panel with
 *  textarea + send. Optimistic close, toast confirms. The DB is the source of
 *  truth; the local .kojima-journal/inbox.md is no longer touched from the
 *  web flow. */
export function QuickCaptureFab({ projectHint }: QuickCaptureFabProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const qc = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      // small delay for the motion mount before focus
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Close on Escape, submit on Cmd/Ctrl + Enter
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      } else if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        void handleSubmit();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      await addInboxCapture(trimmed, projectHint ? { projectHint } : undefined);
      setText("");
      setOpen(false);
      // Invalidate any pending-count query so the popup updates immediately
      qc.invalidateQueries({ queryKey: PENDING_COUNT_KEY });
      qc.invalidateQueries({ queryKey: ["inbox-pending-count"] });
      toast({ title: "Capturé", description: "Atterrira dans /triage." });
    } catch (e) {
      toast({
        title: "Échec de la capture",
        description: e instanceof Error ? e.message : "Réessaye ?",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* FAB — bottom-right, stacked above QuickActionFAB (which sits at
        *  bottom-24 sm:bottom-8). Stays clear of the mobile BottomNav (h-16). */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "fixed right-4 z-40 bottom-40 md:bottom-24 md:right-6 no-print",
          "h-12 w-12 rounded-full bg-violet-600 text-white shadow-lg",
          "hover:bg-violet-700 hover:scale-105 active:scale-95 transition-all",
          "flex items-center justify-center group",
        )}
        aria-label="Quick capture"
        title="Capture rapide (idée, todo, note)"
      >
        <Inbox size={18} className="group-hover:scale-110 transition-transform" />
        <Sparkles size={9} className="absolute top-2 right-2 text-violet-200" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/30 z-50"
              onClick={() => setOpen(false)}
            />

            {/* Panel — bottom-sheet on mobile, popover on desktop */}
            <motion.div
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={cn(
                "fixed z-50",
                "left-4 right-4 bottom-40 md:bottom-40 md:left-auto md:right-6 md:w-[420px]",
                "rounded-2xl bg-card border border-border shadow-2xl overflow-hidden",
              )}
              onClick={e => e.stopPropagation()}
            >
              <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/40 bg-gradient-to-br from-violet-50/40 to-card/40 dark:from-violet-500/10">
                <div className="flex items-center gap-2">
                  <Inbox size={13} className="text-violet-600 dark:text-violet-400" />
                  <span className="text-[10px] font-display font-bold uppercase tracking-widest text-foreground/70">
                    Capture rapide
                  </span>
                  {projectHint && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      {projectHint}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-muted-foreground/50 hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
                  aria-label="Fermer"
                >
                  <X size={14} />
                </button>
              </header>

              <div className="p-4 space-y-3">
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Une idée, une tâche, une décision à clarifier…"
                  rows={4}
                  className="w-full text-sm font-body bg-transparent border border-border/50 rounded-lg p-2.5 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 resize-none placeholder:text-muted-foreground/40"
                />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">
                    {text.trim().length > 0 && `${text.trim().length} car · ⌘↵ pour envoyer`}
                  </span>
                  <button
                    onClick={handleSubmit}
                    disabled={!text.trim() || submitting}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-body font-semibold px-3 py-1.5 rounded-full transition-all",
                      text.trim() && !submitting
                        ? "bg-violet-600 text-white hover:bg-violet-700 active:scale-95"
                        : "bg-muted text-muted-foreground/50 cursor-not-allowed",
                    )}
                  >
                    {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                    Capturer
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
