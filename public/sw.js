/**
 * Service Worker minimal — YAPLUKA PWA
 * Pré-requis pour que Chrome déclenche beforeinstallprompt.
 * Stratégie : network-first, fallback cache pour le shell de base.
 */

const CACHE_NAME = 'yapluka-v2'
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

// Activation : nettoyage des anciens caches (garder badge cache)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== BADGE_CACHE).map((k) => caches.delete(k)))
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

// ── Compteur badge persistant via Cache API ──
const BADGE_CACHE = 'yapluka-badge'
const BADGE_KEY = new Request('/_badge_count')

async function getBadgeCount() {
  try {
    const cache = await caches.open(BADGE_CACHE)
    const res = await cache.match(BADGE_KEY)
    if (res) return parseInt(await res.text(), 10) || 0
  } catch {}
  return 0
}

async function setBadgeCount(count) {
  try {
    const cache = await caches.open(BADGE_CACHE)
    await cache.put(BADGE_KEY, new Response(String(count)))
  } catch {}
}

// ── Push : réception notification en arrière-plan ──
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title || 'YAPLUKA'
  const tag = 'notif-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag,
    data: { url: data.url || '/' },
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options)
      // Incrémenter le compteur persistant
      const count = (await getBadgeCount()) + 1
      await setBadgeCount(count)
      if (self.navigator?.setAppBadge) {
        await self.navigator.setAppBadge(count).catch(() => {})
      }
    })()
  )
})

// ── Message depuis l'app : effacer les notifications du plateau ──
self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_NOTIFICATIONS') {
    event.waitUntil(
      (async () => {
        const notifications = await self.registration.getNotifications()
        notifications.forEach((n) => n.close())
        await setBadgeCount(0)
        if (self.navigator?.clearAppBadge) {
          await self.navigator.clearAppBadge().catch(() => {})
        }
      })()
    )
  }
})

// ── Click sur notification : ouvre/focus l'app ──
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    (async () => {
      // Décrémenter le badge (la notif cliquée est fermée)
      const remaining = await self.registration.getNotifications()
      await setBadgeCount(remaining.length)
      if (self.navigator?.setAppBadge && remaining.length > 0) {
        await self.navigator.setAppBadge(remaining.length).catch(() => {})
      } else if (self.navigator?.clearAppBadge) {
        await self.navigator.clearAppBadge().catch(() => {})
      }

      const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })()
  )
})
