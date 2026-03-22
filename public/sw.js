/**
 * Service Worker — YAPLUKA PWA
 * - Cache strategy: network-first, fallback cache for shell URLs
 * - Push notifications with badge support
 * - Notification click handling (open/focus app)
 */

const CACHE_NAME = 'yapluka-v7'
const SHELL_URLS = [
  '/',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/yapluka-symbol.png',
]

// ─── Installation : mise en cache du shell ───────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS))
  )
  self.skipWaiting()
})

// ─── Activation : nettoyage des anciens caches ──────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

// ─── Fetch : network-first, fallback cache ───────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!event.request.url.startsWith(self.location.origin)) return

  // Ne pas intercepter les requêtes de navigation (pages HTML)
  // Laisser le navigateur les gérer directement → évite les crashes
  if (event.request.mode === 'navigate') return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && SHELL_URLS.some((url) => event.request.url.endsWith(url))) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(async () => {
        const cached = await caches.match(event.request)
        return cached || new Response('Offline', { status: 503 })
      })
  )
})

// ─── Push : afficher une notification ────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'YAPLUKA', body: event.data?.text() ?? '' }
  }

  const {
    title = 'YAPLUKA',
    body = '',
    icon = '/icon-192.png',
    badge = '/icon-192.png',
    url = '/',
    badgeCount = 1,
  } = data

  const options = {
    body,
    icon,
    badge,
    tag: 'yapluka-' + Date.now(), // tag unique → les notifs s'empilent
    data: { url },
  }

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      // Update app badge directly (works even when app is closed)
      if (self.navigator && self.navigator.setAppBadge) {
        return self.navigator.setAppBadge(badgeCount)
      }
    })
  )
})

// ─── Notification click : ouvrir/focus l'app ─────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      // Try to focus an existing window on the same origin
      const existing = clients.find((c) =>
        c.url.startsWith(self.location.origin)
      )

      // Clear badge and close all notifications
      if (self.navigator?.clearAppBadge) self.navigator.clearAppBadge().catch(() => {})
      self.registration.getNotifications().then(notifs => notifs.forEach(n => n.close()))

      if (existing) {
        existing.postMessage({ type: 'CLEAR_BADGE' })
        return existing.focus().then((client) => {
          client.postMessage({ type: 'NAVIGATE', url: targetUrl })
        })
      }

      // No existing window — open a new one
      return self.clients.openWindow(targetUrl)
    })
  )
})

// ─── Message : badge API depuis les clients ──────────────────────────
self.addEventListener('message', (event) => {
  const { type, count } = event.data || {}

  if (type === 'SET_BADGE') {
    self.navigator?.setAppBadge?.(count || 1).catch(() => {})
  }

  if (type === 'CLEAR_BADGE') {
    self.navigator?.clearAppBadge?.().catch(() => {})
  }
})
