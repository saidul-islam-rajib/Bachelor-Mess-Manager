const VERSION = 'v2';
const SHELL_CACHE = `bp-shell-${VERSION}`;
const ASSET_CACHE = `bp-assets-${VERSION}`;
const PAGE_CACHE = `bp-pages-${VERSION}`;
const OFFLINE_URL = '/offline.html';

const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

const CURRENT_CACHES = new Set([SHELL_CACHE, ASSET_CACHE, PAGE_CACHE]);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !CURRENT_CACHES.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  }
});

function isBuildUpdate(url) {
  return url.pathname.startsWith('/_next/static/webpack/') || url.pathname.includes('hot-update');
}

function isImmutableAsset(url) {
  if (isBuildUpdate(url)) return false;

  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/logo.png' ||
    url.pathname === '/logo.svg' ||
    url.pathname === '/og-image.png' ||
    url.pathname === '/manifest.json'
  );
}

function isUploadedImage(url) {
  return url.pathname.startsWith('/api/uploads/');
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;

    const shell = await caches.open(SHELL_CACHE);
    const offline = await shell.match(OFFLINE_URL);
    if (offline) return offline;

    throw error;
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (isUploadedImage(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE).catch(() => fetch(request)));
    return;
  }

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Bachelor Point', body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Bachelor Point', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-monochrome-512.png',
      data: { url: payload.url || '/dashboard' },
      tag: payload.tag || 'bachelor-point'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/dashboard';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(target) && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return undefined;
    })
  );
});
