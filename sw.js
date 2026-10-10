/* Service worker — schema comune a RecompApp, Bilancio, Style Wishlist e Noi Due.
   - VERSION è la versione dell'app: è la stessa usata in index.html come ?v=VERSION.
   - Pagina: rete con timeout di 3 secondi, poi la copia salvata (veloce anche con segnale scarso).
   - File con ?v= e icone: prima la cache; un nuovo rilascio cambia ?v= e quindi l'indirizzo.
   - Il nuovo worker resta in attesa finché l'app non chiede di attivarlo (avviso "Aggiorna"). */
const VERSION = '1.31.2';
const PREFIX = 'noidue-cache-';
const CACHE = PREFIX + VERSION;
const SHELL = [
  './',
  './index.html',
  './suite.js?v=1.31.2',
  './style.css?v=1.31.2',
  './suite-ui.css?v=1.31.2',
  './suite-tokens.css?v=1.31.2',
  './app.js?v=1.31.2',
  './manifest.json?v=1.31.2',
  './icons/icon-192.png?v=1.31.2',
  './icons/icon-512.png?v=1.31.2',
  './icons/icon-maskable-192.png?v=1.31.2',
  './icons/icon-maskable-512.png?v=1.31.2',
  './icons/apple-touch-icon.png?v=1.31.2',
  './apple-touch-icon.png',
  './apple-touch-icon-precomposed.png'
];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  const d = event.data;
  if (d === 'skip-waiting' || (d && d.type === 'SKIP_WAITING')) self.skipWaiting();
});

function fromNetworkAndStore(request, cacheKey) {
  return fetch(request, { cache: 'no-store' }).then((response) => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE).then((cache) => cache.put(cacheKey || request, copy));
    }
    return response;
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    const network = fromNetworkAndStore(req, './index.html');
    event.waitUntil(network.catch(() => {}));
    const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
    event.respondWith(
      Promise.race([network, timeout])
        .then((res) => res || caches.match('./index.html'))
        .catch(() => caches.match('./index.html'))
        .then((res) => res || network)
    );
    return;
  }

  event.respondWith(caches.match(req).then((cached) => cached || fromNetworkAndStore(req)));
});

/* v1.28.0 — Notifiche push "Il tuo partner ha aggiunto/rimosso qualcosa". */
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Noi Due';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || '',
      tag: d.tag || 'noidue',
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: d.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.registration.scope)) return c.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
