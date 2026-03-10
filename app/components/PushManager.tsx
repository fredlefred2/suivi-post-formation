'use client'

import { useEffect, useState, useCallback } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

// Convertit une clé VAPID base64url en Uint8Array pour l'API Push
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const array = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i)
  return array
}

export default function PushManager() {
  const [showPrompt, setShowPrompt] = useState(false)

  // Enregistre la subscription côté serveur
  const registerSubscription = useCallback(async (sub: PushSubscription) => {
    try {
      await fetch('/api/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      })
    } catch {
      // Silencieux
    }
  }, [])

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    // Si déjà granted → s'assurer que la subscription est enregistrée
    if (Notification.permission === 'granted') {
      navigator.serviceWorker.ready.then(async (registration) => {
        let sub = await registration.pushManager.getSubscription()
        if (!sub) {
          sub = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          })
        }
        registerSubscription(sub)
      }).catch(() => {})
      return
    }

    // Si pas encore demandé → afficher le bandeau après 5s (sauf si refusé < 1 jour)
    if (Notification.permission === 'default') {
      const dismissed = localStorage.getItem('push_dismissed_at')
      if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) return
      const timer = setTimeout(() => setShowPrompt(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [registerSubscription])

  const handleAccept = async () => {
    setShowPrompt(false)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
      })
      await registerSubscription(sub)
    } catch {
      // Silencieux
    }
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem('push_dismissed_at', Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed top-16 inset-x-0 z-50 flex justify-center px-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-4 flex items-center gap-3 max-w-sm w-full">
        <span className="text-2xl shrink-0">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800">Recevoir les notifications ?</p>
          <p className="text-xs text-gray-500 mt-0.5">Soyez alerté des likes et commentaires</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={handleDismiss}
            className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1"
          >
            Non
          </button>
          <button
            onClick={handleAccept}
            className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
          >
            Oui
          </button>
        </div>
      </div>
    </div>
  )
}
