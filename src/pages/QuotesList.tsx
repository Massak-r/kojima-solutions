import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { useQuotes } from "@/hooks/useQuotes";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { totalQuote } from "@/types/quote";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function formatCurrency(value: number, lang: "fr" | "en"): string {
  return new Intl.NumberFormat(lang === "fr" ? "fr-CH" : "en-CH", {
    style: "currency",
    currency: "CHF",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function QuotesList() {
  const { t } = useLanguage();
  const { quotes, deleteQuote } = useQuotes();
  const isFr = (locale: string) => locale === "fr";

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-4xl mx-auto px-6 md:px-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="font-display text-3xl font-semibold text-gradient-silver">
            {t("Devis", "Quotes")}
          </h1>
          <Button asChild className="btn-primary-glow">
            <Link to="/quotes/new">
              <Plus className="w-4 h-4 mr-2" />
              {t("Nouveau devis", "New quote")}
            </Link>
          </Button>
        </div>

        {quotes.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-6">
              {t("Aucun devis enregistré.", "No quotes saved yet.")}
            </p>
            <Button asChild>
              <Link to="/quotes/new">
                <Plus className="w-4 h-4 mr-2" />
                {t("Créer un devis", "Create a quote")}
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {quotes.map((q) => (
              <li key={q.id}>
                <div className="glass-card-hover p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {q.quoteNumber} {q.projectTitle ? `· ${q.projectTitle}` : ""}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {q.clientName} · {formatCurrency(totalQuote(q), q.lang)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {format(new Date(q.createdAt), "dd MMM yyyy", {
                        locale: isFr(q.lang) ? fr : enUS,
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`/quotes/${q.id}`}>
                        {t("Ouvrir", "Open")}
                      </Link>
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("Supprimer le devis ?", "Delete this quote?")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t(
                              "Cette action est irréversible.",
                              "This action cannot be undone."
                            )}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("Annuler", "Cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => deleteQuote(q.id)}
                          >
                            {t("Supprimer", "Delete")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-8 text-center">
          <Link to="/" className="text-sm text-primary hover:underline">
            ← {t("Retour à l'accueil", "Back to home")}
          </Link>
        </p>
      </div>
    </div>
  );
}
