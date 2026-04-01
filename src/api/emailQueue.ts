import { apiFetch } from './client';

export interface QueuedEmail {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  body: string;
  cta_url: string | null;
  source: string;
  project_id: string | null;
  status: 'pending' | 'sent' | 'discarded';
  created_at: string;
  sent_at: string | null;
}

export function listQueuedEmails(status = 'pending') {
  return apiFetch<QueuedEmail[]>(`email_queue.php?status=${status}`);
}

export function sendQueuedEmail(id: string) {
  return apiFetch<{ sent: boolean }>(`email_queue.php?id=${id}&action=send`, { method: 'PUT' });
}

export function sendAllQueuedEmails() {
  return apiFetch<{ sent: number; total: number }>('email_queue.php?action=send-all', { method: 'PUT' });
}

export function discardQueuedEmail(id: string) {
  return apiFetch<{ ok: boolean }>(`email_queue.php?id=${id}&action=discard`, { method: 'PUT' });
}

export function updateQueuedEmail(id: string, data: Partial<Pick<QueuedEmail, 'recipient_email' | 'subject' | 'body' | 'cta_url'>>) {
  return apiFetch<QueuedEmail>(`email_queue.php?id=${id}&action=update`, {
    method: 'PUT',
    body: JSON.stringify({
      recipientEmail: data.recipient_email,
      subject: data.subject,
      body: data.body,
      ctaUrl: data.cta_url,
    }),
  });
}
