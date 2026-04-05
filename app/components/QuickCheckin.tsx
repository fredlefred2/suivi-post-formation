'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

type AxeInfo = { id: string; initial_score: number }

const WEATHER_OPTIONS = [
  { value: 'sunny', emoji: '☀️', label: 'Ça roule !', color: 'border-amber-400 bg-amber-100 ring-amber-400' },
  { value: 'cloudy', emoji: '⛅', label: 'Mitigé', color: 'border-sky-400 bg-sky-100 ring-sky-400' },
  { value: 'stormy', emoji: '⛈️', label: 'Difficile', color: 'border-red-400 bg-red-100 ring-red-400' },
]

const WEATHER_EMOJI_MAP: Record<string, string> = { sunny: '☀️', cloudy: '⛅', stormy: '⛈️' }

type Props = {
  axes: AxeInfo[]
  weekLabel: string
  streak: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function QuickCheckin({ axes, weekLabel, streak, open, onClose, onSuccess }: Props) {
  const [weather, setWeather] = useState<string>('')
  const [whatWorked, setWhatWorked] = useState('')
  const [difficulties, setDifficulties] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setWeather('')
    setWhatWorked('')
    setDifficulties('')
    setSubmitting(false)
    setShowCelebration(false)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!weather) return
    setSubmitting(true)
    setError(null)

    const body = {
      weather,
      what_worked: whatWorked.trim() || null,
      difficulties: difficulties.trim() || null,
      axes: axes.map(a => ({ id: a.id, score: a.initial_score })),
    }

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = '/login'
          return
        }
        const data = await res.json()
        setError(data.error || 'Erreur lors de l\'enregistrement')
        setSubmitting(false)
        return
      }

      setShowCelebration(true)
      setTimeout(() => {
        handleClose()
        onSuccess()
      }, 3500)
    } catch {
      setError('Erreur réseau, réessaie.')
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Célébration */}
      {showCelebration ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-4 p-8 text-center animate-fade-in-up" style={{ border: '2px solid #f0ebe0' }}>
          <div className="text-6xl mb-3">✅</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1a1a2e' }}>Check-in validé !</h2>
          {weather && <p className="text-4xl mb-2">{WEATHER_EMOJI_MAP[weather]}</p>}
          {(streak + 1) >= 2 ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">🔥</span>
              <p className="text-lg font-semibold text-orange-600">{streak + 1} semaines d&apos;affilée !</p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Premier check-in de la série, continue ! 💪</p>
          )}
        </div>
      ) : (
        <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl w-full max-w-md mx-0 sm:mx-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-fade-in-up max-h-[85vh] overflow-y-auto" style={{ border: '2px solid #f0ebe0' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>Check-in hebdomadaire</h3>
            <button onClick={handleClose} className="p-1 text-gray-500 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <p className="text-xs mb-5" style={{ color: '#a0937c' }}>{weekLabel}</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Météo */}
            <div>
              <p className="text-sm font-semibold mb-3" style={{ color: '#1a1a2e' }}>Comment s&apos;est passée ta semaine ? *</p>
              <div className="grid grid-cols-3 gap-3">
                {WEATHER_OPTIONS.map((opt) => {
                  const isSelected = weather === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setWeather(opt.value)}
                      className={`text-center py-4 border-2 rounded-xl transition-all duration-200 ${
                        isSelected
                          ? `${opt.color} scale-105 shadow-md ring-2 ring-offset-1`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`text-3xl inline-block transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
                        {opt.emoji}
                      </span>
                      <p className={`text-sm font-medium mt-2 ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>
                        {opt.label}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ce qui a bien fonctionné */}
            <div>
              <label className="text-sm font-semibold block mb-1" style={{ color: '#1a1a2e' }}>Ce qui a bien fonctionné</label>
              <p className="text-xs mb-2" style={{ color: '#a0937c' }}>Actions réussies, victoires, apprentissages positifs...</p>
              <textarea
                value={whatWorked}
                onChange={(e) => setWhatWorked(e.target.value)}
                className="input w-full h-20 resize-none text-sm"
                placeholder="Ex: J'ai réussi à déléguer la gestion du planning à mon équipe..."
              />
            </div>

            {/* Difficultés */}
            <div>
              <label className="text-sm font-semibold block mb-1" style={{ color: '#1a1a2e' }}>Difficultés rencontrées</label>
              <p className="text-xs mb-2" style={{ color: '#a0937c' }}>Obstacles, blocages, points d&apos;amélioration...</p>
              <textarea
                value={difficulties}
                onChange={(e) => setDifficulties(e.target.value)}
                className="input w-full h-20 resize-none text-sm"
                placeholder="Ex: J'ai eu du mal à prioriser entre les urgences et les sujets importants..."
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !weather}
              className="btn-primary w-full py-3 disabled:opacity-50"
            >
              {submitting ? 'Enregistrement...' : 'Valider mon check-in ✓'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
