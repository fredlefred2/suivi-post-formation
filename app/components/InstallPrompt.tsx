'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, X } from 'lucide-react'
import { useOnboarding } from '@/lib/onboarding-context'
import { usePathname } from 'next/navigation'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'install_dismissed_at'
const SESSION_DISMISS_KEY = 'install_dismissed_session'
const REPROPOSE_DELAY = 1 * 24 * 60 * 60 * 1000 // 1 jour

/** Vérifie si l'app tourne en mode standalone (installée) */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  // @ts-expect-error – Safari specific
  if (window.navigator.standalone === true) return true
  return false
}

/** Vérifie si le dismiss est encore actif */
function isDismissed() {
  if (sessionStorage.getItem(SESSION_DISMISS_KEY)) return true
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

/** Clé globale pour coordonner avec PushRegistration */
export const INSTALL_VISIBLE_KEY = 'install_prompt_visible'

export default function InstallPrompt() {
  const pathname = usePathname()
  const isLearnerRoute = pathname?.startsWith('/dashboard') || pathname?.startsWith('/axes') || pathname?.startsWith('/messages') || pathname?.startsWith('/team')
  const { isOnboarding } = useOnboarding()
  const [bannerType, setBannerType] = useState<'native' | 'guide-android' | 'guide-ios' | 'guide-ios-chrome' | null>(null)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Signal global : InstallPrompt est-il visible ?
  useEffect(() => {
    if (bannerType) {
      sessionStorage.setItem(INSTALL_VISIBLE_KEY, '1')
    } else {
      sessionStorage.removeItem(INSTALL_VISIBLE_KEY)
    }
  }, [bannerType])

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

  // ── Dismiss : stocker le timestamp + flag session ──
  function dismiss() {
    localStorage.setItem(DISMISS_KEY, Date.now().toString())
    sessionStorage.setItem(SESSION_DISMISS_KEY, '1')
    setBannerType(null)
  }

  // ── Rien à afficher si : pas de banner, onboarding en cours ──
  if (!bannerType || (isLearnerRoute && isOnboarding)) return null

  const motivationalMessage = "Ne manque rien : rappels, encouragements de ton équipe et conseils de ton coach, directement sur ton téléphone !"

  // ── Bandeau natif Android (beforeinstallprompt capté) ──
  if (bannerType === 'native') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[80] p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Download size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Installe YAPLUKA</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{motivationalMessage}</p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleNativeInstall}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 active:scale-95 transition-all"
                >
                  Installer
                </button>
                <button
                  onClick={dismiss}
                  className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Guide Android (prompt natif bloqué par Chrome) ──
  if (bannerType === 'guide-android') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[80] p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Download size={22} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">Installe YAPLUKA</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{motivationalMessage}</p>
              <p className="text-xs text-gray-500 mt-2">
                Ouvre le menu <span className="font-semibold text-gray-800">&#8942;</span> de ton navigateur et choisis <span className="font-semibold text-gray-800">&quot;Installer l&apos;application&quot;</span>
              </p>
              <div className="mt-3">
                <button
                  onClick={dismiss}
                  className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Guide iOS Safari ──
  if (bannerType === 'guide-ios') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[80] p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Download size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-1">Installe YAPLUKA</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-2">{motivationalMessage}</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-xs text-gray-600">
                    Appuie sur{' '}
                    <span className="inline-flex items-center align-middle mx-0.5">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-indigo-600">
                        <path d="M12 5v14M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                        <rect x="3" y="19" width="18" height="2" rx="1" fill="currentColor" stroke="none" />
                      </svg>
                    </span>{' '}
                    <span className="font-semibold text-gray-800">Partager</span> en bas
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-xs text-gray-600">
                    Choisis <span className="font-semibold text-gray-800">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                  <p className="text-xs text-gray-600">
                    Confirme avec <span className="font-semibold text-gray-800">&quot;Ajouter&quot;</span>
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={dismiss}
                  className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Guide iOS Chrome (doit ouvrir dans Safari) ──
  if (bannerType === 'guide-ios-chrome') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[80] p-4 pt-[calc(1rem+env(safe-area-inset-top))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <Download size={22} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-1">Installe YAPLUKA</p>
              <p className="text-xs text-gray-500 leading-relaxed mb-2">{motivationalMessage}</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                  <p className="text-xs text-gray-600">
                    Ouvre cette page dans <span className="font-semibold text-gray-800">Safari</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                  <p className="text-xs text-gray-600">
                    Appuie sur{' '}
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
                    Choisis <span className="font-semibold text-gray-800">&quot;Sur l&apos;écran d&apos;accueil&quot;</span>
                  </p>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={dismiss}
                  className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Plus tard
                </button>
              </div>
            </div>
            <button onClick={dismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
