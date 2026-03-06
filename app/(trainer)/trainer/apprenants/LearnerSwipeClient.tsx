'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown, CalendarCheck, Zap, TrendingUp } from 'lucide-react'
import { formatWeek } from '@/lib/utils'
import { WEATHER_COLORS } from '@/lib/types'
import type { ActionFeedbackData } from '@/lib/types'
import LearnerAxesSection from '../learner/[id]/LearnerAxesSection'

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}

type ActionRow = { id: string; description: string; completed: boolean; created_at: string }
type CheckinRow = { id: string; learner_id: string; weather: string; week_number: number; year: number; created_at: string }

type AxeData = {
  id: string
  index: number
  subject: string
  description: string | null
  difficulty: string
  actions: ActionRow[]
}

type LearnerCardData = {
  id: string
  firstName: string
  lastName: string
  createdAt: string
  totalActions: number
  actionsThisWeek: number
  totalCheckins: number
  expectedCheckins: number
  lastWeather: string | null
  weatherCount: { sunny: number; cloudy: number; stormy: number }
  checkins: CheckinRow[]
  axes: AxeData[]
  feedbackMap: Record<string, ActionFeedbackData>
}

type GroupInfo = { id: string; name: string; count: number }

type Props = {
  learners: LearnerCardData[]
  groups: GroupInfo[]
  currentGroupId: string
  initialIndex: number
}

export default function LearnerSwipeClient({ learners, groups, currentGroupId, initialIndex }: Props) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentGroupName = groups.find((g) => g.id === currentGroupId)?.name
  const prevIndexRef = useRef(initialIndex)

  // ── Scroll detection (pattern AxesClient) ────────────────────────────────
  const handleScroll = useCallback(() => {
    const container = scrollRef.current
    if (!container || container.children.length === 0) return
    const containerRect = container.getBoundingClientRect()
    const containerCenter = containerRect.left + containerRect.width / 2
    let closestIndex = 0
    let closestDist = Infinity
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement
      const childRect = child.getBoundingClientRect()
      const childCenter = childRect.left + childRect.width / 2
      const dist = Math.abs(containerCenter - childCenter)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    }
    if (closestIndex !== prevIndexRef.current) {
      prevIndexRef.current = closestIndex
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    setCurrentIndex(closestIndex)
  }, [])

  // ── Scroll initial vers l'apprenant demandé ─────────────────────────────
  useEffect(() => {
    const container = scrollRef.current
    if (!container || learners.length === 0) return
    if (initialIndex > 0 && initialIndex < learners.length) {
      const card = container.children[initialIndex] as HTMLElement
      if (card) {
        card.scrollIntoView({ inline: 'center', block: 'nearest' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Click outside dropdown ───────────────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // ── Navigation par boutons ───────────────────────────────────────────────
  function scrollToIndex(idx: number) {
    const container = scrollRef.current
    if (container && container.children[idx]) {
      ;(container.children[idx] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      })
    }
  }

  if (learners.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-4xl mb-3">🌱</p>
        <p className="text-gray-500 font-medium">Aucun apprenant dans ce groupe.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">

      {/* ── Sélecteur de groupe ──────────────────────────────────────────── */}
      {groups.length > 1 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-colors shadow-sm min-w-[200px] justify-between ${
              dropdownOpen
                ? 'border-indigo-400 text-indigo-700 ring-2 ring-indigo-100'
                : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700'
            }`}
          >
            <span className="truncate">📊 {currentGroupName ?? 'Groupe'}</span>
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[220px]">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setDropdownOpen(false)
                    if (g.id !== currentGroupId) {
                      router.push(`/trainer/apprenants?group=${g.id}`)
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    g.id === currentGroupId ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    g.id === currentGroupId ? 'border-indigo-600' : 'border-gray-300'
                  }`}>
                    {g.id === currentGroupId && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                  </span>
                  <span className={`text-sm ${g.id === currentGroupId ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}>
                    {g.name}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{g.count} app.</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Barre de navigation : ← dots → ──────────────────────────────── */}
      {learners.length > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => currentIndex > 0 && scrollToIndex(currentIndex - 1)}
            disabled={currentIndex <= 0}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5">
            {learners.length <= 12
              ? learners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => scrollToIndex(i)}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      i === currentIndex
                        ? 'w-6 bg-indigo-500'
                        : 'w-2 bg-gray-300 hover:bg-gray-400'
                    }`}
                  />
                ))
              : (
                <span className="text-xs font-medium text-gray-500">
                  {currentIndex + 1} / {learners.length}
                </span>
              )
            }
          </div>

          <button
            onClick={() => currentIndex < learners.length - 1 && scrollToIndex(currentIndex + 1)}
            disabled={currentIndex >= learners.length - 1}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* ── Carousel scroll-snap ─────────────────────────────────────────── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
      >
        {learners.map((learner) => {
          const weatherEmoji = learner.lastWeather ? WEATHER_ICONS[learner.lastWeather] ?? '❓' : null

          return (
            <div
              key={learner.id}
              className="snap-center shrink-0 w-[92vw] max-w-[500px]"
            >
              <div className="space-y-5">

                {/* Nom */}
                <h2 className="page-title text-center">{learner.firstName} {learner.lastName}</h2>

                {/* ── Bloc 1 : Check-ins + Dernière météo ──────────────── */}
                <div className="card py-5 px-4">
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="text-center px-2">
                      <CalendarCheck size={28} className="mx-auto text-emerald-500 mb-1.5" />
                      <p className="text-3xl font-bold text-gray-800">
                        {learner.totalCheckins}
                        {learner.expectedCheckins > 0 && (
                          <span className="text-sm font-normal text-gray-400">/{learner.expectedCheckins}</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Check-ins</p>
                    </div>
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
                </div>

                {/* ── Bloc 2 : Actions + Delta cette semaine ───────────── */}
                <div className="card py-5 px-4">
                  <div className="grid grid-cols-2 divide-x divide-gray-100">
                    <div className="text-center px-2">
                      <Zap size={28} className="mx-auto text-amber-500 mb-1.5" />
                      <p className="text-3xl font-bold text-gray-800">{learner.totalActions}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Actions menées</p>
                    </div>
                    <div className="text-center px-2">
                      <TrendingUp size={28} className={`mx-auto ${learner.actionsThisWeek > 0 ? 'text-emerald-500' : 'text-gray-400'} mb-1.5`} />
                      <p className={`text-3xl font-bold ${learner.actionsThisWeek > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
                        {learner.actionsThisWeek > 0 ? `+${learner.actionsThisWeek}` : '0'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Cette semaine</p>
                    </div>
                  </div>
                </div>

                {/* ── Axes de progrès ───────────────────────────────────── */}
                {learner.axes.length > 0 && (
                  <LearnerAxesSection
                    axes={learner.axes}
                    feedbackMap={learner.feedbackMap}
                  />
                )}

                {/* ── Historique météo ──────────────────────────────────── */}
                {learner.checkins.length > 0 && (
                  <div className="card">
                    <h2 className="section-title mb-4">🌤 Historique météo</h2>

                    {/* Résumé en 3 blocs */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {(['sunny', 'cloudy', 'stormy'] as const).map((w) => (
                        <div key={w} className={`rounded-lg p-3 text-center ${WEATHER_COLORS[w]}`}>
                          <p className="text-2xl">{w === 'sunny' ? '☀️' : w === 'cloudy' ? '⛅' : '⛈️'}</p>
                          <p className="font-bold text-lg mt-0.5">{learner.weatherCount[w]}</p>
                          <p className="text-xs mt-0.5">
                            {learner.checkins.length > 0
                              ? `${Math.round((learner.weatherCount[w] / learner.checkins.length) * 100)}%`
                              : '0%'}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Timeline pills */}
                    <div className="flex flex-wrap gap-1.5">
                      {[...learner.checkins].reverse().map((ci) => (
                        <span
                          key={ci.id}
                          title={formatWeek(ci.week_number, ci.year)}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-default ${
                            WEATHER_COLORS[ci.weather as keyof typeof WEATHER_COLORS]
                          }`}
                        >
                          {ci.weather === 'sunny' ? '☀️' : ci.weather === 'cloudy' ? '⛅' : '⛈️'} S{ci.week_number}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* État vide */}
                {learner.checkins.length === 0 && learner.axes.length === 0 && (
                  <div className="card text-center py-10">
                    <p className="text-4xl mb-3">🌱</p>
                    <p className="text-gray-500 font-medium">Cet apprenant n&apos;a pas encore commencé.</p>
                    <p className="text-gray-400 text-sm mt-1">Aucun axe ni check-in enregistré.</p>
                  </div>
                )}

              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
