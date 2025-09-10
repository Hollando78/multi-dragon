// Dragon Isle Mobile - Service Worker
const CACHE_NAME = 'dragon-isle-v1.0.0';
const STATIC_CACHE = 'dragon-isle-static-v1.0.0';
const DYNAMIC_CACHE = 'dragon-isle-dynamic-v1.0.0';

// Critical app shell resources
const APP_SHELL = [
  '/',
  '/index.html',
  '/login.html', 
  '/game.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Resources that should be cached but are not critical
const STATIC_RESOURCES = [
  '/src/main.js',
  '/src/pwa/PWAManager.js',
  '/src/components/AppShell.js',
  '/src/pages/Login.js',
  '/src/pages/Game.js'
];

// Network-first resources (real-time data)
const NETWORK_FIRST = [
  '/socket.io/',
  '/api/',
  'ws://',
  'wss://'
];

self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache app shell (critical resources)
      caches.open(CACHE_NAME).then((cache) => {
        console.log('📦 Caching app shell');
        return cache.addAll(APP_SHELL);
      }),
      
      // Cache static resources
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
    ]).then(() => {
      console.log('✅ Service Worker installed');
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && 
                cacheName !== STATIC_CACHE && 
                cacheName !== DYNAMIC_CACHE) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated');
    })
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // Skip WebSocket connections
  if (url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  // Skip Socket.io requests (must be network-only)
  if (url.pathname.startsWith('/socket.io/')) {
    return;
  }
  
  event.respondWith(
    handleRequest(request)
  );
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  try {
    // Strategy 1: App Shell - Cache First
    if (APP_SHELL.includes(path) || path === '/') {
      return await cacheFirst(request, CACHE_NAME);
    }
    
    // Strategy 2: Static Resources - Cache First with Network Fallback
    if (isStaticResource(path)) {
      return await cacheFirst(request, STATIC_CACHE);
    }
    
    // Strategy 3: API/WebSocket - Network Only
    if (isNetworkOnly(path)) {
      return await networkOnly(request);
    }
    
    // Strategy 4: Dynamic Content - Network First with Cache Fallback
    return await networkFirst(request, DYNAMIC_CACHE);
    
  } catch (error) {
    console.error('🚨 Fetch failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return await getOfflinePage();
    }
    
    // Return cached version or fail gracefully
    const cachedResponse = await caches.match(request);
    return cachedResponse || new Response('Service Unavailable', { 
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  const networkResponse = await fetch(request);
  const cache = await caches.open(cacheName);
  cache.put(request, networkResponse.clone());
  
  return networkResponse;
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Fallback to cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

async function networkOnly(request) {
  return fetch(request);
}

function isStaticResource(path) {
  return path.startsWith('/src/') || 
         path.startsWith('/assets/') ||
         path.endsWith('.js') ||
         path.endsWith('.css') ||
         path.endsWith('.png') ||
         path.endsWith('.jpg') ||
         path.endsWith('.svg');
}

function isNetworkOnly(path) {
  return NETWORK_FIRST.some(pattern => path.includes(pattern));
}

async function getOfflinePage() {
  try {
    const cache = await caches.open(CACHE_NAME);
    return await cache.match('/') || await cache.match('/index.html');
  } catch (error) {
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Dragon Isle - Offline</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: system-ui; 
            text-align: center; 
            padding: 2rem; 
            background: #1a1a1a; 
            color: white; 
          }
          .dragon { font-size: 4rem; margin-bottom: 1rem; }
          .title { font-size: 2rem; color: #0080ff; margin-bottom: 1rem; }
          .message { font-size: 1.1rem; color: #ccc; }
        </style>
      </head>
      <body>
        <div class="dragon">🐉</div>
        <h1 class="title">Dragon Isle</h1>
        <p class="message">You're offline, but the dragons are waiting!<br>
        Check your connection and try again.</p>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// Handle background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'player-actions') {
    event.waitUntil(syncPlayerActions());
  }
});

async function syncPlayerActions() {
  console.log('🔄 Syncing offline player actions...');
  // Implementation would sync queued actions when back online
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (!event.data) {
    return;
  }
  
  const data = event.data.json();
  const title = data.title || 'Dragon Isle';
  const options = {
    body: data.body || 'Something happened in your world!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: data.tag || 'dragon-isle-notification',
    data: data.data || {},
    actions: [
      {
        action: 'open',
        title: 'Open Game'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' || event.action === '') {
    event.waitUntil(
      clients.openWindow('/game.html')
    );
  }
});