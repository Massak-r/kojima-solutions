import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Loader2, Inbox, Sparkles, Mic, Square, Scissors, MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { addInboxCapture, type CaptureKind } from "@/api/inboxCaptures";
import { CAPTURE_KINDS } from "@/lib/captureKinds";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "react-router-dom";
import { useProjects } from "@/contexts/ProjectsContext";
import { projectJournalSlug } from "@/api/projectJournal";
import { useIsAdminPage } from "@/components/BottomNav";

interface QuickCaptureFabProps {
  /** Optional pre-filled project tag (slug or title) shown to the user as a chip. */
  projectHint?: string;
}

const PENDING_COUNT_KEY = ["inbox-captures", "admin", "pending"] as const;

// ── Web Speech API (browser-native dictation — no API key, no Anthropic) ──────
interface SpeechResultAlt { transcript: string }
interface SpeechResult { isFinal: boolean; 0: SpeechResultAlt; length: number }
interface SpeechEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechRecognitionLike {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SRConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognition(): SRConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Friendly label of the app section a capture was made from — stamped as
 *  `context` so triage knows the origin. Returns undefined where a more
 *  specific signal already exists (project routes carry projectHint) or where
 *  it adds nothing (the home surface itself). */
function routeContextLabel(pathname: string): string | undefined {
  if (pathname.startsWith("/project/")) return undefined; // projectHint covers it
  const MAP: Array<[RegExp, string]> = [
    [/^\/cockpit/,     "Pilotage"],
    [/^\/relances/,    "Relances"],
    [/^\/pipeline/,    "Leads"],
    [/^\/sprint/,      "Sprint"],
    [/^\/quotes/,      "Devis"],
    [/^\/accounting/,  "Finance"],
    [/^\/tresorerie/,  "Trésorerie"],
    [/^\/documents/,   "Documents"],
    [/^\/clients/,     "Clients"],
    [/^\/settings/,    "Réglages"],
    [/^\/objective\//, "Objectif"],
  ];
  for (const [re, label] of MAP) if (re.test(pathname)) return label;
  return undefined; // /home and unknowns → no context tag
}

/** Floating capture button on /home and project pages. Tap → small panel with
 *  textarea + send. Now supports voice dictation, an optional 1-tap type, and
 *  splitting a multi-line brain-dump into one capture per line. The DB is the
 *  source of truth. */
export function QuickCaptureFab({ projectHint }: QuickCaptureFabProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<CaptureKind | null>(null);
  const [splitChoice, setSplitChoice] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [listening, setListening] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const baseTextRef = useRef("");
  const finalRef = useRef("");
  const [srSupported] = useState(() => !!getSpeechRecognition());
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAdminPage = useIsAdminPage();
  const location = useLocation();
  const { projects } = useProjects();

  // Route-derived project context: on any /project/:id/* page, auto-tag the
  // capture with that project's journal slug so triage can route it back —
  // reproduces the hint ProjectBrief used to pass explicitly, now that this
  // FAB is mounted globally. An explicit `projectHint` prop still wins.
  const routeHint = useMemo(() => {
    const m = location.pathname.match(/^\/project\/([^/]+)/);
    if (!m) return undefined;
    const proj = projects.find((p) => p.id === m[1]);
    return proj ? projectJournalSlug(proj.title) : undefined;
  }, [location.pathname, projects]);
  const effectiveHint = projectHint ?? routeHint;
  const routeContext = useMemo(() => routeContextLabel(location.pathname), [location.pathname]);

  const lines = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const isMulti = lines.length >= 2;
  // Auto-default: split a multi-line dump unless it's tagged as a single Note.
  const split = isMulti && (splitChoice ?? kind !== "note");

  function stopDictation() {
    recRef.current?.stop();
    recRef.current = null;
    setListening(false);
  }

  function startDictation() {
    const SR = getSpeechRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = "fr-FR";
    rec.interimResults = true;
    rec.continuous = true;
    baseTextRef.current = text ? text.replace(/\s+$/, "") + " " : "";
    finalRef.current = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0]?.transcript ?? "";
        if (res.isFinal) finalRef.current += t + " ";
        else interim += t;
      }
      setText(baseTextRef.current + finalRef.current + interim);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast({ title: "Micro indisponible", description: "Autorise l'accès au micro pour dicter.", variant: "destructive" });
      }
      setListening(false);
      recRef.current = null;
    };
    rec.onend = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
    // Closing the panel stops any running dictation.
    stopDictation();
  }, [open]);

  // Stop dictation if the component unmounts mid-listen.
  useEffect(() => () => recRef.current?.abort(), []);

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

  function resetAndClose() {
    setText("");
    setKind(null);
    setSplitChoice(null);
    stopDictation();
    setOpen(false);
  }

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed || submitting) return;
    const items = split ? lines : [trimmed];
    setSubmitting(true);
    try {
      for (const item of items) {
        await addInboxCapture(item, {
          projectHint: effectiveHint,
          kind: kind ?? undefined,
          context: routeContext,
        });
      }
      resetAndClose();
      qc.invalidateQueries({ queryKey: PENDING_COUNT_KEY });
      qc.invalidateQueries({ queryKey: ["inbox-pending-count"] });
      toast({
        title: items.length > 1 ? `${items.length} captures` : "Capturé",
        description: "Atterrira dans /triage.",
      });
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

  // Global mount (App.tsx) — render only on admin pages, mirroring
  // BottomNav / QuickActionFAB; hidden on public, client and print routes.
  if (!isAdminPage) return null;

  return (
    <>
      {/* FAB — stacked above QuickActionFAB. */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "app-fab fixed right-4 z-40 bottom-44 md:bottom-28 md:right-6 no-print",
          "h-12 w-12 rounded-full bg-violet-600 text-white shadow-lg",
          "hover:bg-violet-700 hover:scale-105 active:scale-95 transition-all",
          "flex items-center justify-center group",
        )}
        aria-label="Quick capture"
        title="Capture rapide (idée, todo, note, voix)"
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
                "left-4 right-4 bottom-44 md:bottom-28 md:left-auto md:right-6 md:w-[420px]",
                "rounded-2xl bg-card border border-border shadow-2xl overflow-hidden",
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/40 bg-gradient-to-br from-violet-50/40 to-card/40 dark:from-violet-500/10">
                <div className="flex items-center gap-2">
                  <Inbox size={13} className="text-violet-600 dark:text-violet-400" />
                  <span className="text-[10px] font-display font-bold uppercase tracking-widest text-foreground/70">
                    Capture rapide
                  </span>
                  {effectiveHint && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      {effectiveHint}
                    </span>
                  )}
                  {!effectiveHint && routeContext && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                      <MapPin size={9} />
                      {routeContext}
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
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Une idée, une tâche, une liste… (une ligne = une capture)"
                    rows={7}
                    className="w-full text-sm font-body bg-transparent border border-border/50 rounded-lg p-2.5 pr-10 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 resize-y min-h-[120px] max-h-[60vh] leading-relaxed placeholder:text-muted-foreground/40"
                  />
                  {srSupported && (
                    <button
                      onClick={listening ? stopDictation : startDictation}
                      className={cn(
                        "absolute top-2 right-2 inline-flex items-center justify-center h-7 w-7 rounded-full transition-colors",
                        listening
                          ? "bg-red-600 text-white animate-pulse"
                          : "bg-secondary text-muted-foreground hover:text-violet-600 hover:bg-violet-100 dark:hover:bg-violet-500/20",
                      )}
                      aria-label={listening ? "Arrêter la dictée" : "Dicter à la voix"}
                      title={listening ? "Arrêter la dictée" : "Dicter à la voix"}
                    >
                      {listening ? <Square size={12} /> : <Mic size={13} />}
                    </button>
                  )}
                </div>

                {/* Type chips — optional, 1 tap, pre-seeds triage */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {CAPTURE_KINDS.map((k) => {
                    const active = kind === k.kind;
                    return (
                      <button
                        key={k.kind}
                        onClick={() => setKind((cur) => (cur === k.kind ? null : k.kind))}
                        className={cn(
                          "inline-flex items-center gap-1 text-[11px] font-body font-medium rounded-full px-2 py-1 border transition-colors",
                          active
                            ? cn(k.badge, "border-transparent ring-1 ring-inset ring-current/20")
                            : "text-muted-foreground border-border/60 hover:bg-secondary",
                        )}
                        aria-pressed={active}
                      >
                        <span aria-hidden>{k.emoji}</span>
                        {k.label}
                      </button>
                    );
                  })}
                </div>

                {/* Split toggle — only when there are ≥2 non-empty lines */}
                {isMulti && (
                  <button
                    type="button"
                    onClick={() => setSplitChoice(!split)}
                    className="w-full flex items-center justify-between gap-2 text-[11px] font-body px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-secondary/50 transition-colors"
                  >
                    <span className="flex items-center gap-1.5 text-foreground/80">
                      <Scissors size={11} className="text-violet-500" />
                      Découper en {lines.length} captures
                    </span>
                    <span className={cn(
                      "relative inline-flex h-4 w-7 rounded-full transition-colors shrink-0",
                      split ? "bg-violet-600" : "bg-muted",
                    )}>
                      <span className={cn(
                        "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all",
                        split ? "left-3.5" : "left-0.5",
                      )} />
                    </span>
                  </button>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-muted-foreground/40 tabular-nums">
                    {listening
                      ? "🎙 écoute…"
                      : text.trim().length > 0 && `${text.trim().length} car · ⌘↵ pour envoyer`}
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
                    {split ? `Capturer ${lines.length}` : "Capturer"}
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
