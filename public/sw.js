const CACHE_NAME = 'kojima-space-v5';
const ASSETS_CACHE = 'kojima-assets-v1';
const API_CACHE = 'kojima-api-v2';
const API_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const SHELL_URLS = ['/', '/index.html', '/offline.html'];

// ── Install: cache shell (but don't skipWaiting — wait for update signal) ────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  );
});

// ── Activate: clean old caches, claim clients ────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== ASSETS_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: network-first for navigation, cache-first for assets ──────────────
self.addEventListener('fetch', (e) => {
  const { request } = e;

  // Audio/video: always pass through to network (range requests need direct handling)
  if (request.destination === 'audio' || request.destination === 'video') {
    e.respondWith(fetch(request));
    return;
  }

  // Navigation requests: network → cached shell → offline page
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // API write requests (POST/PUT/DELETE): always pass through to network directly
  // Never intercept uploads or mutations — avoids false "offline" errors on large uploads
  if (request.url.includes('/api/') && request.method !== 'GET') {
    e.respondWith(fetch(request));
    return;
  }

  // API GET requests: network-first with cache fallback
  if (request.url.includes('/api/')) {
    e.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              const headers = new Headers(clone.headers);
              headers.set('sw-cached-at', Date.now().toString());
              clone.text().then((body) => {
                cache.put(request, new Response(body, {
                  status: clone.status,
                  statusText: clone.statusText,
                  headers,
                }));
              });
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (!cached) return new Response('{"error":"offline"}', {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            });
            const cachedAt = parseInt(cached.headers.get('sw-cached-at') || '0', 10);
            if (Date.now() - cachedAt > API_CACHE_TTL) {
              return new Response('{"error":"cache_expired"}', {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
              });
            }
            return cached;
          })
        )
    );
    return;
  }

  // Static assets (Vite bundles): cache-first for speed
  if (request.url.includes('/assets/')) {
    e.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Only cache successful responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(ASSETS_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => new Response('', { status: 503 }));
      })
    );
    return;
  }
});

// ── Message: controlled skip-waiting for update banner ───────────────────────
self.addEventListener('message', (e) => {
  if (e.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (e) => {
  if (!e.data) return;

  let data;
  try {
    data = e.data.json();
  } catch {
    data = { title: 'Kojima Solutions', body: e.data.text() };
  }

  const options = {
    body:  data.body || '',
    icon:  data.icon || '/icons/icon-192x192.png',
    badge: data.badge || '/icons/icon-192x192.png',
    data:  { url: data.url || '/space' },
    vibrate: [100, 50, 100],
    tag: 'kojima-notification',
    renotify: true,
  };

  e.waitUntil(self.registration.showNotification(data.title || 'Kojima Solutions', options));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();

  const url = e.notification.data?.url || '/space';

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
