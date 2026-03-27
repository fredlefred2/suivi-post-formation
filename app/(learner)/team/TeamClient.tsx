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
      {/* ── Bloc principal : gradient indigo harmonisé avec dashboard ── */}
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
          boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
        }}
      >
        {/* Cercles décoratifs */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />

        {/* Titre du groupe + météo en haut à droite */}
        <div className="relative flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-white">{groupName}</h1>
            <p className="text-xs text-indigo-200 mt-0.5">{membersCount} participant{membersCount !== 1 ? 's' : ''}</p>
          </div>
          {totalWithCheckin > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                {weatherCounts.sunny > 0 && (
                  <span className="text-lg drop-shadow-lg">☀️<span className="text-[10px] font-bold text-white ml-0.5">{weatherCounts.sunny}</span></span>
                )}
                {weatherCounts.cloudy > 0 && (
                  <span className="text-lg drop-shadow-lg">⛅<span className="text-[10px] font-bold text-white ml-0.5">{weatherCounts.cloudy}</span></span>
                )}
                {weatherCounts.stormy > 0 && (
                  <span className="text-lg drop-shadow-lg">⛈️<span className="text-[10px] font-bold text-white ml-0.5">{weatherCounts.stormy}</span></span>
                )}
              </div>
              <span className="text-[9px] text-indigo-200">météo S-1</span>
            </div>
          )}
        </div>

        {/* Stats en 3 colonnes glass */}
        <div className="relative grid grid-cols-3 gap-2">
          {/* Membres */}
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className="text-2xl font-black text-white">{animatedMembers}</div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">membre{membersCount !== 1 ? 's' : ''}</p>
          </div>

          {/* Actions cette semaine */}
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className={`text-2xl font-black ${recentActionsCount > 0 ? 'text-emerald-300' : 'text-white/40'}`}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">cette semaine</p>
          </div>

          {/* Actions totales */}
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className="text-2xl font-black text-white">{totalActions}</div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">actions</p>
          </div>
        </div>
      </div>

      {/* ── Actions récentes ── */}
      {recentActions.length === 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p className="text-2xl mb-2">💤</p>
          <p className="text-sm text-gray-500">Aucune action r&eacute;cente de l&apos;&eacute;quipe</p>
          <p className="text-xs text-gray-400 mt-1">Sois le premier &agrave; en ajouter une !</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">Actions récentes</h2>
            <button onClick={handleOpenAll} className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold">
              Voir tout →
            </button>
          </div>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
          >
            {recentActions.map((action) => {
              const dyn = getDynamiqueForCount(action.axe_action_count)
              const borderColors: Record<number, string> = {
                0: '#94a3b8', 1: '#38bdf8', 2: '#34d399', 3: '#fb923c', 4: '#fb7185',
              }
              return (
              <button
                key={action.id}
                onClick={handleOpenAll}
                className="flex-shrink-0 w-[240px] bg-white rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.97] relative overflow-hidden"
                style={{
                  scrollSnapAlign: 'start',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
                  borderLeft: `3px solid ${borderColors[dyn.level] ?? borderColors[0]}`,
                }}
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${borderColors[dyn.level] ?? borderColors[0]}, ${borderColors[dyn.level] ?? borderColors[0]}dd)`,
                    }}
                  >
                    {getInitials(action.learner_first_name, action.learner_last_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 truncate">
                      {action.learner_first_name} {action.learner_last_name}
                    </p>
                    <p className="text-[10px] text-indigo-500 font-medium truncate">{action.axe_subject}</p>
                  </div>
                  <span className="text-base shrink-0">{dyn.icon}</span>
                </div>
                <p className="text-[13px] text-gray-600 line-clamp-2 leading-relaxed">{action.description}</p>
                <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400 font-medium">
                    {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  {feedbackMap[action.id] && (feedbackMap[action.id].likes_count > 0 || feedbackMap[action.id].comments_count > 0) && (
                    <div className="flex items-center gap-2 text-[10px]">
                      {feedbackMap[action.id].likes_count > 0 && (
                        <span className="text-pink-400 font-semibold">{'\u2764\u{FE0F}'} {feedbackMap[action.id].likes_count}</span>
                      )}
                      {feedbackMap[action.id].comments_count > 0 && (
                        <span className="text-indigo-400 font-semibold">{'\u{1F4AC}'} {feedbackMap[action.id].comments_count}</span>
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

      {/* ── Classement — Tous en action ── */}
      <div>
        <h2 className="text-sm font-bold text-gray-800 mb-3">L&apos;équipe en action</h2>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Aucun membre</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((learner, idx) => {
              const isTop3 = idx < 3
              const rankColors: Record<number, { bg: string; border: string; text: string; badge: string }> = {
                0: { bg: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)', border: '1px solid #fbbf24', text: '#92400e', badge: '#f59e0b' },
                1: { bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', border: '1px solid #cbd5e1', text: '#475569', badge: '#94a3b8' },
                2: { bg: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)', border: '1px solid #fdba74', text: '#9a3412', badge: '#f97316' },
              }
              const rc = rankColors[idx]
              return (
                <div
                  key={learner.id}
                  className="rounded-2xl p-3.5 flex items-center gap-3 transition-all duration-200"
                  style={isTop3 && rc ? {
                    background: rc.bg,
                    border: rc.border,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  } : {
                    background: 'white',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Rang */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={isTop3 && rc ? {
                      background: rc.badge,
                      color: 'white',
                      boxShadow: `0 2px 8px ${rc.badge}66`,
                    } : {
                      background: '#f1f5f9',
                      color: '#94a3b8',
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* Nom + actions */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: isTop3 && rc ? rc.text : '#1f2937' }}>
                      {learner.name}
                    </p>
                    <p className="text-[10px] text-gray-500 font-medium">{learner.totalActions} action{learner.totalActions !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Icônes dynamique des axes */}
                  <div className="flex items-center gap-1 shrink-0">
                    {learner.dyns.map((m, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm ${LEVEL_AVATAR_COLORS[m.level] ?? LEVEL_AVATAR_COLORS[0]}`}
                      >
                        {m.icon}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
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
