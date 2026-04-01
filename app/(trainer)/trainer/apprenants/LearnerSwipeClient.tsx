'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import type { ActionFeedbackData } from '@/lib/types'
import LearnerAxesSection from '../learner/[id]/LearnerAxesSection'
import LearnerTipsSection from '../learner/[id]/LearnerTipsSection'

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

  // ── Synchroniser le groupe sélectionné avec localStorage ──
  useEffect(() => {
    const stored = localStorage.getItem('trainer_selected_group')
    // Si le groupe affiché ne correspond pas au localStorage (navigation via menu sans ?group)
    // et qu'il y a un groupe stocké valide différent, rediriger
    if (stored && stored !== 'all' && stored !== currentGroupId && groups.some(g => g.id === stored)) {
      // Vérifier si l'URL n'a pas de ?group explicite (navigation via menu)
      const url = new URL(window.location.href)
      if (!url.searchParams.has('group')) {
        router.replace(`/trainer/apprenants?group=${stored}`)
        return
      }
    }
    // Sinon, sauvegarder le groupe actuel
    localStorage.setItem('trainer_selected_group', currentGroupId)
  }, [currentGroupId, groups, router])

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
        <p className="text-gray-500 font-medium">Aucun participant dans ce groupe.</p>
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
                      localStorage.setItem('trainer_selected_group', g.id)
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
                  <span className="ml-auto text-xs text-gray-500">{g.count} app.</span>
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
          return (
            <div
              key={learner.id}
              className="snap-center shrink-0 w-[92vw] max-w-[500px]"
            >
              <div className="space-y-5">

                {/* ── Header gradient indigo ──────────────────────── */}
                <div
                  className="rounded-2xl p-4 relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
                    boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
                  }}
                >
                  <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
                  <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />

                  {/* Nom + dernière météo */}
                  <div className="relative flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-extrabold text-white">{learner.firstName} {learner.lastName}</h2>
                      <p className="text-xs text-indigo-200 mt-0.5">{learner.axes.length} axe{learner.axes.length !== 1 ? 's' : ''} de progrès</p>
                    </div>
                    {learner.lastWeather && (
                      <span className="text-3xl drop-shadow-lg">{WEATHER_ICONS[learner.lastWeather] ?? '❓'}</span>
                    )}
                  </div>

                  {/* Stats en 3 colonnes glass */}
                  <div className="relative grid grid-cols-3 gap-2">
                    <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
                      <div className={`text-2xl font-black ${learner.actionsThisWeek > 0 ? 'text-emerald-300' : 'text-white/40'}`}>
                        {learner.actionsThisWeek > 0 ? `+${learner.actionsThisWeek}` : '0'}
                      </div>
                      <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">cette semaine</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
                      <div className="text-2xl font-black text-white">{learner.totalActions}</div>
                      <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">actions</p>
                    </div>
                    <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
                      <div className="text-2xl font-black text-white">
                        {learner.totalCheckins}
                        {learner.expectedCheckins > 0 && <span className="text-sm font-normal text-indigo-300">/{learner.expectedCheckins}</span>}
                      </div>
                      <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">check-ins</p>
                    </div>
                  </div>
                </div>

                {/* ── Tips IA ───────────────────────────────────────────── */}
                {learner.axes.length > 0 && (
                  <LearnerTipsSection
                    learnerId={learner.id}
                    axes={learner.axes.map(a => ({ id: a.id, subject: a.subject }))}
                  />
                )}

                {/* ── Axes de progrès ───────────────────────────────────── */}
                {learner.axes.length > 0 && (
                  <LearnerAxesSection
                    axes={learner.axes}
                    feedbackMap={learner.feedbackMap}
                  />
                )}


                {/* État vide */}
                {learner.checkins.length === 0 && learner.axes.length === 0 && (
                  <div className="card text-center py-10">
                    <p className="text-4xl mb-3">🌱</p>
                    <p className="text-gray-500 font-medium">Ce participant n&apos;a pas encore commencé.</p>
                    <p className="text-gray-500 text-sm mt-1">Aucun axe ni check-in enregistré.</p>
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
