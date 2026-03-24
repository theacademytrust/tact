const CACHE_NAME = 'tact-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/assets/css/performance.css',
  '/assets/js/performance.js',
  '/assets/images/tact-logo.jpg',
  '/shared-ribbon.css',
  '/donate.html',
  '/vijnana-harate.html',
  '/vijnana-aranya.html',
  '/vijnana-yuvati.html',
  '/vijnana-nataka.html',
  '/ganitha-mela.html'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

function shouldUseNetworkFirst(request) {
  if (request.mode === 'navigate') {
    return true;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return false;
  }

  return (
    url.pathname.endsWith('/content/events/events-feed.js') ||
    url.pathname.endsWith('/data/gallery.json') ||
    /\.(?:js|css|html|json)$/i.test(url.pathname)
  );
}

// Fetch event - prefer network for pages and event feed, cache-first elsewhere
self.addEventListener('fetch', event => {
  if (shouldUseNetworkFirst(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.status === 200 && response.type === 'basic') {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Clone request because it's a stream and can only be consumed once
        const fetchRequest = event.request.clone();
        
        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          // Clone response because it's a stream and can only be consumed once
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          
          return response;
        }).catch(() => {
          // Return cached version if available
          return caches.match(event.request);
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});
