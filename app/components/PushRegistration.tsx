'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

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

async function subscribePush(): Promise<boolean> {
  try {
    if (!('PushManager' in window) || !('serviceWorker' in navigator)) {
      console.log('[Push] PushManager non supporté')
      return false
    }

    const reg = await navigator.serviceWorker.ready
    console.log('[Push] SW ready')

    let subscription = await reg.pushManager.getSubscription()

    if (subscription) {
      console.log('[Push] Souscription existante:', subscription.endpoint.substring(0, 60))
    } else {
      const permission = await Notification.requestPermission()
      console.log('[Push] Permission:', permission)
      if (permission !== 'granted') return false

      const vapidRes = await fetch('/api/push/vapid')
      if (!vapidRes.ok) return false
      const { publicKey } = await vapidRes.json()
      if (!publicKey) return false

      const applicationServerKey = urlBase64ToUint8Array(publicKey)
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      })
      console.log('[Push] Nouvelle souscription:', subscription.endpoint.substring(0, 60))
    }

    const sub = subscription.toJSON()
    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
    })
    console.log('[Push] Sauvegarde:', saveRes.ok ? '✅' : '❌ ' + saveRes.status)
    return saveRes.ok
  } catch (err) {
    console.error('[Push] Erreur:', err)
    return false
  }
}

const DISMISS_KEY = 'push_banner_dismissed'

export default function PushRegistration() {
  const [showBanner, setShowBanner] = useState(false)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    // SW message listener
    function handleSWMessage(event: MessageEvent) {
      try {
        const { type, count, url } = event.data || {}
        if (type === 'SET_BADGE') (navigator as any).setAppBadge?.(count ?? 1)
        if (type === 'CLEAR_BADGE') (navigator as any).clearAppBadge?.()
        if (type === 'NAVIGATE' && url) window.location.href = url
      } catch {}
    }
    navigator.serviceWorker?.addEventListener('message', handleSWMessage)

    // Try auto-subscribe after delay
    const timer = setTimeout(async () => {
      if (!('PushManager' in window) || !('serviceWorker' in navigator)) return
      if (!('Notification' in window)) return

      // Already granted? Subscribe silently
      if (Notification.permission === 'granted') {
        await subscribePush()
        return
      }

      // Denied? Don't show banner
      if (Notification.permission === 'denied') return

      // Default (not asked yet) — show banner if not dismissed recently
      const dismissed = localStorage.getItem(DISMISS_KEY)
      if (dismissed) {
        const dismissedAt = new Date(dismissed).getTime()
        if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return // 7 days
      }
      setShowBanner(true)
    }, 3000)

    return () => {
      clearTimeout(timer)
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage)
    }
  }, [])

  const [debugMsg, setDebugMsg] = useState('')

  async function handleActivate() {
    setSubscribing(true)
    setDebugMsg('Démarrage...')
    try {
      if (!('PushManager' in window)) { setDebugMsg('❌ PushManager non dispo'); setSubscribing(false); return }
      if (!('serviceWorker' in navigator)) { setDebugMsg('❌ SW non dispo'); setSubscribing(false); return }

      setDebugMsg('Attente SW...')
      const reg = await navigator.serviceWorker.ready
      setDebugMsg('SW OK. Vérif abo...')

      let subscription = await reg.pushManager.getSubscription()
      if (!subscription) {
        setDebugMsg('Demande permission...')
        const perm = await Notification.requestPermission()
        setDebugMsg('Permission: ' + perm)
        if (perm !== 'granted') { setSubscribing(false); return }

        const vapidRes = await fetch('/api/push/vapid')
        const { publicKey } = await vapidRes.json()
        setDebugMsg('VAPID reçue, subscribe...')

        const key = urlBase64ToUint8Array(publicKey)
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        })
      }
      setDebugMsg('Abo OK. Envoi backend...')

      const sub = subscription.toJSON()
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys }),
      })

      if (saveRes.ok) {
        setDebugMsg('✅ Tout bon !')
        setShowBanner(false)
      } else {
        const errBody = await saveRes.text()
        setDebugMsg('❌ Save: ' + saveRes.status + ' ' + errBody)
      }
    } catch (err: any) {
      setDebugMsg('❌ ' + (err?.message || String(err)))
    }
    setSubscribing(false)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, new Date().toISOString())
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm z-50 animate-in slide-in-from-bottom-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Activer les notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Sois alerté quand ton équipe agit ou quand ton formateur t&apos;écrit.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleActivate}
                disabled={subscribing}
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
              >
                {subscribing ? 'Activation...' : '🔔 Activer'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Plus tard
              </button>
            </div>
            {debugMsg && (
              <p className="text-[10px] text-orange-600 mt-1 font-mono">{debugMsg}</p>
            )}
          </div>
          <button onClick={handleDismiss} className="text-gray-400 hover:text-gray-600 p-1">
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
