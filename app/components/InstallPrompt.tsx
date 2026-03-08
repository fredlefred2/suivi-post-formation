'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install_dismissed_at'
const REPROPOSE_DELAY = 0 // TODO: remettre 4 * 24 * 60 * 60 * 1000 après tests

/** Vérifie si l'app tourne en mode standalone (installée) */
function isStandalone() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // @ts-expect-error – Safari specific
  if (window.navigator.standalone === true) return true
  return false
}

/** Vérifie si le dismiss est encore actif (< 4 jours) */
function isDismissed() {
  const ts = localStorage.getItem(DISMISS_KEY)
  if (!ts) return false
  const elapsed = Date.now() - parseInt(ts, 10)
  return elapsed < REPROPOSE_DELAY
}

/** Détecte iOS Safari */
function isIOSSafari() {
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !('MSStream' in window)
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua)
  return isIOS && isSafari
}

export default function InstallPrompt() {
  const [bannerType, setBannerType] = useState<'native' | 'guide-android' | 'guide-ios' | null>(null)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // ── Enregistrer le Service Worker ──
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // ── Déjà installé → rien ──
    if (isStandalone()) return

    // ── Dismiss encore actif → rien ──
    if (isDismissed()) return

    // ── iOS Safari → guide iOS ──
    if (isIOSSafari()) {
      setBannerType('guide-ios')
      return
    }

    // ── Android / Chrome : écouter beforeinstallprompt ──
    let promptReceived = false

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      promptReceived = true
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      setBannerType('native')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // Si le prompt natif n'arrive pas après 3s → afficher le guide Android
    timerRef.current = setTimeout(() => {
      if (!promptReceived && !isStandalone()) {
        setBannerType('guide-android')
      }
    }, 3000)

    // Écouter l'installation réussie
    const handleInstalled = () => {
      setBannerType(null)
      deferredPromptRef.current = null
      localStorage.removeItem(DISMISS_KEY)
    }
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // ── Clic sur "Installer" (prompt natif) ──
  async function handleNativeInstall() {
    const prompt = deferredPromptRef.current
    if (!prompt) return

    await prompt.prompt()
    const choice = await prompt.userChoice

    if (choice.outcome === 'accepted') {
      localStorage.removeItem(DISMISS_KEY)
      setBannerType(null)
    } else {
      dismiss()
    }
    deferredPromptRef.current = null
  }

  // ── Dismiss : stocker le timestamp ──
  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    setBannerType(null)
  }

  // ── Rien à afficher ──
  if (!bannerType) return null

  // ── Bandeau natif Android (beforeinstallprompt capté) ──
  if (bannerType === 'native') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 flex items-center gap-3 animate-fade-in">
          <img src="/icon-192.png" alt="YAPLUKA" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Installer YAPLUKA</p>
            <p className="text-xs text-gray-500 mt-0.5">Accès rapide depuis votre écran d&apos;accueil</p>
          </div>
          <button
            onClick={handleNativeInstall}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors flex-shrink-0"
          >
            Installer
          </button>
          <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
      </div>
    )
  }

  // ── Guide Android (prompt natif bloqué par Chrome) ──
  if (bannerType === 'guide-android') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <img src="/icon-192.png" alt="YAPLUKA" className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Installer YAPLUKA</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Appuyez sur{' '}
                <span className="inline-flex items-center align-middle">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600 inline">
                    <circle cx="12" cy="5" r="1" fill="currentColor" />
                    <circle cx="12" cy="12" r="1" fill="currentColor" />
                    <circle cx="12" cy="19" r="1" fill="currentColor" />
                  </svg>
                </span>{' '}
                <span className="font-medium text-gray-700">Menu</span> puis{' '}
                <span className="font-medium text-gray-700">&quot;Installer l&apos;application&quot;</span>
              </p>
            </div>
            <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Guide iOS Safari ──
  if (bannerType === 'guide-ios') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <img src="/icon-192.png" alt="YAPLUKA" className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Installer YAPLUKA</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Appuyez sur{' '}
                <span className="inline-flex items-center align-middle">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600 inline">
                    <path d="M4 12h16M12 4v16M8 8l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>{' '}
                <span className="font-medium text-gray-700">Partager</span> puis{' '}
                <span className="font-medium text-gray-700">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
              </p>
            </div>
            <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
