'use client'

import { useState } from 'react'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import type { Difficulty } from '@/lib/types'

type Axe = { id: string; subject: string; initial_score: number; difficulty: Difficulty }

const WEATHER_EMOJI_MAP: Record<string, string> = { sunny: '☀️', cloudy: '⛅', stormy: '⛈️' }

const weatherOptions = [
  { value: 'sunny', emoji: '☀️', label: 'Ça roule !', color: 'border-amber-400 bg-amber-100' },
  { value: 'cloudy', emoji: '⛅', label: 'Mitigé', color: 'border-sky-400 bg-sky-100' },
  { value: 'stormy', emoji: '⛈️', label: 'Difficile', color: 'border-red-400 bg-red-100' },
]

export default function CheckinForm({ axes, weekLabel, streak = 0 }: { axes: Axe[]; weekLabel?: string; streak?: number }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedWeather, setSelectedWeather] = useState<string>('')
  const [showCelebration, setShowCelebration] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const formData = new FormData(e.currentTarget)

    // Construire le body JSON pour l'API route (pas de server action = pas de re-render auto)
    const body = {
      weather: formData.get('weather') as string,
      what_worked: formData.get('what_worked') as string || null,
      difficulties: formData.get('difficulties') as string || null,
      axes: axes.map(axe => ({
        id: axe.id,
        score: parseInt(formData.get(`score_${axe.id}`) as string) || axe.initial_score,
      })),
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

      // Afficher la célébration — aucun revalidatePath ne viendra démonter le composant
      setShowCelebration(true)
      setTimeout(() => { window.location.href = '/dashboard' }, 5000)
    } catch {
      setError('Erreur réseau, réessaie.')
      setSubmitting(false)
    }
  }

  if (showCelebration) {
    const newStreak = streak + 1
    return (
      <div className="card text-center py-10 space-y-4 animate-fade-in-up">
        <div className="text-6xl">✅</div>
        <h2 className="text-xl font-bold text-gray-900">Check-in validé !</h2>
        {selectedWeather && (
          <p className="text-4xl">{WEATHER_EMOJI_MAP[selectedWeather] ?? ''}</p>
        )}
        {newStreak >= 2 ? (
          <div className="flex items-center justify-center gap-2">
            <span className="text-2xl">🔥</span>
            <p className="text-lg font-semibold text-orange-600">{newStreak} semaines d&apos;affilée !</p>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Premier check-in de la série, continue ! 💪</p>
        )}
        <p className="text-xs text-gray-400">Redirection dans quelques secondes…</p>
        <a href="/dashboard" className="btn-primary inline-block mt-2">
          Retour au dashboard
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Axes ids (hidden) */}
      {axes.map((axe) => (
        <input key={axe.id} type="hidden" name="axe_ids" value={axe.id} />
      ))}

      {/* Météo */}
      <div className="card">
        <h2 className="section-title mb-1">Comment s&apos;est passée ta semaine ? *</h2>
        <p className="text-sm text-gray-400 mb-4">{weekLabel ? `${weekLabel} — Ta météo générale` : 'Ta météo générale'}</p>
        <div className="grid grid-cols-3 gap-3">
          {weatherOptions.map((opt) => {
            const isSelected = selectedWeather === opt.value
            return (
              <label key={opt.value} className="cursor-pointer">
                <input
                  type="radio"
                  name="weather"
                  value={opt.value}
                  required
                  className="sr-only"
                  onChange={() => setSelectedWeather(opt.value)}
                />
                <div className={`text-center py-4 border-2 rounded-xl transition-all duration-200 ${
                  isSelected
                    ? `${opt.color} scale-105 shadow-md ring-2 ring-offset-1 ${
                        opt.value === 'sunny' ? 'ring-amber-400' : opt.value === 'cloudy' ? 'ring-sky-400' : 'ring-red-400'
                      }`
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                  <span className={`text-3xl transition-transform duration-200 inline-block ${isSelected ? 'scale-110' : ''}`}>{opt.emoji}</span>
                  <p className={`text-sm font-medium mt-2 ${isSelected ? 'text-gray-900' : 'text-gray-500'}`}>{opt.label}</p>
                </div>
              </label>
            )
          })}
        </div>
      </div>

      {/* Ce qui a bien fonctionné */}
      <div className="card">
        <label className="section-title block mb-1">Ce qui a bien fonctionné</label>
        <p className="text-sm text-gray-400 mb-3">Actions réussies, victoires, apprentissages positifs...</p>
        <textarea
          name="what_worked"
          className="input h-28 resize-none"
          placeholder="Ex: J'ai réussi à déléguer la gestion du planning à mon équipe, ça a bien fonctionné..."
        />
      </div>

      {/* Difficultés */}
      <div className="card">
        <label className="section-title block mb-1">Difficultés rencontrées</label>
        <p className="text-sm text-gray-400 mb-3">Obstacles, blocages, points d&apos;amélioration...</p>
        <textarea
          name="difficulties"
          className="input h-28 resize-none"
          placeholder="Ex: J'ai eu du mal à prioriser entre les urgences et les sujets importants..."
        />
      </div>

      {/* Axes (hidden scores — kept for form submission) */}
      {axes.map((axe) => (
        <input key={`score_default_${axe.id}`} type="hidden" name={`score_${axe.id}`} value={axe.initial_score} />
      ))}

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button type="submit" disabled={submitting} className="btn-primary w-full py-3 text-base">
        {submitting ? 'Enregistrement...' : 'Valider mon check-in ✓'}
      </button>
    </form>
  )
}
