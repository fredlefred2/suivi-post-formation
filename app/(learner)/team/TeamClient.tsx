'use client'

import type { ActionFeedbackData } from '@/lib/types'
import TeamNewsTicker from '@/app/components/TeamNewsTicker'
import TeamActionsFeed from '@/app/components/TeamActionsFeed'
import HeaderNavy from '@/app/components/ui/HeaderNavy'

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

  // Config des 3 places (display order : 2e · 1er · 3e) — COMPACT (v1.29.5)
  const podiumConfig = [
    {
      avatarSize: 'w-10 h-10',
      avatarBorder: '2px solid #cbd5e1',
      avatarShadow: '0 0 0 3px rgba(148,163,184,0.12)',
      avatarFontSize: 13,
      stepH: 34,
      stepBg: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
      stepColor: '#475569',
      stepFontSize: 18,
      chipBg: '#f1f5f9',
      chipColor: '#475569',
      chipBorder: '1px solid #e2e8f0',
    },
    {
      avatarSize: 'w-[52px] h-[52px]',
      avatarBorder: '3px solid #fbbf24',
      avatarShadow: '0 4px 14px rgba(251,191,36,0.4), 0 0 0 3px rgba(251,191,36,0.15)',
      avatarFontSize: 16,
      stepH: 50,
      stepBg: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)',
      stepColor: '#fff',
      stepFontSize: 22,
      chipBg: '#fffbeb',
      chipColor: '#92400e',
      chipBorder: '1px solid #fde68a',
    },
    {
      avatarSize: 'w-10 h-10',
      avatarBorder: '2px solid #fdba74',
      avatarShadow: '0 0 0 3px rgba(253,186,116,0.15)',
      avatarFontSize: 13,
      stepH: 24,
      stepBg: 'linear-gradient(180deg, #fdba74 0%, #f97316 100%)',
      stepColor: '#fff',
      stepFontSize: 18,
      chipBg: '#fff7ed',
      chipColor: '#9a3412',
      chipBorder: '1px solid #fed7aa',
    },
  ]

  return (
    <div className="space-y-2.5 pb-3">

      {/* ── Header navy harmonisé (composant partagé) ── */}
      <HeaderNavy
        compact
        title="Team"
        subtitle={<>{groupName} · {membersCount} participant{membersCount !== 1 ? 's' : ''}</>}
        right={
          <>
            <div className="text-[12px] font-bold">
              <span style={{ color: '#fbbf24', fontWeight: 800 }}>{totalActions}</span>
              <span className="text-[10px] font-semibold ml-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
                action{totalActions !== 1 ? 's' : ''}
              </span>
            </div>
            {recentActionsCount > 0 && (
              <div className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.55)' }}>
                <span style={{ color: '#fbbf24', fontWeight: 800 }}>+{recentActionsCount}</span> cette sem.
              </div>
            )}
          </>
        }
      />

      {/* ── Ticker news ── */}
      <TeamNewsTicker news={news} />

      {/* ── Podium compact — les plus actifs ces 15 derniers jours ── */}
      {podium.length > 0 ? (
        <div
          className="rounded-[18px] px-3 pt-3 pb-2"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #fffbf0 100%)',
            border: '2px solid #f0ebe0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <h2 className="text-[10.5px] font-extrabold tracking-wider uppercase text-center mb-2" style={{ color: '#a0937c' }}>
            Les plus actifs · 15 derniers jours
          </h2>
          <div className="flex items-end justify-center gap-2">
            {podiumDisplay.map((learner, displayIdx) => {
              const cfg = podiumConfig[podium.length >= 3 ? displayIdx : podium.length === 2 ? (displayIdx === 0 ? 0 : 1) : 1]
              const actualRank = podium.indexOf(learner) + 1
              const gestes = learner.last15Actions + learner.last15Checkins + learner.last15Quizzes

              return (
                <div key={learner.id} className="flex flex-col items-center flex-1" style={{ maxWidth: 110 }}>
                  <div
                    className={`${cfg.avatarSize} rounded-full flex items-center justify-center font-extrabold text-white mb-1 transition-transform`}
                    style={{
                      background: '#1a1a2e',
                      color: '#fbbf24',
                      border: cfg.avatarBorder,
                      boxShadow: cfg.avatarShadow,
                      fontSize: cfg.avatarFontSize,
                    }}
                  >
                    {getInitials(learner.name)}
                  </div>

                  <p className="text-[11px] font-extrabold text-center truncate w-full mb-1.5" style={{ color: '#1a1a2e' }}>
                    {learner.name.split(' ')[0]}
                  </p>

                  <div
                    className="w-full rounded-t-[12px] flex items-center justify-center font-extrabold"
                    style={{
                      height: cfg.stepH,
                      background: cfg.stepBg,
                      color: cfg.stepColor,
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: cfg.stepFontSize,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {actualRank}
                  </div>

                  {/* Chip "X gestes" */}
                  <div
                    className="mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                    style={{
                      background: cfg.chipBg,
                      color: cfg.chipColor,
                      border: cfg.chipBorder,
                    }}
                  >
                    {gestes} geste{gestes !== 1 ? 's' : ''}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[9.5px] text-center mt-2" style={{ color: '#a0937c' }}>
            1 geste = 1 action · 1 check-in · 1 quiz
          </p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white p-4 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <p className="text-xl mb-1">🌅</p>
          <p className="text-[12px]" style={{ color: '#a0937c' }}>La quinzaine commence, personne n&apos;a encore posté.</p>
        </div>
      )}

      {/* ── Feed actions — 2 actions visibles + Voir tout ── */}
      <TeamActionsFeed
        actions={recentActions}
        feedbackMap={feedbackMap}
        deltaThisWeek={recentActionsCount}
        visibleCount={2}
      />
    </div>
  )
}
