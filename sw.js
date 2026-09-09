const CACHE = 'objetivos-spatial-v37';
const ASSETS = ['./', './index.html', './styles.css?v=37', './dom-patch.js?v=37', './fluency-engine.js?v=37', './personal-resources.js?v=37', './sound-engine.js?v=37', './app.js?v=37', './cloud-config.js?v=21', './cloud-sync.js?v=37', './manifest.webmanifest?v=21', './assets/os-icon-v18-180.png', './assets/os-icon-v18-192.png', './assets/os-icon-v18-512.png'];

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
    // A page can use Web Audio after a gesture. The worker cannot play a custom
    // sound itself. Keep the OS sound unless a visible page confirms playback.
    let customPlayed = false;
    try {
      const windows = await self.clients.matchAll({ type: 'window' });
      const foreground = windows.find(client => client.visibilityState === 'visible' && client.focused)
        || windows.find(client => client.visibilityState === 'visible');
      customPlayed = foreground ? await new Promise(resolve => {
        const channel = new MessageChannel();
        const finish = played => { clearTimeout(timer); channel.port1.close(); resolve(played); };
        const timer = setTimeout(() => finish(false), 250);
        channel.port1.onmessage = event => finish(event.data?.played === true);
        try { foreground.postMessage({ type: 'objetivos:push-sound', tag }, [channel.port2]); }
        catch { channel.port2.close(); finish(false); }
      }) : false;
    } catch { /* A closing tab must not prevent delivery of the notification. */ }
    await self.registration.showNotification(title, {
      body: data.body || 'Uma tarefa da sua rotina está começando.',
      icon: './assets/os-icon-v18-192.png',
      badge: './assets/os-icon-v18-192.png',
      tag,
      renotify: false,
      ...(customPlayed ? { silent: true } : {}),
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
