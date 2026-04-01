import { apiFetch } from './client';

export interface NotificationItem {
  id:           string;
  projectId:    string | null;
  projectTitle: string;
  taskTitle:    string;
  clientName:   string;
  question:     string;
  response:     string;
  read:         boolean;
  readAt:       string | null;
  createdAt:    string;
}

interface NotificationsResponse {
  items:       NotificationItem[];
  unreadCount: number;
}

export function listNotifications(unreadOnly = false, limit = 50) {
  const params = new URLSearchParams();
  if (unreadOnly) params.set('unread', '1');
  if (limit !== 50) params.set('limit', String(limit));
  const qs = params.toString();
  return apiFetch<NotificationsResponse>(`notifications.php${qs ? `?${qs}` : ''}`);
}

export function markRead(id: string) {
  return apiFetch<{ ok: boolean }>(`notifications.php?id=${id}`, { method: 'PUT' });
}

export function markAllRead() {
  return apiFetch<{ ok: boolean }>('notifications.php?action=read-all', { method: 'PUT' });
}
