'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install_dismissed_at'
const REPROPOSE_DELAY = 1 * 24 * 60 * 60 * 1000 // 1 jour

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
  const [bannerType, setBannerType] = useState<'native' | 'guide-android' | 'guide-ios' | 'guide-ios-chrome' | null>(null)
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

    // ── iOS : Safari ou autre navigateur ──
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    if (isIOS) {
      if (isIOSSafari()) {
        setBannerType('guide-ios')
      } else {
        // Chrome iOS, Firefox iOS, etc. → dire d'ouvrir dans Safari
        setBannerType('guide-ios-chrome')
      }
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
      <div className="fixed top-0 left-0 right-0 z-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
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
      <div className="fixed top-0 left-0 right-0 z-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 flex items-center gap-3 animate-fade-in">
          <img src="/icon-192.png" alt="YAPLUKA" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Installer YAPLUKA</p>
            <p className="text-xs text-gray-500 mt-0.5">Accès rapide depuis votre écran d&apos;accueil</p>
          </div>
          <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
      </div>
    )
  }

  // ── Guide iOS Safari ──
  if (bannerType === 'guide-ios') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <img src="/icon-192.png" alt="YAPLUKA" className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-2">Installer YAPLUKA</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-xs text-gray-600">
                    Appuyez sur{' '}
                    <span className="inline-flex items-center align-middle mx-0.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
                        <path d="M12 5v14M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3" y="19" width="18" height="2" rx="1" fill="currentColor" stroke="none" />
                      </svg>
                    </span>{' '}
                    <span className="font-semibold text-gray-800">Partager</span> en bas de l&apos;écran
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-xs text-gray-600">
                    Faites défiler et choisissez <span className="font-semibold text-gray-800">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-xs text-gray-600">
                    Confirmez avec <span className="font-semibold text-gray-800">&quot;Ajouter&quot;</span>
                  </p>
                </div>
              </div>
            </div>
            <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Guide iOS Chrome (doit ouvrir dans Safari) ──
  if (bannerType === 'guide-ios-chrome') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <img src="/icon-192.png" alt="YAPLUKA" className="w-12 h-12 rounded-xl flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-2">Installer YAPLUKA</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-xs text-gray-600">
                    Ouvrez cette page dans <span className="font-semibold text-gray-800">Safari</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-xs text-gray-600">
                    Appuyez sur{' '}
                    <span className="inline-flex items-center align-middle mx-0.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
                        <path d="M12 5v14M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3" y="19" width="18" height="2" rx="1" fill="currentColor" stroke="none" />
                      </svg>
                    </span>{' '}
                    <span className="font-semibold text-gray-800">Partager</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-xs text-gray-600">
                    Choisissez <span className="font-semibold text-gray-800">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
                  </p>
                </div>
              </div>
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
