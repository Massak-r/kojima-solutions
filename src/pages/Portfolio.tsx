import { useState, useEffect, useMemo } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { apiFetch } from "@/api/client";
import Footer from "@/components/Footer";
import { ExternalLink, Calendar, CheckCircle2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  type PortfolioProject,
  isPortfolioProject,
  projectYear,
  getPreviewImage,
  getLiveLink,
} from "@/lib/portfolioProjects";

export default function Portfolio() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<PortfolioProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<number | "all">("all");

  useEffect(() => {
    apiFetch<PortfolioProject[]>("projects.php")
      .then((all) => setProjects(all.filter(isPortfolioProject)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Years present in the portfolio, newest first — drives the filter chips.
  const years = useMemo(() => {
    const set = new Set<number>();
    projects.forEach((p) => { const y = projectYear(p); if (y) set.add(y); });
    return [...set].sort((a, b) => b - a);
  }, [projects]);

  // Apply the year chip + free-text search (title / client / description).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (year !== "all" && projectYear(p) !== year) return false;
      if (!q) return true;
      return (
        (p.title || "").toLowerCase().includes(q) ||
        (p.client || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q)
      );
    });
  }, [projects, query, year]);

  function formatDate(dateStr: string): string {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return dateStr;
      return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } catch {
      return dateStr;
    }
  }

  const hasFilter = query.trim() !== "" || year !== "all";

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
          <>
            {/* Filter bar — search + year chips */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
              <div className="relative flex-1 sm:max-w-xs">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
                <input
                  type="search"
                  inputMode="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("Rechercher un projet, un client…", "Search a project, a client…")}
                  aria-label={t("Rechercher", "Search")}
                  className="w-full h-10 pl-9 pr-3 rounded-xl border border-border bg-card text-sm font-body outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/15 transition-colors"
                />
              </div>
              {years.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap sm:ml-auto">
                  <YearChip active={year === "all"} onClick={() => setYear("all")}>
                    {t("Tous", "All")}
                  </YearChip>
                  {years.map((y) => (
                    <YearChip key={y} active={year === y} onClick={() => setYear(y)}>
                      {y}
                    </YearChip>
                  ))}
                </div>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-muted-foreground/60 font-body">
                  {t("Aucun projet ne correspond à votre recherche.", "No projects match your search.")}
                </p>
                {hasFilter && (
                  <button
                    onClick={() => { setQuery(""); setYear("all"); }}
                    className="mt-3 text-xs font-body text-primary hover:underline"
                  >
                    {t("Réinitialiser les filtres", "Reset filters")}
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => {
                  const img = getPreviewImage(p);
                  const link = getLiveLink(p);
                  return (
                    <article
                      key={p.id}
                      className="group bg-card border border-border rounded-2xl overflow-hidden hover:shadow-card-hover transition-all duration-300"
                    >
                      <PortfolioImage src={img} title={p.title} />

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

                        <div className="flex items-center gap-1.5 text-[10px] font-body text-muted-foreground/50 whitespace-nowrap">
                          <Calendar size={10} />
                          {formatDate(p.startDate)}
                          {p.endDate && ` – ${formatDate(p.endDate)}`}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>

      <Footer />
    </div>
  );
}

function YearChip({
  active, onClick, children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-body font-medium tabular-nums transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/40",
      )}
    >
      {children}
    </button>
  );
}

function PortfolioImage({ src, title }: { src: string | null; title: string }) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div className="aspect-video bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
        <span className="font-display text-3xl font-bold text-primary/40">
          {title.charAt(0)}
        </span>
      </div>
    );
  }
  return (
    <div className="aspect-video bg-secondary overflow-hidden">
      <img
        src={src}
        alt={title}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
        onError={() => setErrored(true)}
      />
    </div>
  );
}
