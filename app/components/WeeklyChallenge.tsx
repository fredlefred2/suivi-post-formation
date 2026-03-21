'use client'

import { useState, useEffect } from 'react'
import { Lightbulb, Check, SkipForward, Loader2 } from 'lucide-react'

interface Tip {
  id: string
  content: string
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
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/tips')
      .then(r => r.json())
      .then(data => setTip(data.tip || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading || !tip || dismissed) return null

  const handleAccept = async () => {
    setActing(true)
    await fetch('/api/tips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipId: tip.id, acted: true }),
    })
    onChallengeAccepted?.(tip.content, tip.axe_id)
    setDismissed(true)
  }

  const handleSkip = async () => {
    await fetch('/api/tips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipId: tip.id, acted: true }),
    })
    setDismissed(true)
  }

  const axeName = tip.axe?.subject || 'Ton axe'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm">
      {/* Icône décorative */}
      <div className="absolute -right-2 -top-2 text-6xl opacity-10">💡</div>

      <div className="relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <Lightbulb size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Défi de la semaine
            </p>
            <p className="text-[10px] text-amber-500">{axeName} · Semaine {tip.week_number}</p>
          </div>
        </div>

        {/* Contenu du tip */}
        <p className="text-sm text-gray-800 font-medium leading-relaxed mt-3 mb-4 pl-1">
          "{tip.content}"
        </p>

        {/* Boutons */}
        <div className="flex gap-2">
          <button
            onClick={handleAccept}
            disabled={acting}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            {acting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Check size={14} />
            )}
            Défi relevé !
          </button>
          <button
            onClick={handleSkip}
            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <SkipForward size={14} />
            Passer
          </button>
        </div>
      </div>
    </div>
  )
}
