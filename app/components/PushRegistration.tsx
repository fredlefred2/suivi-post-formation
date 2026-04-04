'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { isStandalone, INSTALL_VISIBLE_KEY } from './InstallPrompt'

/**
 * Convertit une clé VAPID base64url en Uint8Array
 */
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

const PUSH_DISMISS_KEY = 'push_dismissed_at'
const PUSH_DENIED_KEY = 'push_denied_at'
const PUSH_DISMISS_DELAY = 7 * 24 * 60 * 60 * 1000 // 7 jours
const PUSH_DENIED_DELAY = 30 * 24 * 60 * 60 * 1000 // 30 jours

type PushState = 'loading' | 'unsupported' | 'denied' | 'prompt' | 'subscribed' | 'hidden'

function isPushDismissed() {
  const ts = localStorage.getItem(PUSH_DISMISS_KEY)
  if (!ts) return false
  return Date.now() - parseInt(ts, 10) < PUSH_DISMISS_DELAY
}

function isPushDeniedHidden() {
  const ts = localStorage.getItem(PUSH_DENIED_KEY)
  if (!ts) return false
  return Date.now() - parseInt(ts, 10) < PUSH_DENIED_DELAY
}

export default function PushRegistration() {
  const [state, setState] = useState<PushState>('loading')

  // ── Déterminer l'état initial ──
  useEffect(() => {
    async function checkState() {
      // Ne montrer que si l'app est installée (standalone)
      if (!isStandalone()) {
        setState('hidden')
        return
      }

      // Ne pas montrer si InstallPrompt est visible
      if (sessionStorage.getItem(INSTALL_VISIBLE_KEY)) {
        setState('hidden')
        return
      }

      // Si "Plus tard" encore actif
      if (isPushDismissed()) {
        setState('hidden')
        return
      }

      // Support navigateur
      if (!('PushManager' in window) || !('serviceWorker' in navigator) || !('Notification' in window)) {
        setState('unsupported')
        return
      }

      // Permission refusée + délai 30j
      if (Notification.permission === 'denied') {
        if (isPushDeniedHidden()) {
          setState('hidden')
        } else {
          localStorage.setItem(PUSH_DENIED_KEY, Date.now().toString())
          setState('denied')
        }
        return
      }

      // Permission déjà accordée → tenter de s'abonner silencieusement
      if (Notification.permission === 'granted') {
        const ok = await doSubscribe()
        setState(ok ? 'subscribed' : 'prompt')
        return
      }

      // Permission pas encore demandée → afficher la bannière
      setState('prompt')
    }

    // Attendre un peu que l'app se charge
    const timer = setTimeout(checkState, 2000)
    return () => clearTimeout(timer)
  }, [])

  // ── Forcer la mise à jour du SW + listener messages ──
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.update().catch(() => {})
      })
    }

    function onMessage(e: MessageEvent) {
      try {
        if (e.data?.type === 'SET_BADGE') (navigator as any).setAppBadge?.(e.data.count ?? 1)
        if (e.data?.type === 'CLEAR_BADGE') (navigator as any).clearAppBadge?.()
        if (e.data?.type === 'NAVIGATE' && e.data.url) window.location.href = e.data.url
      } catch {}
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
  }, [])

  // ── Fonction d'abonnement ──
  async function doSubscribe(): Promise<boolean> {
    try {
      const reg = await navigator.serviceWorker.ready

      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission()
          if (perm !== 'granted') {
            if (perm === 'denied') {
              localStorage.setItem(PUSH_DENIED_KEY, Date.now().toString())
            }
            return false
          }
        }

        const res = await fetch('/api/push/vapid')
        if (!res.ok) return false
        const { publicKey } = await res.json()
        if (!publicKey) return false

        const key = urlBase64ToUint8Array(publicKey)
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        })
      }

      const json = sub.toJSON()
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      })

      return saveRes.ok
    } catch {
      return false
    }
  }

  // ── Clic sur "Activer" ──
  async function handleActivate() {
    setState('loading')
    const ok = await doSubscribe()
    setState(ok ? 'subscribed' : 'prompt')
  }

  // ── "Plus tard" ──
  function dismissPush() {
    localStorage.setItem(PUSH_DISMISS_KEY, Date.now().toString())
    setState('hidden')
  }

  // ── Ne rien afficher si pas en état prompt ou denied ──
  if (state !== 'prompt' && state !== 'denied') return null

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm z-[80]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fffbeb' }}>
            <Bell size={20} style={{ color: '#1a1a2e' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {state === 'denied' ? 'Notifications bloquées' : 'Active les notifications'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
              {state === 'denied'
                ? 'Va dans les réglages de ton navigateur pour les réactiver.'
                : 'Sois prévenu quand ton équipe t\'encourage ou quand ton coach t\'envoie un conseil !'
              }
            </p>
            <div className="flex items-center gap-2 mt-3">
              {state === 'prompt' && (
                <button
                  onClick={handleActivate}
                  className="px-4 py-2 text-xs font-semibold rounded-lg active:scale-95 transition-all hover:opacity-90"
                  style={{ background: '#fbbf24', color: '#1a1a2e' }}
                >
                  Activer
                </button>
              )}
              <button
                onClick={dismissPush}
                className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            onClick={dismissPush}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
