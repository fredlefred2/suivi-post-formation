'use client'

import type { ActionFeedbackData } from '@/lib/types'
import TeamNewsTicker from '@/app/components/TeamNewsTicker'
import TeamActionsCarousel from '@/app/components/TeamActionsCarousel'

type ScoringEntry = {
  id: string
  name: string
  totalActions: number
  last15Actions: number
  last15Checkins: number
  last15Quizzes: number
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
  // Tri par activité 15 jours (actions + quiz + check-in additionnés pour départager)
  const sorted = [...scoringData].sort((a, b) => {
    const aTot = a.last15Actions + a.last15Quizzes + a.last15Checkins
    const bTot = b.last15Actions + b.last15Quizzes + b.last15Checkins
    return bTot - aTot || b.totalActions - a.totalActions
  })

  function getInitials(name: string) {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  // Podium top 3 (uniquement si au moins 1 activité sur 15j)
  const podium = sorted.filter(s =>
    s.last15Actions + s.last15Quizzes + s.last15Checkins > 0
  ).slice(0, 3)
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

  return (
    <div className="space-y-4 pb-4">

      {/* ── Header noir discret ── */}
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

      {/* ── Ticker news ── */}
      <TeamNewsTicker news={news} />

      {/* ── Podium — 15 derniers jours ── */}
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

                  <p className="text-[11px] font-bold text-center truncate w-full mb-2" style={{ color: '#1a1a2e' }}>
                    {learner.name}
                  </p>

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

                  {/* Stats 15j — SOUS la marche */}
                  <div className="w-full pt-2 text-center">
                    <p className="text-[10px] font-semibold leading-tight" style={{ color: '#1a1a2e' }}>
                      <span className="font-extrabold" style={{ color: '#92400e' }}>{learner.last15Actions}</span>
                      <span className="ml-1" style={{ color: '#a0937c' }}>
                        action{learner.last15Actions !== 1 ? 's' : ''}
                      </span>
                    </p>
                    <p className="text-[10px] font-semibold leading-tight" style={{ color: '#1a1a2e' }}>
                      <span className="font-extrabold" style={{ color: '#92400e' }}>{learner.last15Checkins}</span>
                      <span className="ml-1" style={{ color: '#a0937c' }}>
                        check-in{learner.last15Checkins !== 1 ? 's' : ''}
                      </span>
                    </p>
                    <p className="text-[10px] font-semibold leading-tight" style={{ color: '#1a1a2e' }}>
                      <span className="font-extrabold" style={{ color: '#92400e' }}>{learner.last15Quizzes}</span>
                      <span className="ml-1" style={{ color: '#a0937c' }}>
                        quizz
                      </span>
                    </p>
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

      {/* ── Actions récentes : carrousel + "Voir tout" ── */}
      <TeamActionsCarousel
        actions={recentActions}
        feedbackMap={feedbackMap}
        deltaThisWeek={recentActionsCount}
      />
    </div>
  )
}
