'use client'

import { useState, useTransition } from 'react'
import { submitCheckin } from './actions'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import type { Difficulty } from '@/lib/types'

type Axe = { id: string; subject: string; initial_score: number; difficulty: Difficulty }

const weatherOptions = [
  { value: 'sunny', emoji: '☀️', label: 'Ça roule !', color: 'border-amber-400 bg-amber-100' },
  { value: 'cloudy', emoji: '⛅', label: 'Mitigé', color: 'border-sky-400 bg-sky-100' },
  { value: 'stormy', emoji: '⛈️', label: 'Difficile', color: 'border-red-400 bg-red-100' },
]

const scoreLabels = ['', 'Débutant', 'En cours', 'Intermédiaire', 'Avancé', 'Expert']

export default function CheckinForm({ axes }: { axes: Axe[] }) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [selectedWeather, setSelectedWeather] = useState<string>('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await submitCheckin(formData)
      if (result?.error) setError(result.error)
      else window.location.href = '/dashboard'
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Axes ids (hidden) */}
      {axes.map((axe) => (
        <input key={axe.id} type="hidden" name="axe_ids" value={axe.id} />
      ))}

      {/* Météo */}
      <div className="card">
        <h2 className="section-title mb-1">Comment s&apos;est passée cette semaine ? *</h2>
        <p className="text-sm text-gray-400 mb-4">Votre météo générale</p>
        <div className="grid grid-cols-3 gap-3">
          {weatherOptions.map((opt) => (
            <label key={opt.value} className="cursor-pointer">
              <input
                type="radio"
                name="weather"
                value={opt.value}
                required
                className="sr-only peer"
                onChange={() => setSelectedWeather(opt.value)}
              />
              <div className={`text-center py-4 border-2 rounded-xl transition-all peer-checked:${opt.color} peer-checked:border-opacity-100 border-gray-200 hover:border-gray-300`}>
                <span className="text-3xl">{opt.emoji}</span>
                <p className="text-sm font-medium mt-2 text-gray-700">{opt.label}</p>
              </div>
            </label>
          ))}
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

      <button type="submit" disabled={isPending} className="btn-primary w-full py-3 text-base">
        {isPending ? 'Enregistrement...' : 'Valider mon check-in ✓'}
      </button>
    </form>
  )
}
