'use client'

import { useState, useEffect } from 'react'
import { GraduationCap, Check, Loader2, X } from 'lucide-react'

interface Tip {
  id: string
  content: string
  advice: string | null
  week_number: number
  acted: boolean
  axe_id: string
  axe: { subject: string } | null
}

export default function WeeklyChallenge() {
  const [tip, setTip] = useState<Tip | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const fetchNextTip = () => {
    fetch('/api/tips')
      .then(r => r.json())
      .then(data => setTip(data.tip || null))
      .catch(() => setTip(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchNextTip() }, [])

  const handleAccept = async () => {
    if (!tip) return
    setActing(true)
    await fetch('/api/tips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipId: tip.id, acted: true }),
    })
    setActing(false)
    setModalOpen(false)
    setTip(null)
  }

  if (loading || !tip) return null

  const axeName = tip.axe?.subject || 'Ton axe'

  return (
    <>
      {/* ── Bandeau alerte (style check-in) ── */}
      {!modalOpen && (
        <button
          onClick={() => setModalOpen(true)}
          className="w-full rounded-xl px-4 py-3 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
          style={{ background: 'linear-gradient(135deg, #fef3c7, #fde68a)', border: '1px solid #fbbf24' }}
        >
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
               style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
            🥷
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 text-sm">Ton coach a un conseil pour toi</p>
            <p className="text-xs text-amber-700/80">{axeName} · Semaine {tip.week_number}</p>
          </div>
          <span className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #d97706, #b45309)' }}>
            Voir
          </span>
        </button>
      )}

      {/* ── Modale pop-up ── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40" />

          {/* Contenu */}
          <div
            className="relative w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header gradient */}
            <div className="relative px-5 pt-5 pb-4"
                 style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b, #d97706)' }}>
              {/* Bouton fermer */}
              <button
                onClick={() => setModalOpen(false)}
                className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white/80 hover:bg-white/30 transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-white/20 shadow-lg">
                  🥷
                </div>
                <div>
                  <p className="text-white font-bold text-base">Le conseil de ton coach</p>
                  <p className="text-white/80 text-xs mt-0.5">{axeName} · Semaine {tip.week_number}</p>
                </div>
              </div>
            </div>

            {/* Corps */}
            <div className="bg-white px-5 py-4 space-y-3">
              {/* Rappel */}
              <div className="flex gap-3 items-start">
                <span className="text-2xl shrink-0 mt-0.5">🥷</span>
                <div className="relative bg-amber-50 border border-amber-200/60 rounded-2xl rounded-tl-sm px-3.5 py-3">
                  <p className="text-[13px] font-semibold text-gray-800 leading-relaxed">
                    {tip.content}
                  </p>
                </div>
              </div>

              {/* Conseil */}
              {tip.advice && (
                <div className="rounded-xl p-3.5 bg-indigo-50 border border-indigo-200/60">
                  <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5">
                    🎯 Cette semaine, essaye
                  </p>
                  <p className="text-[13px] text-gray-700 leading-relaxed">
                    {tip.advice}
                  </p>
                </div>
              )}
            </div>

            {/* Bouton */}
            <div className="bg-white px-5 pb-5 pt-1">
              <button
                onClick={handleAccept}
                disabled={acting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white transition-all active:scale-95 shadow-md"
                style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', boxShadow: '0 4px 14px rgba(217,119,6,0.4)' }}
              >
                {acting ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                J'ai compris !
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
