'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { AlertCircle, Plus, Flame, Trophy } from 'lucide-react'
import { useCountUp } from '@/lib/useCountUp'
import { MARKERS, getCurrentLevelIndex, getProgress } from '@/lib/axeHelpers'
import QuickAddAction from '@/app/components/QuickAddAction'
import QuickCheckin from '@/app/components/QuickCheckin'
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
  dyn: { label: string; icon: string; color: string }
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
}: Props) {
  const router = useRouter()
  const [currentSlide, setCurrentSlide] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickCheckinOpen, setQuickCheckinOpen] = useState(false)

  // Compteurs animes
  const animatedActions = useCountUp(totalActions)
  const animatedDelta = useCountUp(deltaActionsThisWeek)

  // Auto-scroll carousel toutes les 3s
  useEffect(() => {
    if (axes.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % axes.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [axes.length])

  // Scroll programmatique
  useEffect(() => {
    if (!scrollRef.current || scrollRef.current.children.length === 0) return
    const firstCard = scrollRef.current.children[0] as HTMLElement
    if (!firstCard) return
    const cardWidth = firstCard.getBoundingClientRect().width
    const gap = 12
    scrollRef.current.scrollTo({
      left: currentSlide * (cardWidth + gap),
      behavior: 'smooth',
    })
  }, [currentSlide])

  // Barre de progression onboarding
  const doneCount = stepsData.filter((s) => s.done).length
  const pct = Math.round((doneCount / stepsData.length) * 100)

  // Recap hebdo visible lundi/mardi (jour 1-2)
  const dayOfWeek = new Date().getDay()
  const showRecap = (dayOfWeek === 1 || dayOfWeek === 2) && lastWeekActions > 0

  // Message d'encouragement
  const encouragement = getEncouragement(deltaActionsThisWeek, streak)

  return (
    <div className="space-y-4 pb-20 sm:pb-4">

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

      {/* Alerte check-in (visible ven->lun si pas encore fait) */}
      {!checkinDone && (
        <button
          onClick={() => setQuickCheckinOpen(true)}
          className="w-full rounded-xl px-4 py-3 flex items-center gap-3 bg-amber-50 border border-amber-300 text-left active:scale-[0.98] transition-transform"
        >
          <AlertCircle className="text-amber-600 shrink-0" size={20} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-amber-900 text-sm">Check-in en attente</p>
            <p className="text-xs text-amber-700">{checkinWeekLabel}</p>
          </div>
          <span className="btn-primary text-sm shrink-0 py-1.5 px-3">Faire</span>
        </button>
      )}

      {/* Barre de progression globale */}
      {pct < 100 && (
        <div className="card p-3">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-gray-700">Votre onboarding</p>
            <span className="text-xs font-bold text-indigo-600">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
            }} />
          </div>
          <div className="flex gap-3 mt-2">
            {stepsData.map((s, i) => (
              <span key={i} className={`text-[11px] ${s.done ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                {s.done ? '✓' : '○'} {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Bloc principal : 3 colonnes compactes ── */}
      <div className="card p-4">
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
            <span className="text-[11px] text-gray-400 mr-1">Meteo</span>
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

      {/* ── Carousel axes compact ── */}
      {axes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">Mes axes de progres</h2>
            {axesCount < 3 && (
              <Link href="/axes" className="text-xs text-indigo-600 hover:underline">
                + Ajouter
              </Link>
            )}
          </div>

          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1"
          >
            {axes.map((axe) => {
              const levelIdx = getCurrentLevelIndex(axe.completedCount)
              const progress = getProgress(axe.completedCount)
              const currentMarker = MARKERS[levelIdx]

              return (
                <Link
                  key={axe.id}
                  href={`/axes?index=${axe.index}`}
                  className="snap-center shrink-0 w-[80vw] max-w-[320px] rounded-2xl block hover:shadow-xl transition-all overflow-hidden"
                  style={{
                    background: levelIdx === 0
                      ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
                      : levelIdx === 1
                      ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)'
                      : levelIdx === 2
                      ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                      : levelIdx === 3
                      ? 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)'
                      : 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
                  }}
                >
                  <div className="p-4">
                    {/* Titre */}
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold shrink-0">
                        {axe.index + 1}
                      </span>
                      <p className="font-bold text-sm leading-snug line-clamp-1 flex-1 text-gray-800">{axe.subject}</p>
                    </div>

                    {/* Moyens / description */}
                    {axe.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{axe.description}</p>
                    )}

                    {/* Niveau actuel - hero */}
                    <div className="flex items-center justify-center mt-3 gap-2">
                      <span className="text-3xl drop-shadow-sm">{currentMarker.icon}</span>
                      <span className="text-sm font-bold text-gray-700">{axe.dyn.label}</span>
                    </div>

                    {/* Piste de progression avec jalons */}
                    <div className="relative mt-3 mx-1">
                      {/* Barre de fond */}
                      <div className="h-2 bg-white/50 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${progress}%`,
                            background: levelIdx === 0
                              ? '#94a3b8'
                              : levelIdx === 1
                              ? '#38bdf8'
                              : levelIdx === 2
                              ? '#34d399'
                              : levelIdx === 3
                              ? '#fb923c'
                              : '#f472b6',
                          }}
                        />
                      </div>
                      {/* Jalons sur la barre */}
                      <div className="flex justify-between absolute inset-x-0 -top-1.5">
                        {MARKERS.map((m, i) => {
                          const reached = i <= levelIdx
                          const isCurrent = i === levelIdx
                          return (
                            <div
                              key={i}
                              className={`flex items-center justify-center rounded-full transition-all ${
                                isCurrent
                                  ? 'w-5 h-5 -mt-0 bg-white shadow-md ring-2 ring-current/40 text-sm z-10'
                                  : reached
                                  ? 'w-4 h-4 mt-0.5 bg-white/90 shadow-sm text-[11px]'
                                  : 'w-4 h-4 mt-0.5 bg-white/40 text-[11px]'
                              }`}
                            >
                              <span className={reached ? '' : 'opacity-30 grayscale text-[10px]'}>{m.icon}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Compteur actions */}
                    <p className="text-center text-xs font-semibold text-gray-600 mt-3">
                      {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
                      {axe.completedCount < 9 && (
                        <span className="font-normal text-gray-400"> · encore {9 - axe.completedCount} pour 🚀</span>
                      )}
                    </p>
                  </div>

                  {/* Footer : likes/commentaires + dernière action */}
                  {(axe.likesCount > 0 || axe.commentsCount > 0 || axe.lastAction) && (
                    <div className="bg-white/50 px-4 py-2.5 border-t border-white/60">
                      {/* Likes + commentaires */}
                      {(axe.likesCount > 0 || axe.commentsCount > 0) && (
                        <div className="flex items-center justify-center gap-5 text-sm">
                          {axe.likesCount > 0 && (
                            <span className="flex items-center gap-1 text-pink-500 font-semibold">❤️ {axe.likesCount}</span>
                          )}
                          {axe.commentsCount > 0 && (
                            <span className="flex items-center gap-1 text-indigo-500 font-semibold">💬 {axe.commentsCount}</span>
                          )}
                        </div>
                      )}

                      {/* Derniere action */}
                      {axe.lastAction && (
                        <p className={`text-xs text-gray-500 line-clamp-1 ${(axe.likesCount > 0 || axe.commentsCount > 0) ? 'mt-1.5' : ''}`}>
                          <span className="font-medium text-gray-600">Derniere :</span> {axe.lastAction.description}
                          <span className="text-gray-400"> · {new Date(axe.lastAction.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                        </p>
                      )}
                    </div>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Dots indicateurs */}
          {axes.length > 1 && (
            <div className="flex justify-center gap-1">
              {axes.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSlide % axes.length ? 'w-3.5 bg-indigo-500' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* FAB -- Bouton flottant "Ajouter une action" (mobile) */}
      {axes.length > 0 && (
        <button
          onClick={() => setQuickAddOpen(true)}
          className="fixed bottom-20 right-4 sm:hidden z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
            boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)',
          }}
          title="Ajouter une action"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
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
  )
}
