'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X } from 'lucide-react'
import ActionFeedback from '@/app/components/ActionFeedback'
import type { ActionFeedbackData } from '@/lib/types'
import { useCountUp } from '@/lib/useCountUp'

function getDynamiqueForCount(count: number) {
  if (count === 0) return { icon: '⚪', level: 0, label: 'Veille' }
  if (count <= 2) return { icon: '👣', level: 1, label: 'Impulsion' }
  if (count <= 5) return { icon: '🥁', level: 2, label: 'Rythme' }
  if (count <= 8) return { icon: '🔥', level: 3, label: 'Intensité' }
  return { icon: '🚀', level: 4, label: 'Propulsion' }
}

const LEVEL_CARD_COLORS: Record<number, string> = {
  0: 'from-slate-50 to-slate-100',
  1: 'from-sky-50 to-sky-100',
  2: 'from-emerald-50 to-emerald-100',
  3: 'from-orange-50 to-orange-100',
  4: 'from-rose-50 to-rose-100',
}

const LEVEL_AVATAR_COLORS: Record<number, string> = {
  0: 'bg-slate-200 text-slate-700',
  1: 'bg-sky-200 text-sky-700',
  2: 'bg-emerald-200 text-emerald-700',
  3: 'bg-orange-200 text-orange-700',
  4: 'bg-rose-200 text-rose-700',
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
  groupId: string
  groupName: string
  membersCount: number
  totalActions: number
  recentActionsCount: number
  weatherCounts: { sunny: number; cloudy: number; stormy: number }
  totalWithCheckin: number
  isCheckinOpen: boolean
  scoringData: ScoringEntry[]
  recentActions: RecentAction[]
  feedbackMap: Record<string, ActionFeedbackData>
}

export default function TeamClient({
  groupId,
  groupName,
  membersCount,
  totalActions,
  recentActionsCount,
  weatherCounts,
  totalWithCheckin,
  scoringData,
  recentActions,
  feedbackMap,
  isCheckinOpen,
}: Props) {
  const [showAllActions, setShowAllActions] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Compteurs animés
  const animatedMembers = useCountUp(membersCount)
  const animatedDelta = useCountUp(recentActionsCount)

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

  // Pas besoin d'indice moyen ni météo agrégée — on utilise la distribution

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

      {/* ── Bloc principal : 3 colonnes compactes ── */}
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-3">
          {/* Colonne 1 : Membres */}
          <div className="text-center">
            <div className="text-3xl font-black text-gray-800">{animatedMembers}</div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">membre{membersCount !== 1 ? 's' : ''}</p>
          </div>

          {/* Colonne 2 : Actions cette semaine */}
          <div className="text-center">
            <div className={`text-3xl font-black ${recentActionsCount > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">cette semaine</p>
          </div>

          {/* Colonne 3 : Actions totales */}
          <div className="text-center">
            <div className="text-3xl font-black text-gray-800">{totalActions}</div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">actions</p>
          </div>
        </div>

        {/* Météo distribution semaine passée */}
        {totalWithCheckin > 0 && (
          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">Météo S-1</span>
            {weatherCounts.sunny > 0 && (
              <span className="text-sm">☀️ <span className="text-xs font-semibold text-gray-600">{weatherCounts.sunny}</span></span>
            )}
            {weatherCounts.cloudy > 0 && (
              <span className="text-sm">⛅ <span className="text-xs font-semibold text-gray-600">{weatherCounts.cloudy}</span></span>
            )}
            {weatherCounts.stormy > 0 && (
              <span className="text-sm">⛈️ <span className="text-xs font-semibold text-gray-600">{weatherCounts.stormy}</span></span>
            )}
          </div>
        )}
      </div>

      {/* ── Empty state : aucune action récente ── */}
      {recentActions.length === 0 && (
        <div className="card text-center py-6">
          <p className="text-2xl mb-2">💤</p>
          <p className="text-sm text-gray-500">Aucune action r&eacute;cente de l&apos;&eacute;quipe</p>
          <p className="text-xs text-gray-500 mt-1">Sois le premier &agrave; en ajouter une ! 🚀</p>
        </div>
      )}

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
                  <div className={`w-8 h-8 rounded-full ${LEVEL_AVATAR_COLORS[dyn.level] ?? LEVEL_AVATAR_COLORS[0]} flex items-center justify-center text-base`}>
                    {dyn.icon}
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
                  <p className="text-[10px] text-gray-500">
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
          <p className="text-gray-500 text-sm">Aucune action cette semaine</p>
        </div>
      )}

      {/* ── Tous en action ── */}
      <div className="card">
        <h2 className="section-title mb-3">Tous en action</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucun membre</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
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
                    <td className="py-1.5 text-xs text-gray-500 w-6">{idx + 1}</td>
                    <td className="py-1.5 font-medium text-gray-800 truncate max-w-[140px]">
                      {learner.name}
                    </td>
                    <td className="py-1.5 text-center font-semibold text-gray-700">{learner.totalActions}</td>
                    {learner.dyns.map((m, i) => (
                      <td key={i} className="py-1.5 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${LEVEL_AVATAR_COLORS[m.level] ?? LEVEL_AVATAR_COLORS[0]}`}>{m.icon}</span>
                      </td>
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
          <div className="relative bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col pb-[max(0px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Actions de la semaine</h3>
              <button
                onClick={() => setShowAllActions(false)}
                className="text-gray-500 hover:text-gray-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {recentActions.map((action) => {
                const dyn = getDynamiqueForCount(action.axe_action_count)
                return (
                <div key={action.id} className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full ${LEVEL_AVATAR_COLORS[dyn.level] ?? LEVEL_AVATAR_COLORS[0]} flex items-center justify-center text-base`}>
                      {dyn.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-700">
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-xs text-indigo-500">{action.axe_subject}</p>
                    </div>
                    <span className="text-xs text-gray-500">
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
              )})}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
