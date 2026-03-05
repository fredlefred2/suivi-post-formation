'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Users, TrendingUp, X } from 'lucide-react'
import ActionFeedback from '@/app/components/ActionFeedback'
import type { ActionFeedbackData } from '@/lib/types'

const WEATHER_POINTS: Record<string, number> = { stormy: 0, cloudy: 1, sunny: 2 }

function getOverallWeatherEmoji(score: number) {
  if (score < 0.4) return '\u{1F327}\u{FE0F}'   // stormy
  if (score < 0.8) return '\u{1F325}\u{FE0F}'   // nuage gris
  if (score < 1.2) return '\u26C5'               // mitigé
  if (score <= 1.6) return '\u{1F324}\u{FE0F}'  // soleil + petits nuages
  return '\u2600\u{FE0F}'                         // ça roule
}

function getDynamiqueForCount(count: number) {
  if (count === 0) return { icon: '\u{1F4CD}', level: 0, label: 'Ancrage' }
  if (count <= 2) return { icon: '\u{1F463}', level: 1, label: 'Impulsion' }
  if (count <= 5) return { icon: '\u{1F941}', level: 2, label: 'Rythme' }
  if (count <= 8) return { icon: '\u{1F525}', level: 3, label: 'Intensité' }
  return { icon: '\u{1F680}', level: 4, label: 'Propulsion' }
}

const LEVEL_CARD_COLORS: Record<number, string> = {
  0: 'from-gray-50 to-gray-100',
  1: 'from-teal-50 to-emerald-50',
  2: 'from-blue-50 to-indigo-50',
  3: 'from-orange-50 to-amber-50',
  4: 'from-purple-50 to-fuchsia-50',
}

const LEVEL_AVATAR_COLORS: Record<number, string> = {
  0: 'bg-gray-200 text-gray-700',
  1: 'bg-teal-200 text-teal-700',
  2: 'bg-blue-200 text-blue-700',
  3: 'bg-orange-200 text-orange-700',
  4: 'bg-purple-200 text-purple-700',
}

type ScoringEntry = {
  id: string
  name: string
  totalActions: number
  axesCounts: number[]
}

type RecentAction = {
  id: string
  description: string
  created_at: string
  axe_subject: string
  axe_action_count: number
  learner_first_name: string
  learner_last_name: string
}

type Props = {
  groupName: string
  membersCount: number
  totalActions: number
  recentActionsCount: number
  weatherCounts: { sunny: number; cloudy: number; stormy: number }
  totalWithCheckin: number
  scoringData: ScoringEntry[]
  recentActions: RecentAction[]
  feedbackMap: Record<string, ActionFeedbackData>
}

export default function TeamClient({
  groupName,
  membersCount,
  totalActions,
  recentActionsCount,
  weatherCounts,
  totalWithCheckin,
  scoringData,
  recentActions,
  feedbackMap,
}: Props) {
  const [showAllActions, setShowAllActions] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll toutes les 2s
  useEffect(() => {
    if (recentActions.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % recentActions.length)
    }, 2000)
    return () => clearInterval(timer)
  }, [recentActions.length])

  // Scroll programmatique
  useEffect(() => {
    if (!scrollRef.current) return
    const cardWidth = 220
    const gap = 12
    scrollRef.current.scrollTo({
      left: currentSlide * (cardWidth + gap),
      behavior: 'smooth',
    })
  }, [currentSlide])

  const handleOpenAll = useCallback(() => {
    setShowAllActions(true)
  }, [])

  // Météo générale
  const overallScore = totalWithCheckin > 0
    ? Object.entries(weatherCounts).reduce((acc, [key, count]) => acc + count * (WEATHER_POINTS[key] ?? 0), 0) / totalWithCheckin
    : -1
  const overallEmoji = overallScore >= 0 ? getOverallWeatherEmoji(overallScore) : null

  // Indice d'action moyen
  const avgActions = membersCount > 0 ? Math.round(totalActions / membersCount) : 0
  const actionIndice = getDynamiqueForCount(avgActions)

  // Scoring trié
  const sorted = [...scoringData]
    .map((s) => {
      const dyns = [0, 1, 2].map((i) => getDynamiqueForCount(s.axesCounts[i] ?? 0))
      const totalLevel = dyns.reduce((a, m) => a + m.level, 0)
      return { ...s, dyns, totalLevel }
    })
    .sort((a, b) => b.totalLevel - a.totalLevel || b.totalActions - a.totalActions)

  function getInitials(first: string, last: string) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  }

  return (
    <div className="space-y-6 pb-4">
      <h1 className="page-title">{groupName}</h1>

      {/* ── Bloc 1 : Membres + Météo générale ── */}
      <div className="card py-5 px-4">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {/* Membres */}
          <div className="text-center px-2">
            <Users size={28} className="mx-auto text-indigo-500 mb-1.5" />
            <p className="text-3xl font-bold text-gray-800">{membersCount}</p>
            <p className="text-xs text-gray-500 mt-0.5">Membres</p>
          </div>
          {/* Météo */}
          <div className="text-center px-2 flex flex-col items-center justify-center">
            {overallEmoji ? (
              <>
                <p className="text-xs text-gray-500 mb-2">Météo générale</p>
                <span className="text-6xl leading-none">{overallEmoji}</span>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">Météo générale</p>
                <span className="text-5xl text-gray-300">-</span>
                <p className="text-[11px] text-gray-400 mt-1">Pas de check-in</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bloc 2 : Actions cette semaine + Indice d'action ── */}
      <div className="card py-5 px-4">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {/* Delta actions cette semaine (gauche) */}
          <div className="text-center px-2">
            <TrendingUp size={28} className="mx-auto text-emerald-500 mb-1.5" />
            <p className={`text-3xl font-bold ${recentActionsCount > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
              {recentActionsCount > 0 ? `+${recentActionsCount}` : '0'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Actions cette semaine</p>
          </div>
          {/* Indice d'action (droite) */}
          <div className="text-center px-2 flex flex-col items-center justify-center">
            <span className="text-6xl leading-none">{actionIndice.icon}</span>
            <p className="text-sm font-semibold text-gray-700 mt-2">{actionIndice.label}</p>
          </div>
        </div>
      </div>

      {/* ── Carrousel actions récentes ── */}
      {recentActions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Actions récentes</h2>
            <button onClick={handleOpenAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline">
              Voir tout
            </button>
          </div>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-thin pb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {recentActions.map((action) => {
              const dyn = getDynamiqueForCount(action.axe_action_count)
              return (
              <button
                key={action.id}
                onClick={handleOpenAll}
                className={`flex-shrink-0 w-[220px] bg-gradient-to-br ${LEVEL_CARD_COLORS[dyn.level] ?? LEVEL_CARD_COLORS[0]} rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md active:scale-[0.98]`}
                style={{ scrollSnapAlign: 'start' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-8 h-8 rounded-full ${LEVEL_AVATAR_COLORS[dyn.level] ?? LEVEL_AVATAR_COLORS[0]} flex items-center justify-center text-xs font-bold`}>
                    {getInitials(action.learner_first_name, action.learner_last_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-700 truncate">
                      {action.learner_first_name} {action.learner_last_name}
                    </p>
                    <p className="text-[10px] text-indigo-500 truncate">{action.axe_subject}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{action.description}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-[10px] text-gray-400">
                    {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  {feedbackMap[action.id] && (feedbackMap[action.id].likes_count > 0 || feedbackMap[action.id].comments_count > 0) && (
                    <div className="flex items-center gap-2 text-[10px]">
                      {feedbackMap[action.id].likes_count > 0 && (
                        <span className="text-pink-400">{'\u2764\u{FE0F}'} {feedbackMap[action.id].likes_count}</span>
                      )}
                      {feedbackMap[action.id].comments_count > 0 && (
                        <span className="text-indigo-400">{'\u{1F4AC}'} {feedbackMap[action.id].comments_count}</span>
                      )}
                    </div>
                  )}
                </div>
              </button>
              )
            })}
          </div>
          {recentActions.length > 1 && (
            <div className="flex justify-center gap-1 mt-3">
              {recentActions.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSlide % recentActions.length ? 'w-4 bg-indigo-500' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {recentActions.length === 0 && (
        <div className="card text-center py-6">
          <p className="text-gray-400 text-sm">Aucune action ces 7 derniers jours</p>
        </div>
      )}

      {/* ── Classement ── */}
      <div className="card">
        <h2 className="section-title mb-3">Classement</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Aucun membre</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">#</th>
                  <th className="text-left pb-2 font-medium">Nom</th>
                  <th className="text-center pb-2 font-medium">Actions</th>
                  <th className="text-center pb-2 font-medium">Axe 1</th>
                  <th className="text-center pb-2 font-medium">Axe 2</th>
                  <th className="text-center pb-2 font-medium">Axe 3</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((learner, idx) => (
                  <tr key={learner.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 text-xs text-gray-400 w-6">{idx + 1}</td>
                    <td className="py-1.5 font-medium text-gray-800 truncate max-w-[140px]">
                      {learner.name}
                    </td>
                    <td className="py-1.5 text-center font-semibold text-gray-700">{learner.totalActions}</td>
                    {learner.dyns.map((m, i) => (
                      <td key={i} className="py-1.5 text-center text-base">{m.icon}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modale : toutes les actions récentes ── */}
      {showAllActions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAllActions(false)} />
          <div className="relative bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Actions des 7 derniers jours</h3>
              <button
                onClick={() => setShowAllActions(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {recentActions.map((action) => (
                <div key={action.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold">
                      {getInitials(action.learner_first_name, action.learner_last_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-700">
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-xs text-indigo-500">{action.axe_subject}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-2">{action.description}</p>
                  {feedbackMap[action.id] && (
                    <ActionFeedback
                      actionId={action.id}
                      feedback={feedbackMap[action.id]}
                      canInteract={true}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
