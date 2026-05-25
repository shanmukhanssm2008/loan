const CACHE_NAME = 'loan-ledger-v1';
const ASSETS = [
  '.',
  'index.html',
  'styles.css',
  'js/db.js',
  'js/screens.js',
  'js/app.js',
  'manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
