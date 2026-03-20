'use client'

import { useEffect } from 'react'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function PushRegistration() {
  useEffect(() => {
    async function registerPush() {
      try {
        if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
          console.log('[Push] PushManager non supporté')
          return
        }

        const reg = await navigator.serviceWorker.ready
        console.log('[Push] SW ready')

        const existing = await reg.pushManager.getSubscription()
        if (existing) {
          console.log('[Push] Déjà abonné:', existing.endpoint.substring(0, 60))
          return
        }

        const permission = await Notification.requestPermission()
        console.log('[Push] Permission:', permission)
        if (permission !== 'granted') return

        const vapidRes = await fetch('/api/push/vapid')
        if (!vapidRes.ok) {
          console.error('[Push] Erreur VAPID:', vapidRes.status)
          return
        }
        const { publicKey } = await vapidRes.json()
        if (!publicKey) {
          console.error('[Push] Clé VAPID vide')
          return
        }
        console.log('[Push] VAPID key reçue:', publicKey.substring(0, 20) + '...')

        const applicationServerKey = urlBase64ToUint8Array(publicKey)

        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
        })
        console.log('[Push] Souscription créée:', subscription.endpoint.substring(0, 60))

        const sub = subscription.toJSON()
        const saveRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: sub.keys,
          }),
        })
        console.log('[Push] Sauvegarde:', saveRes.ok ? '✅' : '❌ ' + saveRes.status)
      } catch (err) {
        console.error('[Push] Erreur:', err)
      }
    }

    // SW message listener (badge + navigate)
    function handleSWMessage(event: MessageEvent) {
      try {
        const { type, count, url } = event.data || {}
        if (type === 'SET_BADGE') {
          ;(navigator as any).setAppBadge?.(count ?? 1)
        }
        if (type === 'CLEAR_BADGE') {
          ;(navigator as any).clearAppBadge?.()
        }
        if (type === 'NAVIGATE' && url) {
          window.location.href = url
        }
      } catch {
        // Fail silently
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    // Delay push registration to not block initial render
    const timer = setTimeout(registerPush, 2000)

    return () => {
      clearTimeout(timer)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  return null
}
