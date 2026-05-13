import { useEffect, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, RefreshCw, Loader2, FileText } from "lucide-react";
import { getProjectJournal, projectJournalSlug, type ProjectJournal } from "@/api/projectJournal";
import { cn } from "@/lib/utils";

interface JournalWidgetProps {
  projectTitle: string;
}

/** Read-only renderer for a project's local-first markdown journal.
 *  Source of truth = `.kojima-journal/projects/<slug>.md` on disk, synced to
 *  the server by deploy.sh. Edit via Claude Code (`/capture --project <slug>`)
 *  or any local editor — this widget is intentionally not editable in-app to
 *  avoid conflict with the external editor workflow. */
export function JournalWidget({ projectTitle }: JournalWidgetProps) {
  const slug = projectJournalSlug(projectTitle);
  const [journal, setJournal] = useState<ProjectJournal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetchJournal = useCallback(() => {
    setLoading(true);
    setError(null);
    getProjectJournal(slug)
      .then(setJournal)
      .catch((e: Error) => setError(e.message || "Erreur de lecture du journal"))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(fetchJournal, [fetchJournal]);

  return (
    <section className="rounded-2xl border border-border/40 bg-card/30 p-5 sm:p-6">
      <header className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-violet-500" />
          <h2 className="text-xs font-display font-bold text-foreground/70 uppercase tracking-wider">
            Journal
          </h2>
          <span className="text-[10px] font-mono text-muted-foreground/60">
            {slug}.md
          </span>
        </div>
        <button
          onClick={fetchJournal}
          disabled={loading}
          className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
          title="Recharger depuis le serveur"
          aria-label="Recharger"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        </button>
      </header>

      {error ? (
        <div className="text-xs font-body text-red-600/80 italic">
          {error}
        </div>
      ) : loading && !journal ? (
        <div className="space-y-2">
          <div className="h-3 bg-muted/40 rounded animate-pulse" />
          <div className="h-3 bg-muted/40 rounded animate-pulse w-3/4" />
          <div className="h-3 bg-muted/40 rounded animate-pulse w-1/2" />
        </div>
      ) : journal?.exists && journal.content.trim() ? (
        <>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground/85 font-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{journal.content}</ReactMarkdown>
          </div>
          {journal.mtime && (
            <div className="text-[10px] font-mono text-muted-foreground/40 tabular-nums mt-3 pt-3 border-t border-border/30">
              Dernière sync : {new Date(journal.mtime).toLocaleString("fr-CH", { dateStyle: "short", timeStyle: "short" })}
            </div>
          )}
        </>
      ) : (
        <div className="text-xs font-body text-muted-foreground/70 italic flex items-start gap-2">
          <FileText size={13} className="mt-0.5 shrink-0 text-muted-foreground/40" />
          <span>
            Pas encore de journal pour ce projet. Crée <code className={cn("font-mono not-italic text-[10px] px-1.5 py-0.5 rounded bg-muted/40")}>.kojima-journal/projects/{slug}.md</code> ou utilise <code className={cn("font-mono not-italic text-[10px] px-1.5 py-0.5 rounded bg-muted/40")}>/capture --project {slug}</code> depuis Claude Code.
          </span>
        </div>
      )}
    </section>
  );
}
