import { useLanguage } from "@/hooks/useLanguage";
import { QuoteForm } from "@/components/quotes/QuoteForm";
import { Link } from "react-router-dom";

export default function QuoteNew() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-background pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <p className="mb-6">
          <Link to="/quotes" className="text-sm text-muted-foreground hover:text-foreground">
            ← {t("Liste des devis", "Back to quotes")}
          </Link>
        </p>
        <QuoteForm />
      </div>
    </div>
  );
}
