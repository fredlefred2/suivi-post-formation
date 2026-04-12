'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Plus } from 'lucide-react'
import { useCountUp } from '@/lib/useCountUp'
import { MARKERS, getCurrentLevelIndex, getProgress } from '@/lib/axeHelpers'
import QuickAddAction from '@/app/components/QuickAddAction'
import QuickCheckin from '@/app/components/QuickCheckin'
import { TipProvider, AxeTipBadge } from '@/app/components/WeeklyChallenge'
import { useRouter } from 'next/navigation'

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}

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

function getEncouragement(delta: number, streak: number): string {
  if (streak >= 3) return 'Tu es sur une lancée !'
  if (delta >= 3) return 'Semaine productive !'
  if (delta >= 1) return 'Bon début, continue !'
  return "C'est le moment de s'y mettre !"
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

  // Compteurs animes
  const animatedActions = useCountUp(totalActions)
  const animatedDelta = useCountUp(deltaActionsThisWeek)

  // Barre de progression onboarding
  const doneCount = stepsData.filter((s) => s.done).length
  const pct = Math.round((doneCount / stepsData.length) * 100)

  // Recap hebdo visible lundi/mardi (jour 1-2)
  const dayOfWeek = new Date().getDay()
  const showRecap = (dayOfWeek === 1 || dayOfWeek === 2) && lastWeekActions > 0

  // Message d'encouragement
  const encouragement = getEncouragement(deltaActionsThisWeek, streak)

  return (
    <TipProvider>
      <div className="space-y-3 pb-20 sm:pb-4">

        {/* ── 1. Header navy — Cream & Warm ── */}
        <div
          className="rounded-[28px] p-5 relative overflow-hidden"
          data-onboarding="checkin-area"
          style={{ background: '#1a1a2e' }}
        >
          {/* Cercle décoratif amber */}
          <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />

          {/* Ligne 1 : Bonjour + dernière météo */}
          <div className="relative flex items-start justify-between mb-4">
            <div>
              <h1 className="text-[22px] font-extrabold text-white">Bonjour {firstName} 👋</h1>
              <p className="text-[13px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{encouragement}</p>
            </div>
            {weatherHistory.length > 0 && (
              <Link href="/checkin" className="flex flex-col items-center">
                <span className="text-3xl drop-shadow-lg">
                  {WEATHER_ICONS[weatherHistory[weatherHistory.length - 1]] ?? '❓'}
                </span>
                <span className="text-[9px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>ma météo</span>
              </Link>
            )}
          </div>

          {/* Stats en 3 colonnes */}
          <div className="relative grid grid-cols-3 gap-2">
            {/* Cette semaine */}
            <Link href="/axes" className="rounded-2xl py-3 px-2 text-center transition-colors" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="font-display text-[26px] font-bold" style={{ color: deltaActionsThisWeek > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
              </div>
              <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>cette sem.</p>
            </Link>

            {/* Total actions */}
            <Link href="/axes" className="rounded-2xl py-3 px-2 text-center transition-colors" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="font-display text-[26px] font-bold text-white">{animatedActions}</div>
              <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>actions</p>
              {rank && rank <= 3 && groupSize && groupSize > 1 && (
                <p className="text-[10px] font-bold mt-0.5" style={{ color: '#fbbf24' }}>
                  {rank === 1 ? '1er' : rank === 2 ? '2e' : '3e'} du groupe
                </p>
              )}
            </Link>

            {/* Check-ins + streak */}
            <Link href="/checkin" className="rounded-2xl py-3 px-2 text-center transition-colors" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="font-display text-[26px] font-bold text-white">{totalCheckins}</div>
              <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>check-ins</p>
              {streak >= 2 && (
                <p className="text-[10px] font-bold mt-0.5" style={{ color: '#fbbf24' }}>
                  🔥 {streak} sem.
                </p>
              )}
            </Link>
          </div>
        </div>

        {/* ── 2. Check-in compact 1 ligne ── */}
        {!checkinDone && (
          <button
            onClick={() => setQuickCheckinOpen(true)}
            className="w-full rounded-[18px] px-4 py-3 flex items-center gap-3 bg-white text-left active:scale-[0.98] transition-transform"
            style={{ border: '2px solid #f0ebe0' }}
          >
            <span className="text-base">⚡</span>
            <p className="font-semibold text-[13px] flex-1 truncate" style={{ color: '#92400e' }}>Check-in en attente · {checkinWeekLabel}</p>
            <span className="btn-navy text-xs shrink-0 py-1.5 px-4 rounded-xl">Faire</span>
          </button>
        )}

        {/* Recap semaine derniere (lundi/mardi) */}
        {showRecap && (
          <div className="rounded-[18px] px-4 py-3 flex items-center gap-3 bg-white" style={{ border: '2px solid #f0ebe0' }}>
            <span className="text-sm">📊</span>
            <p className="text-xs" style={{ color: '#1a1a2e' }}>
              <span className="font-bold">Sem. dernière :</span> +{lastWeekActions} action{lastWeekActions > 1 ? 's' : ''}
              {streak > 1 && <span> · 🔥 {streak} sem.</span>}
            </p>
          </div>
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

        {/* ── 3. Bouton Nouvelle Action ── */}
        {axes.length > 0 && (
          <button
            data-onboarding="fab-action"
            onClick={() => setQuickAddOpen(true)}
            className="w-full flex flex-col items-center justify-center gap-0.5 py-4 rounded-[18px] active:scale-[0.97] transition-transform"
            style={{
              background: '#fbbf24',
              color: '#1a1a2e',
              boxShadow: '0 4px 20px rgba(251, 191, 36, 0.3)',
            }}
          >
            <span className="flex items-center gap-2 text-[15px] font-bold">
              <Plus size={20} strokeWidth={2.5} />
              Nouvelle action
            </span>
            {deltaActionsThisWeek > 0 ? (
              <span className="text-[11px]" style={{ color: 'rgba(26,26,46,0.6)' }}>
                Tu en as fait {deltaActionsThisWeek} cette semaine
              </span>
            ) : (
              <span className="text-[11px]" style={{ color: 'rgba(26,26,46,0.6)' }}>
                Lance-toi, 1 action suffit !
              </span>
            )}
          </button>
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

                    {/* ── Tip intégré dans la carte de l'axe ── */}
                    <AxeTipBadge axeId={axe.id} />
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
      </div>
    </TipProvider>
  )
}
