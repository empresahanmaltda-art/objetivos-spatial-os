const CACHE = 'objetivos-spatial-v32';
const ASSETS = ['./', './index.html', './styles.css?v=32', './fluency-engine.js?v=32', './app.js?v=32', './cloud-config.js?v=21', './cloud-sync.js?v=32', './manifest.webmanifest?v=21', './assets/os-icon-v18-180.png', './assets/os-icon-v18-192.png', './assets/os-icon-v18-512.png'];

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
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: 'no-store' });
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', response.clone());
        }
        return response;
      } catch {
        return caches.match('./index.html');
      }
    })());
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
  const tag = data.tag || `objetivos-${Date.now()}`;
  event.waitUntil((async () => {
    const duplicates = await self.registration.getNotifications({ tag });
    duplicates.forEach((notification) => notification.close());
    await self.registration.showNotification(title, {
      body: data.body || 'Uma tarefa da sua rotina está começando.',
      icon: './assets/os-icon-v18-192.png',
      badge: './assets/os-icon-v18-192.png',
      tag,
      renotify: false,
      data: { url: data.url || './', ...(data.data || {}) }
    });
  })());
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
