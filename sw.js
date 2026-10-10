const CACHE_NAME = 'streamhub-v1';
const urlsToCache = [
    './',
    './Index.html',
    './manifest.json',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', event => {
    console.log('[ServiceWorker] Installation en cours...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Cache créé');
                return cache.addAll(urlsToCache.slice(0, 3)); // Cache local only
            })
            .catch(err => console.log('[ServiceWorker] Erreur cache:', err))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activation...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Suppression ancien cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);

    // Pour les requêtes API TMDB et serveur : essayer le réseau, sinon ignorer
    if (url.hostname.includes('themoviedb.org') || url.hostname.includes('overseerr') || url.hostname.includes('moonfin')) {
        event.respondWith(
            fetch(request)
                .catch(() => {
                    console.log('[ServiceWorker] Offline - API non disponible:', url.href);
                    return new Response('Hors ligne - Données API non disponibles', { status: 503 });
                })
        );
        return;
    }

    // Pour les ressources locales : cache first
    event.respondWith(
        caches.match(request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(request)
                    .then(response => {
                        if (!response || response.status !== 200 || response.type === 'error') {
                            return response;
                        }
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(request, responseToCache);
                            });
                        return response;
                    })
                    .catch(() => {
                        return new Response('Ressource non disponible hors ligne', { status: 503 });
                    });
            })
    );
});
