'use client'

import { useState, useEffect } from 'react'
import { BookOpen, Lightbulb, Check, SkipForward, Loader2, ChevronDown } from 'lucide-react'

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
  const [showAdvice, setShowAdvice] = useState(false)

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
    setShowAdvice(false)
    fetchNextTip()
  }

  const handleSkip = async () => {
    setActing(true)
    await fetch('/api/tips', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipId: tip.id, acted: true }),
    })
    setActing(false)
    setShowAdvice(false)
    fetchNextTip()
  }

  const axeName = tip.axe?.subject || 'Ton axe'

  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 shadow-sm">
      {/* Icône décorative */}
      <div className="absolute -right-2 -top-2 text-6xl opacity-10">📚</div>

      <div className="relative p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
            <BookOpen size={16} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
              Rappel de la semaine
            </p>
            <p className="text-[10px] text-amber-500">{axeName} · Semaine {tip.week_number}</p>
          </div>
        </div>

        {/* Rappel (toujours visible) */}
        <div className="bg-white/60 rounded-xl p-3 mb-2">
          <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">📚 Rappel</p>
          <p className="text-sm text-gray-800 font-medium leading-relaxed">
            {tip.content}
          </p>
        </div>

        {/* Conseil (dépliable) */}
        {tip.advice && (
          <>
            <button
              onClick={() => setShowAdvice(!showAdvice)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-indigo-600 hover:bg-indigo-50/50 transition-all"
            >
              <span className="flex items-center gap-1.5">
                <Lightbulb size={13} />
                {showAdvice ? 'Masquer le conseil' : 'Voir le conseil de la semaine'}
              </span>
              <ChevronDown size={14} className={`transition-transform duration-200 ${showAdvice ? 'rotate-180' : ''}`} />
            </button>

            {showAdvice && (
              <div className="bg-indigo-50/50 rounded-xl p-3 mb-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-1">💡 Conseil</p>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {tip.advice}
                </p>
              </div>
            )}
          </>
        )}

        {/* Boutons */}
        <div className="flex gap-2 mt-3">
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
            J'ai compris !
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
