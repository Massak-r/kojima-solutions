import { apiFetch } from './client';

export interface EmailTemplate {
  id: string;
  label: string;
  description: string;
  subject: string;
  body: string;
  customized: boolean;
  updatedAt: string | null;
}

export function listEmailTemplates() {
  return apiFetch<EmailTemplate[]>('email_templates.php');
}

export function updateEmailTemplate(id: string, data: { subject: string; body: string }) {
  return apiFetch<{ id: string; updated: boolean }>(`email_templates.php?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function resetEmailTemplate(id: string) {
  return apiFetch<{ id: string; reset: boolean }>(`email_templates.php?id=${id}`, {
    method: 'DELETE',
  });
}
