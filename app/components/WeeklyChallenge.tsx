'use client'

import { useState, useEffect } from 'react'
import { Check, Loader2 } from 'lucide-react'

interface Tip {
  id: string
  content: string
  advice: string | null
  week_number: number
  acted: boolean
  axe_id: string
  axe: { subject: string } | null
}

interface WeeklyChallengeProps {
  onChallengeAccepted?: (tipContent: string, axeId: string) => void
}

export default function WeeklyChallenge({ onChallengeAccepted }: WeeklyChallengeProps) {
  const [tip, setTip] = useState<Tip | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)

  const fetchNextTip = () => {
    fetch('/api/tips')
      .then(r => r.json())
      .then(data => setTip(data.tip || null))
      .catch(() => setTip(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchNextTip() }, [])

  if (loading || !tip) return null

  const handleAccept = async () => {
    setActing(true)
    await fetch('/api/tips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipId: tip.id, acted: true }),
    })
    const adviceText = tip.advice ? `${tip.content} — ${tip.advice}` : tip.content
    onChallengeAccepted?.(adviceText, tip.axe_id)
    setActing(false)
    fetchNextTip()
  }

  const axeName = tip.axe?.subject || 'Ton axe'

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm"
         style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 30%, #fcd34d 100%)' }}>

      {/* Header avec avatar coach */}
      <div className="px-4 pt-4 pb-2 flex items-start gap-3">
        {/* Avatar coach */}
        <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-2xl"
             style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 2px 8px rgba(245,158,11,0.4)' }}>
          🧑‍🏫
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-900">
            Le conseil de ton coach
          </p>
          <p className="text-[11px] text-amber-700/70 mt-0.5">{axeName} · Semaine {tip.week_number}</p>
        </div>
      </div>

      {/* Bulle rappel */}
      <div className="mx-4 mt-2">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl p-3 shadow-sm border border-amber-200/50">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-1.5">
            💡 Le savais-tu ?
          </p>
          <p className="text-[13px] text-gray-800 leading-relaxed">
            {tip.content}
          </p>
        </div>
      </div>

      {/* Bulle conseil */}
      {tip.advice && (
        <div className="mx-4 mt-2">
          <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-indigo-200/50">
            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1.5">
              🎯 Cette semaine, essaye
            </p>
            <p className="text-[13px] text-gray-700 leading-relaxed">
              {tip.advice}
            </p>
          </div>
        </div>
      )}

      {/* Bouton */}
      <div className="px-4 pt-3 pb-4">
        <button
          onClick={handleAccept}
          disabled={acting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95 shadow-md"
          style={{ background: 'linear-gradient(135deg, #d97706, #b45309)', boxShadow: '0 4px 12px rgba(217,119,6,0.4)' }}
        >
          {acting ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <Check size={15} />
          )}
          J'ai compris !
        </button>
      </div>
    </div>
  )
}
