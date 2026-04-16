'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { useCountUp } from '@/lib/useCountUp'
import { MARKERS, getCurrentLevelIndex, getProgress } from '@/lib/axeHelpers'
import QuickAddAction from '@/app/components/QuickAddAction'
import QuickCheckin from '@/app/components/QuickCheckin'
import { TipProvider } from '@/app/components/WeeklyChallenge'
import DashboardIcons from '@/app/components/DashboardIcons'
import OpenAppPrompt from '@/app/components/OpenAppPrompt'
import { useRouter } from 'next/navigation'

type AxeItem = {
  id: string
  index: number
  subject: string
  description: string | null
  completedCount: number
  dyn: { label: string; icon: string; color: string; delta: number }
  likesCount: number
  commentsCount: number
  lastAction: { description: string; date: string } | null
}

type Props = {
  firstName: string
  checkinDone: boolean
  checkinWeekLabel: string
  totalCheckins: number
  totalActions: number
  deltaActionsThisWeek: number
  weatherHistory: string[]
  axesCount: number
  axes: AxeItem[]
  stepsData: { label: string; done: boolean }[]
  streak: number
  rank: number | null
  groupSize: number | null
  lastWeekActions: number
  checkinIsOpen: boolean
  axesForCheckin: { id: string; initial_score: number }[]
  groupTheme: string | null
}

// Couleurs de barre par niveau — warm palette
const LEVEL_BAR_COLORS = ['#94a3b8', '#38bdf8', '#10b981', '#f59e0b', '#fb7185']
const LEVEL_BAR_GRADIENTS = [
  'linear-gradient(90deg, #94a3b8, #cbd5e1)', // slate — Intention
  'linear-gradient(90deg, #0284c7, #38bdf8)', // sky — Essai
  'linear-gradient(90deg, #059669, #10b981)',  // green — Habitude
  'linear-gradient(90deg, #d97706, #f59e0b)',  // amber — Réflexe
  'linear-gradient(90deg, #e11d48, #fb7185)',  // rose — Maîtrise
]

export default function DashboardClient({
  firstName,
  checkinDone,
  checkinWeekLabel,
  totalCheckins,
  totalActions,
  deltaActionsThisWeek,
  weatherHistory,
  axesCount,
  axes,
  stepsData,
  streak,
  rank,
  groupSize,
  lastWeekActions,
  checkinIsOpen,
  axesForCheckin,
  groupTheme,
  onboardingStep,
}: Props & { onboardingStep?: string }) {
  const router = useRouter()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickCheckinOpen, setQuickCheckinOpen] = useState(false)
  const [tipAvailable, setTipAvailable] = useState(false)
  const [forceCoach, setForceCoach] = useState(false)

  // Fetch si un tip est dispo (pour la pastille 🎁 et l'orchestrateur)
  useEffect(() => {
    fetch('/api/tips')
      .then(r => r.ok ? r.json() : { tip: null })
      .then(data => setTipAvailable(!!data?.tip))
      .catch(() => {})
  }, [])

  // Compteurs animes
  const animatedActions = useCountUp(totalActions)
  const animatedDelta = useCountUp(deltaActionsThisWeek)

  // Barre de progression onboarding
  const doneCount = stepsData.filter((s) => s.done).length
  const pct = Math.round((doneCount / stepsData.length) * 100)


  return (
    <TipProvider>
      <div className="space-y-3 pb-20 sm:pb-4">

        {/* ── 1. Header navy compact — Option A ── */}
        <div
          className="rounded-[22px] px-[18px] py-[14px] relative overflow-hidden"
          data-onboarding="checkin-area"
          style={{ background: '#1a1a2e' }}
        >
          {/* Cercle décoratif amber */}
          <div className="absolute -top-4 -right-3 w-[70px] h-[70px] rounded-full" style={{ background: 'rgba(251,191,36,0.12)' }} />

          <div className="relative">
            <h1 className="text-[16px] font-extrabold text-white leading-tight">Salut {firstName} 👋</h1>
            <p className="text-[12px] mt-1 font-semibold flex items-center flex-wrap gap-x-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
              💪 <span style={{ color: '#fbbf24' }} className="font-extrabold">{animatedActions}</span> actions
              <span style={{ color: 'rgba(255,255,255,0.3)' }}> · </span>
              {deltaActionsThisWeek >= 0 ? (
                <>
                  <span style={{ color: deltaActionsThisWeek > 0 ? '#fbbf24' : 'rgba(255,255,255,0.7)' }} className="font-extrabold">
                    {deltaActionsThisWeek > 0 ? `+${animatedDelta}` : '0'}
                  </span>
                  <span>cette sem.</span>
                </>
              ) : null}
              {rank && rank <= 3 && groupSize && groupSize > 1 && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}> · </span>
                  🏆 <span style={{ color: '#fbbf24' }} className="font-extrabold">
                    {rank === 1 ? '1er' : rank === 2 ? '2e' : '3e'}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* ── 2. Les 4 icônes permanentes ── */}
        {axes.length > 0 && (
          <DashboardIcons
            axes={axes.map(a => ({ id: a.id, completedCount: a.completedCount }))}
            streak={streak}
            checkinAvailable={checkinIsOpen}
            checkinDone={checkinDone}
            tipAvailable={tipAvailable}
            quizAvailable={false}
            onAction={() => setQuickAddOpen(true)}
            onCheckin={() => setQuickCheckinOpen(true)}
            onCoach={() => setForceCoach(true)}
            onQuiz={() => { /* Phase 2 */ }}
          />
        )}

        {/* Barre de progression onboarding */}
        {pct < 100 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold" style={{ color: '#1a1a2e' }}>Votre onboarding</p>
              <span className="text-xs font-bold" style={{ color: '#1a1a2e' }}>{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f5f0e8' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${pct}%`,
                background: '#fbbf24',
              }} />
            </div>
            <div className="flex gap-3 mt-2">
              {stepsData.map((s, i) => (
                <span key={i} className={`text-[11px] ${s.done ? 'font-semibold' : ''}`} style={{ color: s.done ? '#059669' : '#a0937c' }}>
                  {s.done ? '✓' : '○'} {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {axes.length === 0 && totalActions === 0 && (
          <Link href="/axes" className="card p-5 text-center hover:shadow-warm-hover transition-shadow" style={{ border: '2px dashed #f0ebe0' }}>
            <p className="text-2xl mb-2">👣</p>
            <p className="text-sm font-bold" style={{ color: '#1a1a2e' }}>Commence ton parcours !</p>
            <p className="text-xs mt-1" style={{ color: '#a0937c' }}>Crée ton premier axe de progrès</p>
          </Link>
        )}

        {/* ── 4. Axes — cartes blanches bordure warm ── */}
        {axes.length > 0 && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Mes axes de progrès</h2>
              {axesCount < 3 && (
                <Link href="/axes" className="text-xs font-bold hover:underline" style={{ color: '#92400e' }}>
                  + Ajouter
                </Link>
              )}
            </div>

            {axes.map((axe) => {
              const levelIdx = getCurrentLevelIndex(axe.completedCount)
              const progress = getProgress(axe.completedCount)
              const currentMarker = MARKERS[levelIdx]

              return (
                <Link
                  key={axe.id}
                  href={`/axes?index=${axe.index}`}
                  {...(axe.index === 0 ? { 'data-onboarding': 'progression' } : {})}
                  className="block bg-white rounded-[22px] overflow-hidden transition-all hover:shadow-warm-hover"
                  style={{ border: '2px solid #f0ebe0' }}
                >
                  <div className="p-4">
                    {/* Titre avec numéro navy */}
                    <div className="flex items-start gap-2.5">
                      <span className="axe-num">{axe.index + 1}</span>
                      <p className="font-bold text-sm leading-snug line-clamp-2 flex-1" style={{ color: '#1a1a2e' }}>
                        {axe.subject}
                      </p>
                    </div>

                    {/* Barre de progression */}
                    <div className="flex items-center gap-2.5 mt-3.5">
                      <div className="bar-bg">
                        <div
                          className="bar-fill transition-all duration-700"
                          style={{
                            width: `${progress}%`,
                            background: LEVEL_BAR_GRADIENTS[levelIdx] ?? LEVEL_BAR_GRADIENTS[0],
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-bold whitespace-nowrap" style={{ color: '#1a1a2e' }}>
                        {axe.dyn.icon} {axe.dyn.label}
                      </span>
                    </div>

                    {/* Meta : compteur + likes/comments */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[11px]" style={{ color: '#a0937c' }}>
                        {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
                        {axe.completedCount === 0 && (
                          <span className="font-semibold" style={{ color: '#92400e' }}> · commence !</span>
                        )}
                        {axe.completedCount > 0 && axe.completedCount < 9 && (
                          <span className="font-semibold" style={{ color: '#92400e' }}> · encore {axe.dyn.delta} pour {MARKERS[levelIdx + 1]?.icon}</span>
                        )}
                      </span>
                      <span className="text-[11px] flex items-center gap-1">
                        {axe.likesCount > 0 && <span className="font-semibold" style={{ color: '#e11d48' }}>❤️ {axe.likesCount}</span>}
                        {axe.commentsCount > 0 && <span className="font-semibold" style={{ color: '#a0937c' }}>💬 {axe.commentsCount}</span>}
                      </span>
                    </div>

                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Quick Add Action Modal */}
        <QuickAddAction
          axes={axes.map(a => ({ id: a.id, subject: a.subject, description: a.description, completedCount: a.completedCount }))}
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onSuccess={() => router.refresh()}
          groupTheme={groupTheme}
        />

        {/* Quick Checkin Modal */}
        <QuickCheckin
          axes={axesForCheckin}
          weekLabel={checkinWeekLabel}
          streak={streak}
          open={quickCheckinOpen}
          onClose={() => setQuickCheckinOpen(false)}
          onSuccess={() => router.refresh()}
        />

        {/* Orchestrateur des fenêtres plein écran à l'ouverture */}
        <OpenAppPrompt
          firstName={firstName}
          checkinAvailable={checkinIsOpen}
          checkinDone={checkinDone}
          checkinWeekLabel={checkinWeekLabel}
          streak={streak}
          forceCoach={forceCoach}
          onOpenCheckin={() => setQuickCheckinOpen(true)}
          onOpenQuickAdd={() => setQuickAddOpen(true)}
          onTipRead={() => setTipAvailable(false)}
          onForceCoachConsumed={() => setForceCoach(false)}
        />
      </div>
    </TipProvider>
  )
}
