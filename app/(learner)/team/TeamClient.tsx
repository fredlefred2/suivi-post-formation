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

  // Config des 3 places (display order : 2e · 1er · 3e)
  // — 1er = amber gradient + halo · 2e = slate clean · 3e = orange subtil
  const podiumConfig = [
    {
      avatarSize: 'w-12 h-12',
      avatarBorder: '2px solid #cbd5e1',
      avatarShadow: '0 0 0 3px rgba(148,163,184,0.12)',
      avatarFontSize: 15,
      stepH: 50,
      stepBg: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
      stepColor: '#475569',
      stepFontSize: 20,
      chipBg: '#f1f5f9',
      chipColor: '#475569',
      chipBorder: '1px solid #e2e8f0',
    },
    {
      avatarSize: 'w-16 h-16',
      avatarBorder: '3px solid #fbbf24',
      avatarShadow: '0 6px 22px rgba(251,191,36,0.45), 0 0 0 4px rgba(251,191,36,0.15)',
      avatarFontSize: 19,
      stepH: 72,
      stepBg: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)',
      stepColor: '#fff',
      stepFontSize: 26,
      chipBg: '#fffbeb',
      chipColor: '#92400e',
      chipBorder: '1px solid #fde68a',
    },
    {
      avatarSize: 'w-12 h-12',
      avatarBorder: '2px solid #fdba74',
      avatarShadow: '0 0 0 3px rgba(253,186,116,0.15)',
      avatarFontSize: 15,
      stepH: 38,
      stepBg: 'linear-gradient(180deg, #fdba74 0%, #f97316 100%)',
      stepColor: '#fff',
      stepFontSize: 20,
      chipBg: '#fff7ed',
      chipColor: '#9a3412',
      chipBorder: '1px solid #fed7aa',
    },
  ]

  return (
    <div className="space-y-4 pb-4">

      {/* ── Header navy dégradé (harmonisé avec dashboard) ── */}
      <div
        className="rounded-[22px] px-[18px] py-[14px] relative overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
      >
        <div className="absolute -top-4 -right-3 w-[70px] h-[70px] rounded-full" style={{ background: 'rgba(251,191,36,0.14)' }} />
        <div className="relative flex items-start justify-between gap-3">
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

      {/* ── Podium — les plus actifs ces 15 derniers jours ── */}
      {podium.length > 0 ? (
        <div
          className="rounded-[22px] px-3 pt-4 pb-3"
          style={{
            background: 'linear-gradient(180deg, #ffffff 0%, #fffbf0 100%)',
            border: '2px solid #f0ebe0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05)',
          }}
        >
          <h2 className="section-title text-center mb-3">Les plus actifs ces 15 derniers jours</h2>
          <div className="flex items-end justify-center gap-2.5">
            {podiumDisplay.map((learner, displayIdx) => {
              const cfg = podiumConfig[podium.length >= 3 ? displayIdx : podium.length === 2 ? (displayIdx === 0 ? 0 : 1) : 1]
              const actualRank = podium.indexOf(learner) + 1
              const gestes = learner.last15Actions + learner.last15Checkins + learner.last15Quizzes

              return (
                <div key={learner.id} className="flex flex-col items-center flex-1" style={{ maxWidth: 120 }}>
                  <div
                    className={`${cfg.avatarSize} rounded-full flex items-center justify-center font-extrabold text-white mb-2 transition-transform`}
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

                  <p className="text-[12px] font-extrabold text-center truncate w-full mb-2" style={{ color: '#1a1a2e' }}>
                    {learner.name.split(' ')[0]}
                  </p>

                  <div
                    className="w-full rounded-t-[14px] flex items-center justify-center font-extrabold"
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

                  {/* Chiffre unique : X gestes */}
                  <div
                    className="mt-2 px-2.5 py-1 rounded-full text-[11px] font-extrabold"
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
          <p className="text-[10px] text-center mt-3" style={{ color: '#a0937c' }}>
            1 geste = 1 action · 1 check-in · 1 quiz répondu
          </p>
        </div>
      ) : (
        <div className="rounded-[22px] bg-white p-6 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <p className="text-2xl mb-2">🌅</p>
          <p className="text-sm" style={{ color: '#a0937c' }}>La quinzaine commence, personne n&apos;a encore posté.</p>
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
