import { apiFetch } from './client';

export function sendInvoiceReminder(data: {
  quoteId: string;
  clientEmail: string;
  clientName: string;
  quoteNumber: string;
  amount: string;
}): Promise<{ sent: boolean; sentAt: string }> {
  return apiFetch('invoice_reminder.php', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
