const CACHE = 'objetivos-spatial-v13';
const ASSETS = ['./', './index.html', './styles.css?v=13', './app.js?v=13', './cloud-config.js?v=13', './cloud-sync.js?v=13', './manifest.webmanifest?v=13', './assets/icon.svg?v=13', './assets/apple-touch-icon.png?v=13', './assets/icon-192.png', './assets/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('./index.html')));
    return;
  }
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json?.() || {}; } catch { data = { title: 'OBJETIVOS', body: event.data?.text?.() || 'Você tem uma tarefa agora.' }; }
  const title = data.title || 'OBJETIVOS';
  event.waitUntil(self.registration.showNotification(title, {
    body: data.body || 'Uma tarefa da sua rotina está começando.',
    icon: './assets/icon-192.png',
    badge: './assets/icon-192.png',
    tag: data.tag || `objetivos-${Date.now()}`,
    data: { url: data.url || './', ...(data.data || {}) }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.href).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const existing = clients.find((client) => client.url.startsWith(self.location.origin));
      if (existing) {
        if ('navigate' in existing) await existing.navigate(target);
        return existing.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
