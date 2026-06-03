// Shared shape + helpers for the public "Réalisations" surfaces (the full
// Portfolio page and the landing showcase). Both read completed client
// projects straight from projects.php — the portfolio is auto-derived, not a
// separately curated list.

export interface PortfolioProject {
  id: string;
  title: string;
  client: string;
  description: string;
  status: string;
  kind?: "client" | "internal" | "personal";
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

/** A project shown publicly: a delivered (completed) client project. */
export function isPortfolioProject(p: PortfolioProject): boolean {
  return p.status === "completed" && (p.kind ?? "client") === "client";
}

/** Year a project belongs to — its delivery (end) year, start year as fallback. */
export function projectYear(p: PortfolioProject): number | null {
  const src = p.endDate || p.startDate;
  if (!src) return null;
  const d = new Date(src);
  return Number.isNaN(d.getTime()) ? null : d.getFullYear();
}

/** First image found in deliveries, for the card preview. */
export function getPreviewImage(p: PortfolioProject): string | null {
  for (const d of p.deliveries ?? []) {
    if (d.type === "image") {
      if (d.images?.length) return d.images[0];
      if (d.content) return d.content;
    }
  }
  return null;
}

/** First live link found in deliveries. */
export function getLiveLink(p: PortfolioProject): string | null {
  return (p.deliveries ?? []).find((d) => d.type === "link")?.content || null;
}

/** Most-recent-first by delivery date, for "latest work" showcases. */
export function byMostRecent(a: PortfolioProject, b: PortfolioProject): number {
  return (b.endDate || b.startDate || "").localeCompare(a.endDate || a.startDate || "");
}
