import { useParams, Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuotes } from "@/hooks/useQuotes";
import { QuoteForm } from "@/components/quotes/QuoteForm";
import { Loader2 } from "lucide-react";

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
        <QuoteForm initial={initial} quoteId={id} />
      </div>
    </div>
  );
}
