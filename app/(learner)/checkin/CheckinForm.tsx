'use client'

import { useState, useTransition } from 'react'
import { submitCheckin } from './actions'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import type { Difficulty } from '@/lib/types'

type Axe = { id: string; subject: string; initial_score: number; difficulty: Difficulty }

const weatherOptions = [
  { value: 'sunny', emoji: '☀️', label: 'Ça roule !', color: 'border-yellow-400 bg-yellow-50' },
  { value: 'cloudy', emoji: '⛅', label: 'Mitigé', color: 'border-blue-400 bg-blue-50' },
  { value: 'stormy', emoji: '⛈️', label: 'Difficile', color: 'border-gray-400 bg-gray-50' },
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

      {/* Scores des axes */}
      <div className="card">
        <h2 className="section-title mb-1">Autopositionnement de la semaine *</h2>
        <p className="text-sm text-gray-400 mb-4">Où en êtes-vous sur chacun de vos axes ?</p>
        <div className="space-y-6">
          {axes.map((axe) => (
            <div key={axe.id}>
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-gray-800">{axe.subject}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${DIFFICULTY_COLORS[axe.difficulty]}`}>
                  {DIFFICULTY_LABELS[axe.difficulty]}
                </span>
              </div>
              <p className="text-xs text-gray-400 mb-3">Score initial : {axe.initial_score}/5</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((v) => (
                  <label key={v} className="flex-1 cursor-pointer">
                    <input
                      type="radio"
                      name={`score_${axe.id}`}
                      value={v}
                      required
                      className="sr-only peer"
                    />
                    <div className="text-center py-2.5 border-2 border-gray-200 rounded-lg peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 font-semibold text-sm transition-all hover:border-gray-300">
                      {v}
                    </div>
                    <p className="text-xs text-center text-gray-400 mt-1 hidden sm:block">{scoreLabels[v]}</p>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

      <button type="submit" disabled={isPending} className="btn-primary w-full py-3 text-base">
        {isPending ? 'Enregistrement...' : 'Valider mon check-in ✓'}
      </button>
    </form>
  )
}
