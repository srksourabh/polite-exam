// Service Worker for Polite Exam PWA
// Version timestamp - update this on each deployment to bust cache
const CACHE_VERSION = 'v2-' + '20251201';
const CACHE_NAME = 'polite-exam-' + CACHE_VERSION;

// Static assets that rarely change (cache-first)
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Dynamic assets that should use network-first (HTML, JS)
const DYNAMIC_ASSETS = [
  '/',
  '/index.html',
  '/api-integration.js'
];

// Install event - cache static resources immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Installing new version:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // Force this service worker to become active immediately
        console.log('[SW] Skip waiting - activating immediately');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches and take control
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating new version:', CACHE_VERSION);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete any cache that doesn't match current version
            if (cacheName.startsWith('polite-exam-') && cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        // Take control of all clients immediately
        console.log('[SW] Claiming all clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - different strategies for different resources
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip API requests - always go to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // For HTML and JS files: Network-first with cache fallback
  if (url.pathname === '/' ||
      url.pathname.endsWith('.html') ||
      url.pathname.endsWith('.js')) {
    event.respondWith(networkFirstStrategy(event.request));
    return;
  }

  // For static assets (icons, manifest): Cache-first with network fallback
  event.respondWith(cacheFirstStrategy(event.request));
});

// Network-first strategy: Try network, fall back to cache
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);

    // If successful, update the cache
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log('[SW] Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    // If both network and cache fail, return a basic offline response for HTML
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response(
        '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your internet connection and try again.</p></body></html>',
        { headers: { 'Content-Type': 'text/html' } }
      );
    }

    throw error;
  }
}

// Cache-first strategy: Try cache, fall back to network
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);

    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('[SW] Both cache and network failed for:', request.url);
    throw error;
  }
}

// Listen for messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received skip waiting message');
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION });
  }
});
