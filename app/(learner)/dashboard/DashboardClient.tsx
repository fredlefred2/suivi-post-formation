'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Plus, Flame, Trophy } from 'lucide-react'
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
}

function getEncouragement(delta: number, streak: number): string {
  if (streak >= 3) return 'Tu es sur une lancee !'
  if (delta >= 3) return 'Semaine productive !'
  if (delta >= 1) return 'Bon debut, continue !'
  return "C'est le moment de s'y mettre !"
}

// Gradients par niveau
const LEVEL_GRADIENTS = [
  'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)', // violet — Veille
  'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', // blue — Impulsion
  'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)', // green — Rythme
  'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)', // orange — Intensité
  'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)', // rose — Propulsion
]

const LEVEL_BAR_COLORS = ['#a78bfa', '#38bdf8', '#34d399', '#fb923c', '#f472b6']

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

        {/* ── 1. Header + Stats fusionnés ── */}
        <div className="card p-4" data-onboarding="checkin-area">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-extrabold text-gray-900">Bonjour {firstName} 👋</h1>
              <p className="text-xs text-gray-500 mt-0.5">{encouragement}</p>
            </div>
            {/* Micro météo dans le header */}
            {weatherHistory.length > 0 && (
              <Link href="/checkin" className="flex items-center gap-0.5">
                {weatherHistory.slice(-4).map((w, i, arr) => (
                  <span
                    key={i}
                    className={`transition-all ${i === arr.length - 1 ? 'text-xl' : 'text-sm opacity-40'}`}
                  >
                    {WEATHER_ICONS[w] ?? '❓'}
                  </span>
                ))}
              </Link>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {/* Colonne 1 : Cette semaine */}
            <Link href="/axes">
              <div className={`text-3xl font-black ${deltaActionsThisWeek > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
                {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">cette semaine</p>
            </Link>

            {/* Colonne 2 : Total actions */}
            <Link href="/axes">
              <div className="text-3xl font-black text-gray-800">{animatedActions}</div>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">actions</p>
              {rank && rank <= 3 && groupSize && groupSize > 1 && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <Trophy size={11} className="text-amber-500" />
                  <span className="text-[11px] font-bold text-amber-600">
                    {rank === 1 ? '🥇 1er' : rank === 2 ? '🥈 2e' : '🥉 3e'}
                  </span>
                </div>
              )}
            </Link>

            {/* Colonne 3 : Check-ins + streak */}
            <Link href="/checkin">
              <div className="text-3xl font-black text-gray-800">{totalCheckins}</div>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">check-ins</p>
              {streak >= 2 && (
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  <Flame size={11} className="text-orange-500" />
                  <span className="text-[11px] font-bold text-orange-600">{streak} sem.</span>
                </div>
              )}
            </Link>
          </div>
        </div>

        {/* ── 2. Check-in compact 1 ligne ── */}
        {!checkinDone && (
          <button
            onClick={() => setQuickCheckinOpen(true)}
            className="w-full rounded-xl px-3 py-2 flex items-center gap-2 bg-amber-50 border border-amber-300 text-left active:scale-[0.98] transition-transform"
          >
            <AlertCircle className="text-amber-600 shrink-0" size={16} />
            <p className="font-semibold text-amber-900 text-xs flex-1 truncate">Check-in en attente · {checkinWeekLabel}</p>
            <span className="btn-primary text-xs shrink-0 py-1 px-2.5">Faire</span>
          </button>
        )}

        {/* Recap semaine derniere (lundi/mardi) */}
        {showRecap && (
          <div className="rounded-xl px-3 py-2 flex items-center gap-2 bg-indigo-50 border border-indigo-200">
            <span className="text-sm">📊</span>
            <p className="text-xs text-indigo-800">
              <span className="font-semibold">Sem. derniere :</span> +{lastWeekActions} action{lastWeekActions > 1 ? 's' : ''}
              {streak > 1 && <span> · 🔥 {streak} sem.</span>}
            </p>
          </div>
        )}

        {/* Barre de progression onboarding */}
        {pct < 100 && (
          <div className="card p-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-gray-700">Votre onboarding</p>
              <span className="text-xs font-bold text-gray-900">{pct}%</span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
              }} />
            </div>
            <div className="flex gap-3 mt-2">
              {stepsData.map((s, i) => (
                <span key={i} className={`text-[11px] ${s.done ? 'text-emerald-600 font-medium' : 'text-gray-500'}`}>
                  {s.done ? '✓' : '○'} {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── 3. Bouton Nouvelle Action dans le flow ── */}
        {axes.length > 0 && (
          <button
            data-onboarding="fab-action"
            onClick={() => setQuickAddOpen(true)}
            className="w-full flex flex-col items-center justify-center gap-0.5 py-3 rounded-2xl text-white active:scale-[0.97] transition-transform"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
              boxShadow: '0 4px 15px rgba(79, 70, 229, 0.35)',
            }}
          >
            <span className="flex items-center gap-2 text-[15px] font-bold">
              <Plus size={20} strokeWidth={2.5} />
              Nouvelle action
            </span>
            {deltaActionsThisWeek > 0 ? (
              <span className="text-[11px] text-white/70">
                Tu en as fait {deltaActionsThisWeek} cette semaine
              </span>
            ) : (
              <span className="text-[11px] text-white/70">
                Lance-toi, 1 action suffit !
              </span>
            )}
          </button>
        )}

        {/* ── Empty state ── */}
        {axes.length === 0 && totalActions === 0 && (
          <Link href="/axes" className="card p-5 text-center border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
            <p className="text-2xl mb-2">👣</p>
            <p className="text-sm font-semibold text-gray-800">Commence ton parcours !</p>
            <p className="text-xs text-gray-500 mt-1">Cr&eacute;e ton premier axe de progr&egrave;s</p>
          </Link>
        )}

        {/* ── 4. Axes pleine largeur avec densité variable ── */}
        {axes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-700">Mes axes de progres</h2>
              {axesCount < 3 && (
                <Link href="/axes" className="text-xs text-indigo-600 hover:underline font-semibold">
                  + Ajouter
                </Link>
              )}
            </div>

            {axes.map((axe) => {
              const levelIdx = getCurrentLevelIndex(axe.completedCount)
              const progress = getProgress(axe.completedCount)
              const currentMarker = MARKERS[levelIdx]
              const isVeille = levelIdx === 0
              const isHigh = levelIdx >= 3

              return (
                <Link
                  key={axe.id}
                  href={`/axes?index=${axe.index}`}
                  {...(axe.index === 0 ? { 'data-onboarding': 'progression' } : {})}
                  className={`block rounded-2xl overflow-hidden transition-shadow ${
                    isVeille ? 'opacity-80 hover:opacity-100' : ''
                  } ${isHigh ? 'hover:shadow-xl' : 'hover:shadow-lg'}`}
                  style={{
                    background: LEVEL_GRADIENTS[levelIdx] ?? LEVEL_GRADIENTS[0],
                    ...(isHigh ? { boxShadow: `0 0 20px ${LEVEL_BAR_COLORS[levelIdx]}25` } : {}),
                  }}
                >
                  <div className={isVeille ? 'p-3' : 'p-4'}>
                    {/* Titre */}
                    <div className="flex items-start gap-2">
                      <span className="w-6 h-6 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                        {axe.index + 1}
                      </span>
                      <p className={`font-bold leading-snug line-clamp-2 flex-1 text-gray-800 ${isVeille ? 'text-[13px]' : 'text-sm'}`}>
                        {axe.subject}
                      </p>
                    </div>

                    {/* Barre de progression */}
                    <div className={`flex items-center gap-2.5 ${isVeille ? 'mt-2' : 'mt-3'}`}>
                      <span className={isVeille ? 'text-base' : 'text-lg'}>{currentMarker.icon}</span>
                      <div className="flex-1">
                        <div className={`bg-white/60 rounded-full overflow-hidden ${isHigh ? 'h-2' : 'h-1.5'}`}>
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{
                              width: `${progress}%`,
                              background: LEVEL_BAR_COLORS[levelIdx] ?? LEVEL_BAR_COLORS[0],
                            }}
                          />
                        </div>
                      </div>
                      <span className={`${isVeille ? 'text-base' : 'text-lg'} ${levelIdx >= 4 ? '' : 'opacity-30'}`}>🚀</span>
                    </div>

                    {/* Niveau + compteur + likes/comments inline */}
                    <div className={`flex items-center justify-between ${isVeille ? 'mt-1.5' : 'mt-2'}`}>
                      <span className={`text-xs font-semibold ${axe.dyn.color.split(' ')[0]}`}>{axe.dyn.label}</span>
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
                        {axe.completedCount === 0 && (
                          <span className={`font-medium ${axe.dyn.color.split(' ')[0]}`}>· commence !</span>
                        )}
                        {axe.completedCount > 0 && axe.completedCount < 9 && (
                          <span className={`font-medium ${axe.dyn.color.split(' ')[0]}`}>· encore {axe.dyn.delta} pour {MARKERS[levelIdx + 1]?.icon}</span>
                        )}
                        {/* Micro-badges likes/comments */}
                        {axe.likesCount > 0 && <span className="text-pink-500 font-semibold ml-1">❤️{axe.likesCount}</span>}
                        {axe.commentsCount > 0 && <span className="text-gray-400 font-semibold">💬{axe.commentsCount}</span>}
                      </span>
                    </div>

                    {/* ── 5. Tip intégré dans la carte de l'axe ── */}
                    <AxeTipBadge axeId={axe.id} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* Quick Add Action Modal */}
        <QuickAddAction
          axes={axes.map(a => ({ id: a.id, subject: a.subject, completedCount: a.completedCount }))}
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onSuccess={() => router.refresh()}
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
