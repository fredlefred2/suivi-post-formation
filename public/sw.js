/**
 * Service Worker minimal — YAPLUKA PWA
 * Pré-requis pour que Chrome déclenche beforeinstallprompt.
 * Stratégie : network-first, fallback cache pour le shell de base.
 */

const CACHE_NAME = 'yapluka-v1'
const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/yapluka-symbol.png',
]

// Installation : mise en cache du shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

// Activation : nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// Fetch : network-first, fallback cache
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes non-GET et les requêtes cross-origin
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mettre en cache la réponse fraîche pour les URLs du shell
        if (response.ok && SHELL_URLS.some((url) => event.request.url.endsWith(url))) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

// ── Push : réception notification en arrière-plan ──
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title || 'YAPLUKA'
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: data.url || '/' },
  }
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => {
        if (self.navigator?.setAppBadge) {
          return self.navigator.setAppBadge(data.badgeCount ?? 1)
        }
      })
      .catch(() => {})
  )
})

// ── Click sur notification : ouvre/focus l'app ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})
