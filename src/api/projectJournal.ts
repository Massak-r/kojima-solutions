import { apiFetch } from "./client";

export interface ProjectJournal {
  slug: string;
  exists: boolean;
  content: string;
  mtime: string | null;
}

/** Fetch the local-first markdown journal for a project. Returns exists=false
 *  when the .md hasn't been created/synced yet — caller should render an
 *  empty-state hint. */
export function getProjectJournal(slug: string): Promise<ProjectJournal> {
  return apiFetch<ProjectJournal>(`project_journal.php?slug=${encodeURIComponent(slug)}`);
}

/** Derive the journal slug from a project title — matches the convention used
 *  by the `/capture --project` and `/sync-project` skills. Kept in sync with
 *  the regex on the PHP side: [a-z0-9-_]{1,80}. */
export function projectJournalSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
