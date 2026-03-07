'use client'

import { useState, useEffect } from 'react'
import { Bug, X, Send, CheckCircle } from 'lucide-react'

export default function BugReportButton() {
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState('')

  useEffect(() => {
    setCurrentPath(window.location.pathname)
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim()) return

    setSending(true)
    setError(null)

    try {
      const res = await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          page: currentPath,
          userAgent: navigator.userAgent,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erreur lors de l\'envoi')
      }

      setSent(true)
      setMessage('')
      setTimeout(() => {
        setOpen(false)
        setSent(false)
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      {/* ── Bouton flottant 🐛 ── */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40
                   w-10 h-10 rounded-full
                   bg-gray-800/60 hover:bg-gray-800/90 backdrop-blur-sm
                   text-white/70 hover:text-white
                   flex items-center justify-center
                   shadow-lg transition-all duration-200
                   active:scale-90"
        aria-label="Signaler un bug"
      >
        <Bug size={18} />
      </button>

      {/* ── Modal de signalement ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => { setOpen(false); setSent(false); setError(null) }}
          />

          {/* Formulaire */}
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Bug size={18} className="text-red-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Signaler un problème</h3>
              </div>
              <button
                onClick={() => { setOpen(false); setSent(false); setError(null) }}
                className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {sent ? (
              /* ── Message de confirmation ── */
              <div className="p-8 text-center">
                <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
                <p className="font-semibold text-gray-900">Merci pour le signalement !</p>
                <p className="text-sm text-gray-500 mt-1">On s&apos;en occupe au plus vite.</p>
              </div>
            ) : (
              /* ── Formulaire ── */
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label htmlFor="bug-message" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Que s&apos;est-il passé ?
                  </label>
                  <textarea
                    id="bug-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Décrivez le problème rencontré..."
                    rows={4}
                    className="w-full rounded-xl px-4 py-2.5 text-sm bg-white border border-gray-200 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 transition-all resize-none"
                    style={{ fontSize: '16px' }}
                    required
                    autoFocus
                  />
                </div>

                <p className="text-xs text-gray-400">
                  📍 Page : <span className="font-mono">{currentPath}</span>
                </p>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2 border border-red-200">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={sending || !message.trim()}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5
                             bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400
                             text-white text-sm font-semibold rounded-xl
                             shadow-lg shadow-red-500/25
                             transition-all duration-200
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? (
                    'Envoi...'
                  ) : (
                    <>
                      <Send size={16} />
                      Envoyer le signalement
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
