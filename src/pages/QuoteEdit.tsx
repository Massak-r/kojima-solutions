import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuotes } from "@/hooks/useQuotes";
import { QuoteForm } from "@/components/quotes/QuoteForm";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getFunnelByProject, createFunnel, type ProjectFunnel } from "@/api/funnels";
import { Loader2, Send, Copy, Plus } from "lucide-react";

// Admin callout: surface the shareable client-proposal link for this project,
// or offer to create the proposal (funnel) if none exists yet. Complements the
// auto-creation on intake conversion — for quotes created directly. The link is
// copied for the admin to send manually; nothing is emailed automatically.
function ProposalLinkCallout({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [funnel, setFunnel] = useState<ProjectFunnel | null | undefined>(undefined);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let live = true;
    getFunnelByProject(projectId)
      .then((f) => { if (live) setFunnel(f); })
      .catch(() => { if (live) setFunnel(null); });
    return () => { live = false; };
  }, [projectId]);

  const url = `${window.location.origin}/client/${projectId}/proposal`;

  function copyLink() {
    navigator.clipboard?.writeText(url).then(
      () => toast({ title: "Lien copié", description: "Proposition client — à envoyer manuellement au client." }),
      () => toast({ title: "Lien de la proposition", description: url }),
    );
  }

  async function create() {
    setCreating(true);
    try {
      const f = await createFunnel({ projectId, status: "proposal", tier: "professional" });
      setFunnel(f);
      toast({ title: "Proposition client créée", description: "Le lien est prêt à partager." });
    } catch {
      toast({ title: "Erreur", description: "Création de la proposition impossible.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  if (funnel === undefined) return null;

  return (
    <div className="no-print mb-6 rounded-xl border border-border bg-card p-4 flex items-center gap-3 flex-wrap">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Send size={16} className="text-primary" />
      </div>
      {funnel ? (
        <>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">Proposition client prête</p>
            <p className="font-body text-xs text-muted-foreground truncate">{url}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLink}>
            <Copy size={14} /> Copier le lien
          </Button>
        </>
      ) : (
        <>
          <div className="flex-1 min-w-0">
            <p className="font-display text-sm font-semibold text-foreground">Pas encore de proposition client</p>
            <p className="font-body text-xs text-muted-foreground">Crée une proposition partageable (choix du forfait + validation côté client).</p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={create} disabled={creating}>
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Créer la proposition
          </Button>
        </>
      )}
    </div>
  );
}

export default function QuoteEdit() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { getQuote, loading } = useQuotes();
  const quote = id ? getQuote(id) : undefined;

  if (!id) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-16 flex items-center justify-center">
        <p className="text-muted-foreground">{t("ID manquant", "Missing ID")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-16 flex items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-background pt-20 pb-16 flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">
          {t("Devis introuvable.", "Quote not found.")}
        </p>
        <Link to="/quotes" className="text-primary hover:underline">
          {t("Retour à la liste", "Back to list")}
        </Link>
      </div>
    );
  }

  const { id: _id, createdAt: _createdAt, ...initial } = quote;

  const backUrl = quote.projectId
    ? `/project/${quote.projectId}/documents`
    : "/quotes";
  const backLabel = quote.projectId
    ? t("Retour au projet", "Back to project")
    : t("Liste des devis", "Back to quotes");

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <p className="mb-6 no-print">
          <Link to={backUrl} className="text-sm text-muted-foreground hover:text-foreground">
            ← {backLabel}
          </Link>
        </p>
        {quote.projectId && quote.docType !== "invoice" && (
          <ProposalLinkCallout projectId={quote.projectId} />
        )}
        <QuoteForm initial={initial} quoteId={id} />
      </div>
    </div>
  );
}
