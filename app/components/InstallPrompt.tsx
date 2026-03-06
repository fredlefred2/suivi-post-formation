'use client'

import { useState, useEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallPrompt() {
  const [showCustomBanner, setShowCustomBanner] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    // Already installed as standalone PWA → do nothing
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // @ts-expect-error – Safari specific
    if (window.navigator.standalone === true) return

    // ── iOS Safari detection ──
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    const isSafari = /Safari/.test(navigator.userAgent) && !/Chrome|CriOS|FxiOS/.test(navigator.userAgent)

    if (isIOS && isSafari) {
      // Show iOS guide if not dismissed in this session
      const dismissed = sessionStorage.getItem('ios_install_dismissed')
      if (!dismissed) {
        setShowIOSGuide(true)
      }
      return
    }

    // ── Android / Chrome: beforeinstallprompt ──
    const nativeDismissed = localStorage.getItem('install_prompt_dismissed')

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent

      // If user previously dismissed the native prompt, show our custom banner
      if (nativeDismissed) {
        setShowCustomBanner(true)
      }
      // Otherwise, let the native banner appear on its own.
      // We listen for appinstalled or userChoice below.
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)

    // If user installs via native prompt → clear flag
    const handleInstalled = () => {
      localStorage.removeItem('install_prompt_dismissed')
      setShowCustomBanner(false)
      deferredPromptRef.current = null
    }
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [])

  // ── Android: trigger deferred native prompt ──
  async function handleInstallClick() {
    const prompt = deferredPromptRef.current
    if (!prompt) return

    await prompt.prompt()
    const choice = await prompt.userChoice

    if (choice.outcome === 'accepted') {
      localStorage.removeItem('install_prompt_dismissed')
      setShowCustomBanner(false)
    } else {
      // Dismissed again — keep the flag, hide banner for this session
      localStorage.setItem('install_prompt_dismissed', 'true')
      setShowCustomBanner(false)
    }
    deferredPromptRef.current = null
  }

  // ── First-time native prompt listener ──
  // We also need to detect when the native prompt (first time) is dismissed
  // so we can set the flag for future sessions
  useEffect(() => {
    const handleFirstNativePrompt = (e: Event) => {
      const evt = e as BeforeInstallPromptEvent
      // Listen for the user choice on the native prompt
      // This runs even if we didn't call prompt() ourselves
      evt.userChoice.then((choice) => {
        if (choice.outcome === 'dismissed') {
          localStorage.setItem('install_prompt_dismissed', 'true')
        }
      })
    }

    window.addEventListener('beforeinstallprompt', handleFirstNativePrompt)
    return () => window.removeEventListener('beforeinstallprompt', handleFirstNativePrompt)
  }, [])

  // ── Dismiss handlers ──
  function dismissCustomBanner() {
    setShowCustomBanner(false)
  }

  function dismissIOSGuide() {
    sessionStorage.setItem('ios_install_dismissed', 'true')
    setShowIOSGuide(false)
  }

  // ── Android custom banner ──
  if (showCustomBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 flex items-center gap-3 animate-fade-in">
          <img src="/icon-192.png" alt="YAPLUKA" className="w-12 h-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">Installer YAPLUKA</p>
            <p className="text-xs text-gray-500 mt-0.5">Accès rapide depuis votre écran d&apos;accueil</p>
          </div>
          <button
            onClick={handleInstallClick}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-500 transition-colors flex-shrink-0"
          >
            Installer
          </button>
          <button onClick={dismissCustomBanner} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
            <X size={18} />
          </button>
        </div>
      </div>
    )
  }

  // ── iOS guide ──
  if (showIOSGuide) {
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
            <button onClick={dismissIOSGuide} className="p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
