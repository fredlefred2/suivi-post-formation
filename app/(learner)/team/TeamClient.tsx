'use client'

import type { ActionFeedbackData } from '@/lib/types'
import TeamNewsTicker from '@/app/components/TeamNewsTicker'
import TeamActionsCarousel from '@/app/components/TeamActionsCarousel'

function getDynamiqueForCount(count: number) {
  if (count === 0) return { icon: '💡', level: 0, label: 'Intention' }
  if (count <= 2) return { icon: '🧪', level: 1, label: 'Essai' }
  if (count <= 4) return { icon: '🔄', level: 2, label: 'Habitude' }
  if (count <= 6) return { icon: '⚡', level: 3, label: 'Réflexe' }
  return { icon: '👑', level: 4, label: 'Maîtrise' }
}

const LEVEL_DOT_BG: Record<number, string> = {
  0: '#f1f5f9', 1: '#e0f2fe', 2: '#d1fae5', 3: '#ffedd5', 4: '#ffe4e6',
}

type ScoringEntry = {
  id: string
  name: string
  totalActions: number        // total cumul (pour dyns)
  last15Actions: number       // nouveau tri podium (15 derniers jours)
  axesCounts: number[]        // total par axe
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
  scoringData: ScoringEntry[]
  recentActions: RecentAction[]
  feedbackMap: Record<string, ActionFeedbackData>
  news: string[]
}

export default function TeamClient({
  groupName,
  membersCount,
  totalActions,
  recentActionsCount,
  scoringData,
  recentActions,
  feedbackMap,
  news,
}: Props) {
  // Trier par actions 15j desc, puis total desc en tiebreaker
  const sorted = [...scoringData]
    .map((s) => {
      const dyns = [0, 1, 2].map((i) => getDynamiqueForCount(s.axesCounts[i] ?? 0))
      return { ...s, dyns }
    })
    .sort((a, b) => b.last15Actions - a.last15Actions || b.totalActions - a.totalActions)

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  // Podium top 3 (uniquement si au moins 1 action sur 15j chez le 1er)
  const podium = sorted.filter(s => s.last15Actions > 0).slice(0, 3)
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

  // Reste du classement (4e et +)
  const rest = sorted.slice(podium.length)

  return (
    <div className="space-y-4 pb-4">

      {/* ── Header noir discret (v1.29.5) ── */}
      <div
        className="rounded-[22px] px-[18px] py-[14px] relative overflow-hidden"
        style={{ background: '#1a1a2e' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[17px] font-extrabold text-white leading-tight">Team</h1>
            <p className="text-[11px] mt-0.5 font-semibold truncate" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {groupName} · {membersCount} participant{membersCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[13px] font-bold" style={{ color: '#fff' }}>
              <span style={{ color: '#fbbf24', fontWeight: 800 }}>{totalActions}</span>
              <span className="text-[11px] font-semibold ml-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                action{totalActions !== 1 ? 's' : ''}
              </span>
            </div>
            {recentActionsCount > 0 && (
              <div className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <span style={{ color: '#fbbf24', fontWeight: 800 }}>+{recentActionsCount}</span> cette sem.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Ticker news valorisantes ── */}
      <TeamNewsTicker news={news} />

      {/* ── Podium — ces 15 derniers jours ── */}
      {podium.length > 0 ? (
        <div>
          <h2 className="section-title mb-1 pl-1">Les plus actifs ces 15 derniers jours</h2>
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
                    {learner.last15Actions} action{learner.last15Actions !== 1 ? 's' : ''}
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
      ) : (
        <div className="rounded-[22px] bg-white p-6 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <p className="text-2xl mb-2">🌅</p>
          <p className="text-sm" style={{ color: '#a0937c' }}>La semaine commence, personne n&apos;a encore posté.</p>
          <p className="text-xs mt-1" style={{ color: '#c4b99a' }}>Sois le premier à te lancer !</p>
        </div>
      )}

      {/* ── Classement 4e et + ── */}
      {rest.length > 0 && (
        <div
          className="rounded-[22px] bg-white"
          style={{ border: '2px solid #f0ebe0', padding: '10px 12px' }}
        >
          {rest.map((learner, idx) => {
            const rank = podium.length + idx + 1
            const noActivity = learner.last15Actions === 0
            return (
              <div
                key={learner.id}
                className="flex items-center gap-3"
                style={{
                  padding: '7px 0',
                  borderTop: idx === 0 ? 'none' : '1px solid #f4efe3',
                  opacity: noActivity ? 0.55 : 1,
                }}
              >
                <span className="text-[12px] font-extrabold text-center" style={{ color: '#a0937c', width: 24 }}>
                  {rank}
                </span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                  style={{ background: '#1a1a2e', color: '#fbbf24' }}
                >
                  {getInitials(learner.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold truncate" style={{ color: '#1a1a2e' }}>
                    {learner.name}
                  </p>
                </div>
                <span
                  className="text-[12px] font-extrabold shrink-0"
                  style={{ color: noActivity ? '#a0937c' : '#92400e' }}
                >
                  {learner.last15Actions}
                  <span className="text-[10px] font-semibold ml-1" style={{ color: '#a0937c' }}>
                    action{learner.last15Actions !== 1 ? 's' : ''}
                  </span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Actions récentes : carrousel + "Voir tout" ── */}
      <TeamActionsCarousel
        actions={recentActions}
        feedbackMap={feedbackMap}
        deltaThisWeek={recentActionsCount}
      />
    </div>
  )
}
