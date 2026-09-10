const CACHE_NAME = 'ed-dict-cache-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css?v=12',
  './app.js?v=12',
  './config.js?v=12',
  './manifest.webmanifest',
  './dictionary.json?v=12'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    )
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            if (event.request.method === 'GET') cache.put(event.request, cloned);
          });
          return response;
        })
        .catch(() => cached);
    })
  );
});
