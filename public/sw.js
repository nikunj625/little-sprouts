/* Little Sprouts service worker — offline shell + push reminders */
const CACHE = 'little-sprouts-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Network-first for navigation, cache-first for static shell.
   Supabase API calls always go to network (never cached). */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in')) return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => hit))
  );
});

/* Push reminder from the Supabase Edge Function */
self.addEventListener('push', (e) => {
  let data = { title: 'Little Sprouts', body: 'Time to fill the daily checklist.' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  const opts = {
    body: data.body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    tag: data.tag || 'daily-reminder',
    renotify: true,
    data: { url: data.url || './' },
    actions: [{ action: 'open', title: 'Open checklist' }]
  };
  e.waitUntil(self.registration.showNotification(data.title || 'Little Sprouts', opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

/* Local fallback reminders scheduled by the app while it is open */
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'LOCAL_REMINDER') {
    self.registration.showNotification('Little Sprouts', {
      body: e.data.body || 'Checklist not filled yet today.',
      icon: './icons/icon-192.png',
      tag: 'local-reminder'
    });
  }
});
