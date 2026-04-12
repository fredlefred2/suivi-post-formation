'use client'

import { useState } from 'react'
import ActionFeedback from '@/app/components/ActionFeedback'
import type { ActionFeedbackData } from '@/lib/types'
import { useCountUp } from '@/lib/useCountUp'

function getDynamiqueForCount(count: number) {
  if (count === 0) return { icon: '💡', level: 0, label: 'Intention' }
  if (count <= 2) return { icon: '🧪', level: 1, label: 'Essai' }
  if (count <= 4) return { icon: '🔄', level: 2, label: 'Habitude' }
  if (count <= 6) return { icon: '⚡', level: 3, label: 'Réflexe' }
  return { icon: '👑', level: 4, label: 'Maîtrise' }
}

const AVATAR_BG_COLORS: Record<number, string> = {
  0: '#94a3b8', 1: '#0284c7', 2: '#059669', 3: '#d97706', 4: '#e11d48',
}

const LEVEL_DOT_BG: Record<number, string> = {
  0: '#f1f5f9', 1: '#e0f2fe', 2: '#d1fae5', 3: '#ffedd5', 4: '#ffe4e6',
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
  const [showAll, setShowAll] = useState(false)

  const animatedMembers = useCountUp(membersCount)
  const animatedDelta = useCountUp(recentActionsCount)

  const sorted = [...scoringData]
    .map((s) => {
      const dyns = [0, 1, 2].map((i) => getDynamiqueForCount(s.axesCounts[i] ?? 0))
      const totalLevel = dyns.reduce((a, m) => a + m.level, 0)
      return { ...s, dyns, totalLevel }
    })
    .sort((a, b) => b.totalLevel - a.totalLevel || b.totalActions - a.totalActions)

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  // Podium top 3 : [2e, 1er, 3e]
  const podium = sorted.slice(0, 3)
  const podiumDisplay = podium.length >= 3
    ? [podium[1], podium[0], podium[2]]
    : podium.length === 2
    ? [podium[1], podium[0]]
    : podium

  const podiumConfig = [
    { avatarSize: 'w-11 h-11', border: '2px solid #94a3b8', shadow: 'none', baseH: 56, baseGrad: 'linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%)', baseFontSize: 22, avatarFontSize: 14 },
    { avatarSize: 'w-14 h-14', border: '3px solid #fbbf24', shadow: '0 4px 16px rgba(251,191,36,0.4)', baseH: 80, baseGrad: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)', baseFontSize: 28, avatarFontSize: 18 },
    { avatarSize: 'w-11 h-11', border: '2px solid #f97316', shadow: 'none', baseH: 40, baseGrad: 'linear-gradient(180deg, #fdba74 0%, #f97316 100%)', baseFontSize: 22, avatarFontSize: 14 },
  ]

  const visibleActions = showAll ? recentActions : recentActions.slice(0, 4)
  const hasMore = recentActions.length > 4

  return (
    <div className="space-y-5 pb-4">
      {/* ── Header navy ── */}
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

      {/* ── Podium top 3 ── */}
      {podium.length > 0 && (
        <div>
          <h2 className="section-title mb-1">Les plus actifs sur Yapluka</h2>
          <div className="flex items-end justify-center gap-2 pt-4 pb-0 px-2">
            {podiumDisplay.map((learner, displayIdx) => {
              const cfg = podiumConfig[podium.length >= 3 ? displayIdx : podium.length === 2 ? (displayIdx === 0 ? 0 : 1) : 1]
              const actualRank = podium.indexOf(learner) + 1

              return (
                <div key={learner.id} className="flex flex-col items-center flex-1" style={{ maxWidth: 120 }}>
                  <div
                    className={`${cfg.avatarSize} rounded-full flex items-center justify-center font-extrabold text-white mb-2`}
                    style={{
                      background: '#1a1a2e',
                      border: cfg.border,
                      boxShadow: cfg.shadow,
                      fontSize: cfg.avatarFontSize,
                    }}
                  >
                    {getInitials(learner.name)}
                  </div>

                  <p className="text-[11px] font-bold text-center truncate w-full" style={{ color: '#1a1a2e' }}>
                    {learner.name}
                  </p>
                  <p className="text-[10px] font-medium mb-1.5" style={{ color: '#a0937c' }}>
                    {learner.totalActions} action{learner.totalActions !== 1 ? 's' : ''}
                  </p>

                  <div className="flex gap-1 mb-2">
                    {learner.dyns.map((d, i) => (
                      <span
                        key={i}
                        className="w-[22px] h-[22px] rounded-lg flex items-center justify-center text-[11px]"
                        style={{ background: LEVEL_DOT_BG[d.level] }}
                      >
                        {d.icon}
                      </span>
                    ))}
                  </div>

                  <div
                    className="w-full rounded-t-xl flex items-center justify-center font-bold text-white"
                    style={{
                      height: cfg.baseH,
                      background: cfg.baseGrad,
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: cfg.baseFontSize,
                    }}
                  >
                    {actualRank}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Actions récentes — feedback inline ── */}
      {recentActions.length === 0 ? (
        <div className="rounded-[22px] bg-white p-6 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <p className="text-2xl mb-2">💤</p>
          <p className="text-sm" style={{ color: '#a0937c' }}>Aucune action récente de l&apos;équipe</p>
          <p className="text-xs mt-1" style={{ color: '#c4b99a' }}>Sois le premier à en ajouter une !</p>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="section-title">Actions récentes</h2>
          </div>

          <div className="space-y-2.5">
            {visibleActions.map((action) => {
              const dyn = getDynamiqueForCount(action.axe_action_count)
              return (
                <div
                  key={action.id}
                  className="bg-white rounded-[18px] p-3.5"
                  style={{ border: '1.5px solid #f0ebe0' }}
                >
                  {/* En-tete : avatar + nom + axe + date */}
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: AVATAR_BG_COLORS[dyn.level] ?? AVATAR_BG_COLORS[0] }}
                    >
                      {getInitials(`${action.learner_first_name} ${action.learner_last_name}`)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold" style={{ color: '#1a1a2e' }}>
                          {action.learner_first_name} {action.learner_last_name}
                        </span>
                        <span className="text-xs">{dyn.icon}</span>
                        <span className="text-[10px] ml-auto" style={{ color: '#a0937c' }}>
                          {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium" style={{ color: '#92400e' }}>{action.axe_subject}</p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-[13px] leading-relaxed mt-2" style={{ color: '#1a1a2e' }}>
                    {action.description}
                  </p>

                  {/* Feedback inline */}
                  {feedbackMap[action.id] && (
                    <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid #f5f0e8' }}>
                      <ActionFeedback
                        actionId={action.id}
                        feedback={feedbackMap[action.id]}
                        canInteract={true}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Bouton voir plus / replier */}
          {hasMore && (
            <button
              onClick={() => setShowAll(prev => !prev)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2.5 rounded-[14px] text-xs font-semibold transition-all"
              style={{
                border: '2px dashed #f0ebe0',
                color: '#a0937c',
                background: showAll ? '#fffbeb' : 'transparent',
                borderColor: showAll ? '#fbbf24' : '#f0ebe0',
              }}
            >
              {showAll
                ? '▲ Replier'
                : `Voir les ${recentActions.length - 4} autres actions`
              }
            </button>
          )}
        </div>
      )}
    </div>
  )
}
