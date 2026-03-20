'use client'

import { useEffect } from 'react'

export default function PushRegistration() {
  useEffect(() => {
    async function registerPush() {
      try {
        // Check browser support
        if (!('PushManager' in window) || !('serviceWorker' in navigator)) return

        // Wait for SW to be ready
        const reg = await navigator.serviceWorker.ready

        // Already subscribed?
        const existing = await reg.pushManager.getSubscription()
        if (existing) return

        // Request permission
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        // Get VAPID public key from server
        const vapidRes = await fetch('/api/push/vapid')
        if (!vapidRes.ok) return
        const { publicKey } = await vapidRes.json()
        if (!publicKey) return

        // Subscribe
        const subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        })

        // Send subscription to backend
        const sub = subscription.toJSON()
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: sub.endpoint,
            keys: sub.keys,
          }),
        })
      } catch {
        // Fail silently
      }
    }

    registerPush()

    // Listen for messages from the service worker
    function handleSWMessage(event: MessageEvent) {
      try {
        const { type, count, url } = event.data || {}

        if (type === 'SET_BADGE') {
          (navigator as any).setAppBadge?.(count ?? 1)
        }

        if (type === 'CLEAR_BADGE') {
          (navigator as any).clearAppBadge?.()
        }

        if (type === 'NAVIGATE' && url) {
          window.location.href = url
        }
      } catch {
        // Fail silently
      }
    }

    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  return null
}
