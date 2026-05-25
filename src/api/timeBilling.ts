import { apiFetch } from './client';

export interface SuggestedSubtaskLine {
  subtask: string;
  hours: number;
  sessions: number;
  sessionIds: string[];
}

export interface SuggestedObjectiveLine {
  objective: string;
  hours: number;
  sessions: number;
  sessionIds: string[];
  subtasks: SuggestedSubtaskLine[];
}

export interface SuggestedQuoteLines {
  projectId: string;
  projectTitle: string;
  clientId: string | null;
  totalHours: number;
  breakdown: SuggestedObjectiveLine[];
  message?: string;
}

/** Aggregate unbilled focus time for a project, grouped by objective and
 *  subtask. Powers the "Importer le temps tracé" dialog on QuoteForm. */
export function suggestQuoteLines(projectId: string) {
  return apiFetch<SuggestedQuoteLines>(
    `auto/suggest_quote_lines.php?project_id=${encodeURIComponent(projectId)}`,
  );
}
