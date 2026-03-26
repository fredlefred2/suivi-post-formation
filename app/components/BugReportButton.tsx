'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Bug, X, Send, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useOnboarding } from '@/lib/onboarding-context'

type BugReport = {
  id: string
  user_name: string
  user_role: string
  message: string
  page: string
  read_at: string | null
  created_at: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return "à l'instant"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours}h`
  const days = Math.floor(hours / 24)
  return `il y a ${days}j`
}

export default function BugReportButton() {
  // ── Onboarding check ──
  const { isOnboarding: onboardingActive } = useOnboarding()

  // ── Shared state ──
  const [role, setRole] = useState<'learner' | 'trainer' | null>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  // ── Learner state (formulaire de signalement) ──
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPath, setCurrentPath] = useState('')

  // ── Trainer state (liste des signalements) ──
  const [unreadCount, setUnreadCount] = useState(0)
  const [reports, setReports] = useState<BugReport[]>([])
  const [loadingReports, setLoadingReports] = useState(false)

  // ── Montage (nécessaire pour createPortal) ──
  useEffect(() => {
    setMounted(true)
  }, [])

  // ── Initialisation : détecter rôle + unread count ──
  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setRole(null)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'trainer') {
        setRole('trainer')
        const { count } = await supabase
          .from('bug_reports')
          .select('*', { count: 'exact', head: true })
          .is('read_at', null)
        setUnreadCount(count ?? 0)
      } else if (profile?.role === 'learner') {
        setRole('learner')
      }
    }

    init()
  }, [])

  // ── Learner : capturer la page courante ──
  useEffect(() => {
    if (open && role === 'learner') {
      setCurrentPath(window.location.pathname)
    }
  }, [open, role])

  // ── Learner : soumettre un signalement ──
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
          page: window.location.pathname,
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

  // ── Trainer : ouvrir le panneau et charger les signalements ──
  const openTrainerPanel = useCallback(async () => {
    setOpen(true)
    setLoadingReports(true)

    const supabase = createClient()

    const { data } = await supabase
      .from('bug_reports')
      .select('id, user_name, user_role, message, page, read_at, created_at')
      .order('created_at', { ascending: false })

    setReports(data ?? [])
    setLoadingReports(false)

    if (data?.some(r => r.read_at === null)) {
      await supabase
        .from('bug_reports')
        .update({ read_at: new Date().toISOString() })
        .is('read_at', null)

      setUnreadCount(0)
    }
  }, [])

  // ── Ne rien rendre si pas monté ou pas authentifié ──
  if (!mounted || role === null || onboardingActive) return null

  function handleClose() {
    setOpen(false)
    setSent(false)
    setError(null)
  }

  // ── Rendu via Portal (directement dans document.body) ──
  // Garantit que position:fixed fonctionne toujours,
  // indépendamment des conteneurs CSS parents.
  return createPortal(
    <>
      {/* ── Bouton flottant 🐛 ── */}
      <button
        onClick={() => role === 'trainer' ? openTrainerPanel() : setOpen(true)}
        style={{
          position: 'fixed',
          top: '50%',
          right: '-12px',
          transform: 'translateY(-50%)',
          zIndex: 95,
        }}
        className="group w-10 h-10 rounded-full
                   bg-gray-800/50 hover:bg-gray-800 backdrop-blur-sm
                   text-white/50 hover:text-white
                   flex items-center justify-center
                   shadow-lg transition-all duration-200
                   active:scale-90 hover:translate-x-[-12px]"
        aria-label={role === 'trainer' ? 'Voir les signalements' : 'Signaler un bug'}
      >
        <Bug size={18} />
        {/* Pastille rouge (formateur uniquement) */}
        {role === 'trainer' && unreadCount > 0 && (
          <span
            style={{ position: 'absolute', top: '-4px', right: '-4px' }}
            className="min-w-[18px] h-[18px]
                       bg-red-500 text-white text-[10px] font-bold
                       rounded-full flex items-center justify-center
                       px-1 ring-2 ring-white/20 animate-pulse"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ── Modal ── */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100 }}
          className="flex items-end sm:items-center justify-center px-4 pb-4"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />

          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden animate-fade-in">

            {/* ═══════════════════════════════════════════ */}
            {/* FORMATEUR : Liste des signalements          */}
            {/* ═══════════════════════════════════════════ */}
            {role === 'trainer' ? (
              <>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Bug size={18} className="text-red-500" />
                    <h3 className="font-semibold text-gray-900 text-sm">
                      Signalements ({reports.length})
                    </h3>
                  </div>
                  <button onClick={handleClose} className="p-1 text-gray-500 hover:text-gray-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
                  {loadingReports ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Chargement...</div>
                  ) : reports.length === 0 ? (
                    <div className="p-8 text-center">
                      <Bug size={32} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Aucun signalement</p>
                      <p className="text-xs text-gray-300 mt-1">Tout va bien ! 🎉</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {reports.map((report) => (
                        <div
                          key={report.id}
                          className={`px-5 py-3.5 ${
                            report.read_at === null
                              ? 'bg-indigo-50/50 border-l-4 border-indigo-400'
                              : 'border-l-4 border-transparent'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-sm ${
                              report.read_at === null
                                ? 'font-semibold text-gray-900'
                                : 'font-medium text-gray-600'
                            }`}>
                              {report.user_name}
                            </span>
                            <span className="text-xs text-gray-500">{timeAgo(report.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
                              {report.user_role}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">{report.page}</span>
                          </div>
                          <p className={`text-sm leading-relaxed ${
                            report.read_at === null ? 'text-gray-700' : 'text-gray-500'
                          }`}>
                            {report.message}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ═══════════════════════════════════════════ */
              /* APPRENANT : Formulaire de signalement       */
              /* ═══════════════════════════════════════════ */
              <>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <Bug size={18} className="text-red-500" />
                    <h3 className="font-semibold text-gray-900 text-sm">Signaler un problème</h3>
                  </div>
                  <button onClick={handleClose} className="p-1 text-gray-500 hover:text-gray-600 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                {sent ? (
                  <div className="p-8 text-center">
                    <CheckCircle size={40} className="text-emerald-500 mx-auto mb-3" />
                    <p className="font-semibold text-gray-900">Merci pour le signalement !</p>
                    <p className="text-sm text-gray-500 mt-1">On s&apos;en occupe au plus vite.</p>
                  </div>
                ) : (
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
                        className="w-full rounded-xl px-4 py-2.5 text-sm bg-white border border-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 transition-all resize-none"
                        style={{ fontSize: '16px' }}
                        required
                        autoFocus
                      />
                    </div>

                    <p className="text-xs text-gray-500">
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
              </>
            )}
          </div>
        </div>
      )}
    </>,
    document.body
  )
}
