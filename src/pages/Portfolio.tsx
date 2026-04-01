import { useState, useEffect } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { apiFetch } from "@/api/client";
import Footer from "@/components/Footer";
import { ExternalLink, Calendar, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface PortfolioProject {
  id: string;
  title: string;
  client: string;
  description: string;
  status: string;
  startDate: string;
  endDate: string;
  deliveries?: Array<{
    id: string;
    title: string;
    type: string;
    content: string;
    images?: string[];
  }>;
}

export default function Portfolio() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PortfolioProject[]>("projects.php")
      .then((all) => {
        const completed = all.filter((p) => p.status === "completed");
        setProjects(completed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Extract a preview image from project deliveries
  function getPreviewImage(p: PortfolioProject): string | null {
    if (!p.deliveries) return null;
    for (const d of p.deliveries) {
      if (d.type === "image") {
        if (d.images?.length) return d.images[0];
        if (d.content) return d.content;
      }
    }
    // Fallback: any delivery with a link
    return null;
  }

  // Extract a live link from project deliveries
  function getLiveLink(p: PortfolioProject): string | null {
    if (!p.deliveries) return null;
    const linkDelivery = p.deliveries.find((d) => d.type === "link");
    return linkDelivery?.content || null;
  }

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("fr-CH", { month: "short", year: "numeric" });
    } catch {
      return dateStr;
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <section className="relative py-20 px-6 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs font-body font-semibold uppercase tracking-[0.2em] text-primary mb-4">
            {t("Réalisations", "Portfolio")}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            {t("Nos projets livrés", "Our delivered projects")}
          </h1>
          <p className="font-body text-muted-foreground max-w-xl mx-auto">
            {t(
              "Découvrez les projets que nous avons conçus et livrés pour nos clients.",
              "Explore the projects we've designed and delivered for our clients."
            )}
          </p>
        </div>
      </section>

      {/* Projects grid */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        {loading ? (
          <div className="text-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={40} className="text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground/50 font-body">
              {t("Aucun projet à afficher pour le moment.", "No projects to display yet.")}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const img = getPreviewImage(p);
              const link = getLiveLink(p);
              return (
                <article
                  key={p.id}
                  className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-card-hover transition-all duration-300"
                >
                  {/* Image */}
                  {img ? (
                    <div className="aspect-video bg-secondary overflow-hidden">
                      <img
                        src={img}
                        alt={p.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                      <span className="font-display text-2xl font-bold text-primary/20">
                        {p.title.charAt(0)}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-display text-base font-semibold text-foreground leading-tight">
                        {p.title}
                      </h3>
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                          title={t("Voir le site", "Visit site")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>

                    {p.client && (
                      <p className="text-xs font-body text-muted-foreground/60 mb-2">
                        {p.client}
                      </p>
                    )}

                    {p.description && (
                      <p className="text-xs font-body text-foreground/60 line-clamp-3 mb-3">
                        {p.description}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground/50">
                      <Calendar size={10} />
                      {formatDate(p.startDate)}
                      {p.endDate && ` — ${formatDate(p.endDate)}`}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
