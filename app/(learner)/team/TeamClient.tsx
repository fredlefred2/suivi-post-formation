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

const LEVEL_AVATAR_COLORS: Record<number, string> = {
  0: 'bg-slate-200 text-slate-700',
  1: 'bg-sky-200 text-sky-700',
  2: 'bg-emerald-200 text-emerald-700',
  3: 'bg-orange-200 text-orange-700',
  4: 'bg-rose-200 text-rose-700',
}

const AVATAR_BG_COLORS: Record<number, string> = {
  0: '#94a3b8', 1: '#0284c7', 2: '#059669', 3: '#d97706', 4: '#e11d48',
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

  const animatedMembers = useCountUp(membersCount)
  const animatedDelta = useCountUp(recentActionsCount)

  useEffect(() => {
    if (recentActions.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % recentActions.length)
    }, 2000)
    return () => clearInterval(timer)
  }, [recentActions.length])

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
      {/* ── Header navy — Cream & Warm ── */}
      <div
        className="rounded-[28px] p-5 relative overflow-hidden"
        style={{ background: '#1a1a2e' }}
      >
        <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />

        <div className="relative flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-extrabold text-white">{groupName}</h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{membersCount} participant{membersCount !== 1 ? 's' : ''}</p>
          </div>
          {totalWithCheckin > 0 && (() => {
            const max = Math.max(weatherCounts.sunny, weatherCounts.cloudy, weatherCounts.stormy)
            const avgEmoji = weatherCounts.sunny === max ? '☀️' : weatherCounts.cloudy === max ? '⛅' : '⛈️'
            return <span className="text-3xl drop-shadow-lg">{avgEmoji}</span>
          })()}
        </div>

        <div className="relative grid grid-cols-3 gap-2">
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="font-display text-[26px] font-bold text-white">{animatedMembers}</div>
            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>membres</p>
          </div>
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="font-display text-[26px] font-bold" style={{ color: recentActionsCount > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </div>
            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>cette semaine</p>
          </div>
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="font-display text-[26px] font-bold text-white">{totalActions}</div>
            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>actions</p>
          </div>
        </div>
      </div>

      {/* ── Actions récentes ── */}
      {recentActions.length === 0 ? (
        <div className="rounded-[22px] bg-white p-6 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <p className="text-2xl mb-2">💤</p>
          <p className="text-sm" style={{ color: '#a0937c' }}>Aucune action récente de l&apos;équipe</p>
          <p className="text-xs mt-1" style={{ color: '#c4b99a' }}>Sois le premier à en ajouter une !</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Actions récentes</h2>
            <button onClick={handleOpenAll} className="text-xs font-bold hover:underline" style={{ color: '#92400e' }}>
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
              return (
              <button
                key={action.id}
                onClick={handleOpenAll}
                className="flex-shrink-0 w-[240px] bg-white rounded-[22px] p-4 text-left transition-all duration-200 active:scale-[0.97] relative overflow-hidden"
                style={{
                  scrollSnapAlign: 'start',
                  border: '2px solid #f0ebe0',
                }}
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div
                    className="w-9 h-9 rounded-2xl flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: AVATAR_BG_COLORS[dyn.level] ?? AVATAR_BG_COLORS[0] }}
                  >
                    {getInitials(action.learner_first_name, action.learner_last_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold truncate" style={{ color: '#1a1a2e' }}>
                      {action.learner_first_name} {action.learner_last_name}
                    </p>
                    <p className="text-[10px] font-medium truncate" style={{ color: '#92400e' }}>{action.axe_subject}</p>
                  </div>
                  <span className="text-base shrink-0">{dyn.icon}</span>
                </div>
                <p className="text-[13px] line-clamp-2 leading-relaxed" style={{ color: '#1a1a2e' }}>{action.description}</p>
                <div className="flex items-center justify-between mt-2.5 pt-2" style={{ borderTop: '1px solid #f5f0e8' }}>
                  <p className="text-[10px] font-medium" style={{ color: '#a0937c' }}>
                    {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </p>
                  {feedbackMap[action.id] && (feedbackMap[action.id].likes_count > 0 || feedbackMap[action.id].comments_count > 0) && (
                    <div className="flex items-center gap-2 text-[10px]">
                      {feedbackMap[action.id].likes_count > 0 && (
                        <span className="font-semibold" style={{ color: '#e11d48' }}>{'\u2764\u{FE0F}'} {feedbackMap[action.id].likes_count}</span>
                      )}
                      {feedbackMap[action.id].comments_count > 0 && (
                        <span className="font-semibold" style={{ color: '#a0937c' }}>{'\u{1F4AC}'} {feedbackMap[action.id].comments_count}</span>
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
                  className="h-1.5 rounded-full transition-all duration-300"
                  style={{
                    width: i === currentSlide % recentActions.length ? '16px' : '6px',
                    background: i === currentSlide % recentActions.length ? '#fbbf24' : '#f0ebe0',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Trio de tête ── */}
      {sorted.length > 0 && (
      <div>
        <h2 className="section-title mb-3">Trio de tête</h2>
          <div className="space-y-2">
            {sorted.slice(0, 3).map((learner, idx) => {
              const rankStyles: Record<number, { bg: string; badgeBg: string; textColor: string }> = {
                0: { bg: '#fffbeb', badgeBg: '#fbbf24', textColor: '#92400e' },
                1: { bg: '#f8fafc', badgeBg: '#94a3b8', textColor: '#475569' },
                2: { bg: '#fff7ed', badgeBg: '#f97316', textColor: '#9a3412' },
              }
              const rs = rankStyles[idx]!
              return (
                <div
                  key={learner.id}
                  className="rounded-[22px] p-4 flex items-center gap-3 bg-white"
                  style={{ border: '2px solid #f0ebe0' }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 text-white"
                    style={{ background: rs.badgeBg }}
                  >
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate" style={{ color: '#1a1a2e' }}>
                      {learner.name} {idx === 0 && '👑'}
                    </p>
                    <p className="text-[11px] font-medium" style={{ color: '#a0937c' }}>{learner.totalActions} action{learner.totalActions !== 1 ? 's' : ''}</p>
                  </div>
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
      </div>
      )}

      {/* ── Modale : toutes les actions récentes ── */}
      {showAllActions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAllActions(false)} />
          <div className="relative bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-[28px] sm:rounded-[28px] shadow-xl flex flex-col pb-[max(0px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '2px solid #f0ebe0' }}>
              <h3 className="font-bold" style={{ color: '#1a1a2e' }}>Actions de la semaine</h3>
              <button
                onClick={() => setShowAllActions(false)}
                className="transition-colors p-1"
                style={{ color: '#a0937c' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {recentActions.map((action) => {
                const dyn = getDynamiqueForCount(action.axe_action_count)
                return (
                <div key={action.id} className="rounded-[18px] p-4" style={{ background: '#faf8f4', border: '2px solid #f0ebe0' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full ${LEVEL_AVATAR_COLORS[dyn.level] ?? LEVEL_AVATAR_COLORS[0]} flex items-center justify-center text-base`}>
                      {dyn.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold" style={{ color: '#1a1a2e' }}>
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-xs" style={{ color: '#92400e' }}>{action.axe_subject}</p>
                    </div>
                    <span className="text-xs" style={{ color: '#a0937c' }}>
                      {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed mb-2" style={{ color: '#1a1a2e' }}>{action.description}</p>
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
