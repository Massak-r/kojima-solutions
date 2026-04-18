import { apiFetch } from './client';

export interface AIBreakdownResponse {
  response:    string;
  model:       string;
  usage?:      { input_tokens?: number; output_tokens?: number } | null;
  stopReason?: string | null;
}

/** Calls the server-side Anthropic proxy. May return 503 if ANTHROPIC_API_KEY is unset. */
export function aiBreakdown(prompt: string) {
  return apiFetch<AIBreakdownResponse>('ai_breakdown.php', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}
