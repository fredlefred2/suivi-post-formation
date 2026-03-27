'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AlertCircle, Plus, Flame, Trophy } from 'lucide-react'
import { useCountUp } from '@/lib/useCountUp'
import { MARKERS, getCurrentLevelIndex, getProgress } from '@/lib/axeHelpers'
import QuickAddAction from '@/app/components/QuickAddAction'
import QuickCheckin from '@/app/components/QuickCheckin'
import WeeklyChallenge from '@/app/components/WeeklyChallenge'
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
    <div className="space-y-3 pb-20 sm:pb-4">

      {/* En-tete + message contextuel */}
      <div>
        <h1 className="page-title">Bonjour {firstName} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">{encouragement}</p>
      </div>

      {/* Recap semaine derniere (lundi/mardi) */}
      {showRecap && (
        <div className="rounded-xl px-4 py-2.5 flex items-center gap-3 bg-indigo-50 border border-indigo-200">
          <span className="text-base">📊</span>
          <p className="text-sm text-indigo-800">
            <span className="font-semibold">Semaine derniere :</span> +{lastWeekActions} action{lastWeekActions > 1 ? 's' : ''}
            {streak > 1 && <span> · 🔥 {streak} semaines d&apos;affilée</span>}
          </p>
        </div>
      )}

      {/* Alerte check-in compact (visible ven->lun si pas encore fait) */}
      {!checkinDone && (
        <button
          onClick={() => setQuickCheckinOpen(true)}
          className="w-full rounded-xl px-4 py-2.5 flex items-center gap-3 bg-amber-50 border border-amber-300 text-left active:scale-[0.98] transition-transform"
        >
          <AlertCircle className="text-amber-600 shrink-0" size={18} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 text-sm">Check-in en attente</p>
            <p className="text-[11px] text-amber-700">{checkinWeekLabel}</p>
          </div>
          <span className="btn-primary text-sm shrink-0 py-1.5 px-3">Faire</span>
        </button>
      )}

      {/* Barre de progression globale */}
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

      {/* ── Bloc principal : 3 colonnes compactes ── */}
      <div className="card p-4" data-onboarding="checkin-area">
        <div className="grid grid-cols-3 gap-3">

          {/* Colonne 1 : Cette semaine */}
          <Link href="/axes" className="text-center group">
            <div className={`text-3xl font-black ${deltaActionsThisWeek > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">cette semaine</p>
          </Link>

          {/* Colonne 2 : Total actions */}
          <Link href="/axes" className="text-center group">
            <div className="text-3xl font-black text-gray-800">
              {animatedActions}
            </div>
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
          <Link href="/checkin" className="text-center group">
            <div className="text-3xl font-black text-gray-800">
              {totalCheckins}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">check-ins</p>
            {streak >= 2 && (
              <div className="flex items-center justify-center gap-0.5 mt-1">
                <Flame size={11} className="text-orange-500" />
                <span className="text-[11px] font-bold text-orange-600">{streak} sem.</span>
              </div>
            )}
          </Link>

        </div>

        {/* Frise meteo */}
        {weatherHistory.length > 0 && (
          <Link href="/checkin" className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500 mr-1">Meteo</span>
            {weatherHistory.map((w, i) => (
              <span
                key={i}
                className={`text-xl transition-all ${i === weatherHistory.length - 1 ? 'text-2xl' : 'opacity-50'}`}
              >
                {WEATHER_ICONS[w] ?? '❓'}
              </span>
            ))}
            {weatherHistory.length < 4 && (
              <span className="text-gray-200 text-lg ml-0.5">{'· '.repeat(4 - weatherHistory.length)}</span>
            )}
          </Link>
        )}
      </div>

      {/* ── Bouton Nouvelle Action (pleine largeur dans le flow) ── */}
      {axes.length > 0 && (
        <button
          data-onboarding="fab-action"
          onClick={() => setQuickAddOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-[15px] font-bold text-white active:scale-[0.97] transition-transform"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
            boxShadow: '0 4px 15px rgba(79, 70, 229, 0.35)',
          }}
        >
          <Plus size={20} strokeWidth={2.5} />
          Nouvelle action
        </button>
      )}

      {/* ── Empty state : aucun axe ── */}
      {axes.length === 0 && totalActions === 0 && (
        <Link href="/axes" className="card p-5 text-center border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 transition-colors">
          <p className="text-2xl mb-2">👣</p>
          <p className="text-sm font-semibold text-gray-800">Commence ton parcours !</p>
          <p className="text-xs text-gray-500 mt-1">Cr&eacute;e ton premier axe de progr&egrave;s</p>
        </Link>
      )}

      {/* ── Axes pleine largeur, empilés ── */}
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

            return (
              <Link
                key={axe.id}
                href={`/axes?index=${axe.index}`}
                {...(axe.index === 0 ? { 'data-onboarding': 'progression' } : {})}
                className="block rounded-2xl overflow-hidden hover:shadow-lg transition-shadow"
                style={{ background: LEVEL_GRADIENTS[levelIdx] ?? LEVEL_GRADIENTS[0] }}
              >
                <div className="p-4">
                  {/* Titre */}
                  <div className="flex items-start gap-2">
                    <span className="w-6 h-6 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                      {axe.index + 1}
                    </span>
                    <p className="font-bold text-sm leading-snug line-clamp-2 flex-1 text-gray-800">{axe.subject}</p>
                  </div>

                  {/* Barre de progression */}
                  <div className="mt-3 flex items-center gap-2.5">
                    <span className="text-lg">{currentMarker.icon}</span>
                    <div className="flex-1">
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${progress}%`,
                            background: LEVEL_BAR_COLORS[levelIdx] ?? LEVEL_BAR_COLORS[0],
                          }}
                        />
                      </div>
                    </div>
                    <span className={`text-lg ${levelIdx >= 4 ? '' : 'opacity-30'}`}>🚀</span>
                  </div>

                  {/* Niveau + compteur */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-xs font-semibold ${axe.dyn.color.split(' ')[0]}`}>{axe.dyn.label}</span>
                    <span className="text-xs text-gray-500">
                      {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
                      {axe.completedCount === 0 && (
                        <span className={`font-medium ml-1 ${axe.dyn.color.split(' ')[0]}`}>· commence !</span>
                      )}
                      {axe.completedCount > 0 && axe.completedCount < 9 && (
                        <span className={`font-medium ml-1 ${axe.dyn.color.split(' ')[0]}`}>· encore {axe.dyn.delta} pour {MARKERS[levelIdx + 1]?.icon}</span>
                      )}
                    </span>
                  </div>

                  {/* Feedback */}
                  {(axe.likesCount > 0 || axe.commentsCount > 0) && (
                    <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/50">
                      {axe.likesCount > 0 && <span className="text-xs text-pink-500 font-semibold">❤️ {axe.likesCount}</span>}
                      {axe.commentsCount > 0 && <span className="text-xs text-gray-500 font-semibold">💬 {axe.commentsCount}</span>}
                    </div>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* ── Conseil du coach (après les axes) ── */}
      <WeeklyChallenge />

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
  )
}
