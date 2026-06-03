import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { apiFetch } from "@/api/client";
import { useLanguage } from "@/hooks/useLanguage";
import SectionDivider from "@/components/SectionDivider";
import {
  type PortfolioProject,
  isPortfolioProject,
  getPreviewImage,
  getLiveLink,
  byMostRecent,
} from "@/lib/portfolioProjects";

function CardImage({ src, title }: { src: string | null; title: string }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
        <span className="font-display text-3xl font-bold text-primary/40">{title.charAt(0)}</span>
      </div>
    );
  }
  return (
    <div className="aspect-video bg-secondary overflow-hidden">
      <img
        src={src}
        alt={title}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        onError={() => setErrored(true)}
      />
    </div>
  );
}

/**
 * Landing-page proof: the 3 most recently delivered client projects, pulled
 * straight from projects.php (public, same source as /portfolio). Renders
 * nothing until there's at least one delivered project, so the homepage never
 * shows an empty "Réalisations" block.
 */
export default function RealisationsSection() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);

  useEffect(() => {
    apiFetch<PortfolioProject[]>("projects.php")
      .then((all) => setProjects(all.filter(isPortfolioProject).sort(byMostRecent).slice(0, 3)))
      .catch(() => {});
  }, []);

  if (projects.length === 0) return null;

  return (
    <>
      <SectionDivider />
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-body font-semibold uppercase tracking-[0.2em] text-primary mb-3">
              {t("Réalisations", "Portfolio")}
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground">
              {t("Des projets livrés, pas des promesses", "Delivered work, not promises")}
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => {
              const img = getPreviewImage(p);
              const link = getLiveLink(p);
              return (
                <article
                  key={p.id}
                  className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-card-hover transition-all duration-300"
                >
                  <CardImage src={img} title={p.title} />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <h3 className="font-display text-base font-semibold text-foreground leading-tight">{p.title}</h3>
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 p-1.5 rounded-md text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                          title={t("Voir le site", "Visit site")}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                    {p.client && <p className="text-xs font-body text-muted-foreground/60 mb-2">{p.client}</p>}
                    {p.description && <p className="text-xs font-body text-foreground/60 line-clamp-3">{p.description}</p>}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border text-sm font-body font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
            >
              {t("Voir toutes les réalisations", "See all projects")} <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
