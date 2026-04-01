import { apiFetch } from './client';

export function subscribePush(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return apiFetch<{ subscribed: boolean }>('push_subscriptions.php', {
    method: 'POST',
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: {
        p256dh: json.keys?.p256dh ?? '',
        auth:   json.keys?.auth ?? '',
      },
    }),
  });
}

export function unsubscribePush(endpoint: string) {
  return apiFetch<{ unsubscribed: boolean }>('push_subscriptions.php', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}
