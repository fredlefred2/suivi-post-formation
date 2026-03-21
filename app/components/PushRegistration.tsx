'use client'

import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'

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

type PushState = 'loading' | 'unsupported' | 'denied' | 'prompt' | 'subscribed'

export default function PushRegistration() {
  const [state, setState] = useState<PushState>('loading')
  const [debug, setDebug] = useState('')

  // ── Déterminer l'état initial ──
  useEffect(() => {
    async function checkState() {
      // Support navigateur
      if (!('PushManager' in window) || !('serviceWorker' in navigator) || !('Notification' in window)) {
        setState('unsupported')
        return
      }

      // Permission déjà refusée
      if (Notification.permission === 'denied') {
        setState('denied')
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
    // Force update du SW à chaque chargement
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
      setDebug('SW prêt')

      // Récupérer ou créer la souscription
      let sub = await reg.pushManager.getSubscription()

      if (!sub) {
        // Demander la permission si pas encore fait
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission()
          setDebug('Permission: ' + perm)
          if (perm !== 'granted') return false
        }

        // Récupérer la clé VAPID
        const res = await fetch('/api/push/vapid')
        if (!res.ok) { setDebug('Erreur VAPID ' + res.status); return false }
        const { publicKey } = await res.json()
        if (!publicKey) { setDebug('Clé VAPID vide'); return false }

        setDebug('Création abo push...')
        const key = urlBase64ToUint8Array(publicKey)
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: key.buffer as ArrayBuffer,
        })
      }

      // Envoyer au backend
      const json = sub.toJSON()
      setDebug('Envoi au serveur...')
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
        }),
      })

      if (!saveRes.ok) {
        const err = await saveRes.text()
        setDebug('Erreur save: ' + err)
        return false
      }

      setDebug('✅ OK')
      return true
    } catch (err: any) {
      setDebug('Erreur: ' + (err?.message || String(err)))
      return false
    }
  }

  // ── Clic sur "Activer" ──
  async function handleActivate() {
    setState('loading')
    setDebug('Démarrage...')
    const ok = await doSubscribe()
    setState(ok ? 'subscribed' : 'prompt')
  }

  // ── Ne rien afficher si déjà abonné, non supporté, ou en chargement ──
  if (state !== 'prompt' && state !== 'denied') return null

  return (
    <div className="fixed bottom-20 left-4 right-4 sm:bottom-6 sm:left-auto sm:right-6 sm:max-w-sm z-[80]">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <Bell size={20} className="text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              {state === 'denied' ? 'Notifications bloquées' : 'Activer les notifications'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {state === 'denied'
                ? 'Va dans les réglages de ton navigateur pour les réactiver.'
                : 'Sois alerté quand ton équipe agit ou quand ton formateur t\'écrit.'
              }
            </p>
            {state === 'prompt' && (
              <button
                onClick={handleActivate}
                className="mt-3 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 active:scale-95 transition-all"
              >
                🔔 Activer
              </button>
            )}
            {debug && (
              <p className="text-[10px] text-orange-600 mt-2 font-mono break-all">{debug}</p>
            )}
          </div>
          <button
            onClick={() => setState('subscribed')}
            className="text-gray-500 hover:text-gray-600 p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
