'use client'

import { useState } from 'react'
import { X, ChevronLeft } from 'lucide-react'

type AxeInfo = { id: string; initial_score: number }

type Tag = { key: string; emoji: string; label: string }

const GOOD_TAGS: Tag[] = [
  { key: 'resultat', emoji: '🎯', label: 'Un meilleur résultat' },
  { key: 'echange', emoji: '💬', label: 'Un échange plus fluide' },
  { key: 'conscience', emoji: '💡', label: 'Une prise de conscience' },
  { key: 'reaction', emoji: '👀', label: 'Une réaction positive' },
]

const DIFF_TAGS: Tag[] = [
  { key: 'pas_changement', emoji: '🚧', label: 'Pas encore de résultat' },
  { key: 'inconfort', emoji: '😬', label: 'Sorti de ma zone de confort' },
  { key: 'pas_occasion', emoji: '⏸️', label: 'Pas eu l\'occasion' },
  { key: 'habitudes', emoji: '🔁', label: 'Retombé(e) dans mes habitudes' },
  { key: 'ras', emoji: '🤷', label: 'Rien de particulier' },
]

const WEATHER_OPTIONS = [
  { value: 'sunny', emoji: '☀️', label: 'Ça roule !', color: 'border-amber-400 bg-amber-100 ring-amber-400' },
  { value: 'cloudy', emoji: '⛅', label: 'Mitigé', color: 'border-sky-400 bg-sky-100 ring-sky-400' },
  { value: 'stormy', emoji: '⛈️', label: 'Difficile', color: 'border-red-400 bg-red-100 ring-red-400' },
]

type Props = {
  axes: AxeInfo[]
  weekLabel: string
  streak: number
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export default function QuickCheckin({ axes, weekLabel, streak, open, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<'weather' | 'good' | 'difficult'>('weather')
  const [weather, setWeather] = useState<string | null>(null)
  const [goodTags, setGoodTags] = useState<Set<string>>(new Set())
  const [goodComment, setGoodComment] = useState('')
  const [showGoodComment, setShowGoodComment] = useState(false)
  const [diffTags, setDiffTags] = useState<Set<string>>(new Set())
  const [diffComment, setDiffComment] = useState('')
  const [showDiffComment, setShowDiffComment] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setStep('weather')
    setWeather(null)
    setGoodTags(new Set())
    setGoodComment('')
    setShowGoodComment(false)
    setDiffTags(new Set())
    setDiffComment('')
    setShowDiffComment(false)
    setSubmitting(false)
    setShowCelebration(false)
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function toggleTag(set: Set<string>, setFn: (s: Set<string>) => void, key: string) {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setFn(next)
  }

  function buildText(tags: Set<string>, tagList: Tag[], comment: string): string | null {
    const parts: string[] = []
    tagList.forEach(t => {
      if (tags.has(t.key)) parts.push(`${t.emoji} ${t.label}`)
    })
    if (comment.trim()) parts.push(comment.trim())
    return parts.length > 0 ? parts.join(' | ') : null
  }

  async function handleSubmit() {
    if (!weather) return
    setSubmitting(true)
    setError(null)

    const body = {
      weather,
      what_worked: buildText(goodTags, GOOD_TAGS, goodComment),
      difficulties: buildText(diffTags, DIFF_TAGS, diffComment),
      axes: axes.map(a => ({ id: a.id, score: a.initial_score })),
    }

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
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

  const WEATHER_EMOJI_MAP: Record<string, string> = { sunny: '☀️', cloudy: '⛅', stormy: '⛈️' }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* Célébration */}
      {showCelebration ? (
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xs mx-4 p-8 text-center animate-fade-in-up">
          <div className="text-6xl mb-3">✅</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check-in validé !</h2>
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
        <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md mx-0 sm:mx-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-fade-in-up max-h-[85vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              {step !== 'weather' && (
                <button
                  onClick={() => setStep(step === 'difficult' ? 'good' : 'weather')}
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <ChevronLeft size={20} />
                </button>
              )}
              <h3 className="font-bold text-gray-900 text-lg">
                {step === 'weather' && 'Ta météo de la semaine'}
                {step === 'good' && 'Cette semaine, j\'ai observé...'}
                {step === 'difficult' && 'J\'ai eu du mal avec...'}
              </h3>
            </div>
            <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-5">{weekLabel}</p>

          {/* Indicateur d'étapes */}
          <div className="flex gap-1.5 mb-5">
            {['weather', 'good', 'difficult'].map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i <= ['weather', 'good', 'difficult'].indexOf(step)
                    ? 'bg-indigo-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Étape 1 : Météo */}
          {step === 'weather' && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                {WEATHER_OPTIONS.map((opt) => {
                  const isSelected = weather === opt.value
                  return (
                    <button
                      key={opt.value}
                      onClick={() => {
                        setWeather(opt.value)
                        // Auto-avance après 400ms
                        setTimeout(() => setStep('good'), 400)
                      }}
                      className={`text-center py-5 border-2 rounded-xl transition-all duration-200 ${
                        isSelected
                          ? `${opt.color} scale-105 shadow-md ring-2 ring-offset-1`
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <span className={`text-4xl inline-block transition-transform duration-200 ${isSelected ? 'scale-110' : ''}`}>
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
          )}

          {/* Étape 2 : Réussites */}
          {step === 'good' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {GOOD_TAGS.map((tag) => {
                  const isSelected = goodTags.has(tag.key)
                  return (
                    <button
                      key={tag.key}
                      onClick={() => toggleTag(goodTags, setGoodTags, tag.key)}
                      className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                        isSelected
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {tag.emoji} {tag.label}
                    </button>
                  )
                })}
                <button
                  onClick={() => setShowGoodComment(!showGoodComment)}
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                    showGoodComment
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  ✏️ Autre
                </button>
              </div>

              {showGoodComment && (
                <textarea
                  value={goodComment}
                  onChange={(e) => setGoodComment(e.target.value)}
                  className="input w-full h-20 resize-none"
                  placeholder="Précise si tu veux..."
                  autoFocus
                />
              )}

              <button
                onClick={() => setStep('difficult')}
                className="btn-primary w-full py-3"
              >
                Suivant →
              </button>
            </div>
          )}

          {/* Étape 3 : Difficultés */}
          {step === 'difficult' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {DIFF_TAGS.map((tag) => {
                  const isSelected = diffTags.has(tag.key)
                  return (
                    <button
                      key={tag.key}
                      onClick={() => toggleTag(diffTags, setDiffTags, tag.key)}
                      className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                        isSelected
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {tag.emoji} {tag.label}
                    </button>
                  )
                })}
                <button
                  onClick={() => setShowDiffComment(!showDiffComment)}
                  className={`px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                    showDiffComment
                      ? 'border-orange-400 bg-orange-50 text-orange-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  ✏️ Autre
                </button>
              </div>

              {showDiffComment && (
                <textarea
                  value={diffComment}
                  onChange={(e) => setDiffComment(e.target.value)}
                  className="input w-full h-20 resize-none"
                  placeholder="Précise si tu veux..."
                  autoFocus
                />
              )}

              {error && (
                <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary w-full py-3"
              >
                {submitting ? 'Enregistrement...' : 'Valider mon check-in ✓'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
