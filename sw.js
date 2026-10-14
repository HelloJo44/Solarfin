// Incrémenter la version à chaque déploiement pour purger l'ancien cache
const CACHE_NAME = 'solarfin-v3';
const urlsToCache = [
    './',
    './index.html',
    './kids.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
            .catch(err => console.log('[ServiceWorker] Erreur cache:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => Promise.all(
            cacheNames
                .filter(cacheName => cacheName !== CACHE_NAME)
                .map(cacheName => caches.delete(cacheName))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // On ne touche qu'aux GET de notre propre origine. Les appels API (TMDB, Seer, et le proxy /api/)
    // ne sont jamais mis en cache : ils portent des clés API et doivent toujours être frais.
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
        return;
    }

    // Réseau d'abord (pour toujours avoir la dernière version), cache en secours hors ligne
    event.respondWith(
        fetch(request)
            .then(response => {
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
                }
                return response;
            })
            .catch(() => caches.match(request).then(cached =>
                cached || new Response('Ressource non disponible hors ligne', { status: 503 })
            ))
    );
});
