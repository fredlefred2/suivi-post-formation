'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { AlertCircle, CalendarCheck, Zap, TrendingUp } from 'lucide-react'
import { useCountUp } from '@/lib/useCountUp'
import { formatWeek } from '@/lib/utils'
import { MARKERS, getCurrentLevelIndex, getProgress, getCurrentLevel } from '@/lib/axeHelpers'

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}

type AxeItem = {
  id: string
  index: number
  subject: string
  completedCount: number
  dyn: { label: string; icon: string; color: string }
}

type Props = {
  firstName: string
  week: number
  year: number
  checkinDone: boolean
  totalCheckins: number
  expectedCheckins: number
  totalActions: number
  deltaActionsThisWeek: number
  lastWeather: string | null
  axesCount: number
  axes: AxeItem[]
  stepsData: { label: string; done: boolean }[]
}

export default function DashboardClient({
  firstName,
  week,
  year,
  checkinDone,
  totalCheckins,
  expectedCheckins,
  totalActions,
  deltaActionsThisWeek,
  lastWeather,
  axesCount,
  axes,
  stepsData,
}: Props) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Compteurs animés
  const animatedCheckins = useCountUp(totalCheckins)
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
    const gap = 16
    scrollRef.current.scrollTo({
      left: currentSlide * (cardWidth + gap),
      behavior: 'smooth',
    })
  }, [currentSlide])

  // Barre de progression
  const doneCount = stepsData.filter((s) => s.done).length
  const pct = Math.round((doneCount / stepsData.length) * 100)

  const weatherEmoji = lastWeather ? WEATHER_ICONS[lastWeather] ?? '❓' : null

  return (
    <div className="space-y-6 pb-4">

      {/* En-tête */}
      <div>
        <h1 className="page-title">Bonjour {firstName} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">{formatWeek(week, year)}</p>
      </div>

      {/* Alerte check-in */}
      {!checkinDone && (
        <div className="rounded-xl p-4 flex items-center gap-4 bg-amber-100 border border-amber-300">
          <AlertCircle className="text-amber-600 shrink-0" size={24} />
          <div className="flex-1">
            <p className="font-medium text-amber-900">Check-in de la semaine en attente</p>
            <p className="text-sm text-amber-700">Prenez 2 minutes pour faire le point</p>
          </div>
          <Link href="/checkin" className="btn-primary shrink-0">Faire</Link>
        </div>
      )}

      {/* Barre de progression globale */}
      {pct < 100 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Votre onboarding</p>
            <span className="text-xs font-bold text-indigo-600">{pct}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7)',
            }} />
          </div>
          <div className="flex gap-4 mt-2.5">
            {stepsData.map((s, i) => (
              <span key={i} className={`text-xs ${s.done ? 'text-emerald-600 font-medium' : 'text-gray-400'}`}>
                {s.done ? '✓' : '○'} {s.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Bloc 1 : Check-ins + Dernière météo ── */}
      <Link href="/checkin" className="card py-5 px-4 block hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {/* Check-ins */}
          <div className="text-center px-2">
            <CalendarCheck size={28} className="mx-auto text-emerald-500 mb-1.5" />
            <p className="text-3xl font-bold text-gray-800">
              {animatedCheckins}
              {expectedCheckins > 0 && <span className="text-sm font-normal text-gray-400">/{expectedCheckins}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Check-ins</p>
          </div>
          {/* Dernière météo */}
          <div className="text-center px-2 flex flex-col items-center justify-center">
            {weatherEmoji ? (
              <>
                <p className="text-xs text-gray-500 mb-2">Dernière météo</p>
                <span className="text-6xl leading-none">{weatherEmoji}</span>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">Dernière météo</p>
                <span className="text-5xl text-gray-300">-</span>
                <p className="text-[11px] text-gray-400 mt-1">Pas de check-in</p>
              </>
            )}
          </div>
        </div>
      </Link>

      {/* ── Bloc 2 : Actions + Delta cette semaine ── */}
      <Link href="/axes" className="card py-5 px-4 block hover:border-amber-300 hover:bg-amber-50/40 transition-colors">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {/* Total actions */}
          <div className="text-center px-2">
            <Zap size={28} className="mx-auto text-amber-500 mb-1.5" />
            <p className="text-3xl font-bold text-gray-800">{animatedActions}</p>
            <p className="text-xs text-gray-500 mt-0.5">Actions menées</p>
          </div>
          {/* Delta cette semaine */}
          <div className="text-center px-2">
            <TrendingUp size={28} className={`mx-auto ${deltaActionsThisWeek > 0 ? 'text-emerald-500' : 'text-gray-400'} mb-1.5`} />
            <p className={`text-3xl font-bold ${deltaActionsThisWeek > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Cette semaine</p>
          </div>
        </div>
      </Link>

      {/* ── Carousel axes auto-scroll ── */}
      {axes.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Mes actions de progrès</h2>
            {axesCount < 3 && (
              <Link href="/axes" className="text-sm text-indigo-600 hover:underline">
                + Ajouter
              </Link>
            )}
          </div>

          <div
            ref={scrollRef}
            className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
          >
            {axes.map((axe) => {
              const progress = getProgress(axe.completedCount)
              const levelIdx = getCurrentLevelIndex(axe.completedCount)
              const level = getCurrentLevel(axe.completedCount)

              return (
                <Link
                  key={axe.id}
                  href={`/axes?index=${axe.index}`}
                  className={`snap-center shrink-0 w-[78vw] max-w-[320px] rounded-2xl border-2 p-4 block hover:shadow-lg transition-all ${axe.dyn.color}`}
                >
                  {/* Ligne 1 : numéro + titre */}
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-full bg-white/60 border border-current/20 flex items-center justify-center text-base font-bold shrink-0 mt-0.5">
                      {axe.index + 1}
                    </span>
                    <p className="font-bold text-base leading-snug line-clamp-2 flex-1">{axe.subject}</p>
                  </div>

                  {/* Ligne 2 : actions + niveau */}
                  <div className="flex items-center gap-2 mt-3">
                    <span className="text-sm font-semibold">
                      {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-sm bg-white/60">{level.icon}</span>
                    <span className="text-sm font-medium opacity-80">
                      Niveau {level.label}
                    </span>
                  </div>

                  {/* Barre de progression */}
                  <div className="mt-3 relative">
                    <div className="h-3 bg-white/60 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-current opacity-60 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <div className="relative h-5 mt-0.5">
                      {MARKERS.map((m, i) => (
                        <span
                          key={i}
                          className={`absolute -translate-x-1/2 text-sm ${i <= levelIdx ? 'opacity-100' : 'opacity-25'}`}
                          style={{ left: `${m.pos * 100}%` }}
                        >
                          {m.icon}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Dots indicateurs */}
          {axes.length > 1 && (
            <div className="flex justify-center gap-1 mt-1">
              {axes.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSlide % axes.length ? 'w-4 bg-indigo-500' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
