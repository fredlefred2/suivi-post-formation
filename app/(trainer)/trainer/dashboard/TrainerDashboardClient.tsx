'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronDown, X, Download, Loader2 } from 'lucide-react'
import type { ActionFeedbackData } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'
import TrainerTeamMessages from '@/app/components/TrainerTeamMessages'
import { useCountUp } from '@/lib/useCountUp'

export type GroupData = {
  id: string
  name: string
  members: Array<{ learner_id: string; first_name: string; last_name: string }>
}

export type CheckinData = {
  learner_id: string
  weather: string
  week_number: number
  year: number
  created_at: string
}

export type ActionData = {
  id: string
  description: string
  created_at: string
  learner_id: string
  learner_name: string
  learner_first_name: string
  learner_last_name: string
  axe_subject: string
  axe_action_count: number
  feedback: ActionFeedbackData
}

export type UnassignedLearner = {
  id: string
  first_name: string
  last_name: string
}

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}

function getDynamiqueForCount(count: number) {
  if (count === 0) return { icon: '⚪', level: 0, label: 'Veille' }
  if (count <= 2) return { icon: '👣', level: 1, label: 'Impulsion' }
  if (count <= 5) return { icon: '🥁', level: 2, label: 'Rythme' }
  if (count <= 8) return { icon: '🔥', level: 3, label: 'Intensite' }
  return { icon: '🚀', level: 4, label: 'Propulsion' }
}

const LEVEL_CARD_COLORS: Record<number, string> = {
  0: 'from-slate-50 to-slate-100',
  1: 'from-sky-50 to-sky-100',
  2: 'from-emerald-50 to-emerald-100',
  3: 'from-orange-50 to-orange-100',
  4: 'from-rose-50 to-rose-100',
}

const LEVEL_AVATAR_COLORS: Record<number, string> = {
  0: 'bg-slate-200 text-slate-700',
  1: 'bg-sky-200 text-sky-700',
  2: 'bg-emerald-200 text-emerald-700',
  3: 'bg-orange-200 text-orange-700',
  4: 'bg-rose-200 text-rose-700',
}

type Props = {
  groups: GroupData[]
  checkins: CheckinData[]
  actions: ActionData[]
  currentWeek: number
  currentYear: number
  isCheckinOpen: boolean
  unassignedLearners?: UnassignedLearner[]
  learnerAxesMap?: Record<string, number[]>
  initialGroup?: string
  currentUserId: string
}

export default function TrainerDashboardClient({
  groups,
  checkins,
  actions,
  currentWeek,
  currentYear,
  isCheckinOpen,
  unassignedLearners = [],
  learnerAxesMap = {},
  initialGroup,
  currentUserId,
}: Props) {
  // ── State ──
  const [selectedOption, setSelectedOption] = useState<string>(
    initialGroup && initialGroup !== 'all' && groups.some(g => g.id === initialGroup)
      ? initialGroup
      : 'all'
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showAllActions, setShowAllActions] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Restaurer le localStorage APRES hydration
  useEffect(() => {
    if (!initialGroup || initialGroup === 'all') {
      const stored = localStorage.getItem('trainer_selected_group')
      if (stored && (stored === 'all' || groups.some(g => g.id === stored))) {
        setSelectedOption(stored)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectOption(option: string) {
    setSelectedOption(option)
    setDropdownOpen(false)
    localStorage.setItem('trainer_selected_group', option)
  }

  // Fermeture dropdown au clic exterieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const selectionLabel =
    selectedOption === 'all'
      ? 'Tous les groupes'
      : groups.find((g) => g.id === selectedOption)?.name ?? 'Groupe'

  // ── Donnees filtrees ──
  const filteredGroups = selectedOption === 'all' ? groups : groups.filter((g) => g.id === selectedOption)

  const filteredLearnerIds = useMemo(() => {
    return new Set(filteredGroups.flatMap((g) => g.members.map((m) => m.learner_id)))
  }, [filteredGroups])

  const learnerGroupMap = useMemo(() => {
    const map: Record<string, string> = {}
    groups.forEach((g) => g.members.forEach((m) => { map[m.learner_id] = g.id }))
    return map
  }, [groups])

  const learnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    groups.forEach((g) => g.members.forEach((m) => { map[m.learner_id] = `${m.first_name} ${m.last_name}` }))
    return map
  }, [groups])

  const filteredCheckins = checkins.filter((c) => filteredLearnerIds.has(c.learner_id))
  const thisWeekCheckins = filteredCheckins.filter((c) => c.week_number === currentWeek && c.year === currentYear)
  const filteredActions = actions.filter((a) => filteredLearnerIds.has(a.learner_id))

  // Actions semaine ISO courante (depuis lundi)
  const thisMondayISO = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? 6 : day - 1
    const monday = new Date(now)
    monday.setHours(0, 0, 0, 0)
    monday.setDate(now.getDate() - diff)
    return monday.toISOString()
  }, [])
  const recentActionsFiltered = filteredActions.filter((a) => a.created_at >= thisMondayISO)

  // Actions pour le carousel (les 10 plus recentes filtrees)
  const carouselActions = filteredActions.slice(0, 10)

  // ── Meteo : distribution semaine passée ──
  const prevWeek = useMemo(() => {
    let w = currentWeek - 1, y = currentYear
    if (w <= 0) { w = 52; y-- }
    return { week: w, year: y }
  }, [currentWeek, currentYear])

  const weatherDistribution = useMemo(() => {
    const lastWeekCheckins = filteredCheckins.filter(
      (c) => c.week_number === prevWeek.week && c.year === prevWeek.year
    )
    const counts = { sunny: 0, cloudy: 0, stormy: 0 }
    lastWeekCheckins.forEach((c) => {
      if (c.weather in counts) counts[c.weather as keyof typeof counts]++
    })
    return counts
  }, [filteredCheckins, prevWeek])

  const totalWithCheckin = weatherDistribution.sunny + weatherDistribution.cloudy + weatherDistribution.stormy

  // ── Check-ins manquants ──
  const thisWeekCheckinLearnerIds = new Set(thisWeekCheckins.map((c) => c.learner_id))
  const missingCheckinMembers = useMemo(() => {
    return filteredGroups.flatMap((g) => g.members)
      .filter((m) => !thisWeekCheckinLearnerIds.has(m.learner_id))
  }, [filteredGroups, thisWeekCheckinLearnerIds])
  const missingCount = missingCheckinMembers.length

  // ── Semaine passée : % check-ins réalisés ──
  const lastWeekInfo = useMemo(() => {
    // Semaine précédente
    let prevWeek = currentWeek - 1
    let prevYear = currentYear
    if (prevWeek <= 0) { prevWeek = 52; prevYear-- }

    const lastWeekCheckins = filteredCheckins.filter(
      (c) => c.week_number === prevWeek && c.year === prevYear
    )
    const uniqueLearnersChecked = new Set(lastWeekCheckins.map((c) => c.learner_id)).size
    const totalMembers = filteredLearnerIds.size
    const pct = totalMembers > 0 ? Math.round((uniqueLearnersChecked / totalMembers) * 100) : 0

    // Calculer les dates lundi → dimanche de la semaine passée
    const now = new Date()
    const day = now.getDay()
    const diffToMonday = day === 0 ? 6 : day - 1
    const thisMonday = new Date(now)
    thisMonday.setHours(0, 0, 0, 0)
    thisMonday.setDate(now.getDate() - diffToMonday)
    const lastMonday = new Date(thisMonday)
    lastMonday.setDate(thisMonday.getDate() - 7)
    const lastSunday = new Date(thisMonday)
    lastSunday.setDate(thisMonday.getDate() - 1)

    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    const label = `${fmt(lastMonday)} - ${fmt(lastSunday)}`

    // Prochain check-in : vendredi de cette semaine (ou vendredi prochain si déjà passé)
    const nextFriday = new Date(thisMonday)
    nextFriday.setDate(thisMonday.getDate() + 4) // lundi + 4 = vendredi
    if (now > nextFriday) {
      nextFriday.setDate(nextFriday.getDate() + 7)
    }
    const nextCheckinLabel = nextFriday.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

    return { pct, label, nextCheckinLabel, uniqueLearnersChecked, totalMembers }
  }, [currentWeek, currentYear, filteredCheckins, filteredLearnerIds])

  // ── Compteurs animes ──
  const animatedMembers = useCountUp(filteredLearnerIds.size)
  const animatedDelta = useCountUp(recentActionsFiltered.length)

  // ── Auto-scroll carousel ──
  useEffect(() => {
    if (carouselActions.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselActions.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [carouselActions.length])

  useEffect(() => {
    if (!scrollRef.current) return
    const cardWidth = 220
    const gap = 12
    scrollRef.current.scrollTo({
      left: currentSlide * (cardWidth + gap),
      behavior: 'smooth',
    })
  }, [currentSlide])

  const handleOpenAll = useCallback(() => setShowAllActions(true), [])

  // ── Scoring ──
  const sorted = useMemo(() => {
    return Array.from(filteredLearnerIds).map((lid) => {
      const axesCounts = learnerAxesMap[lid] ?? []
      const totalActions = axesCounts.reduce((a, b) => a + b, 0)
      const dyns = [0, 1, 2].map((i) => getDynamiqueForCount(axesCounts[i] ?? 0))
      const totalLevel = dyns.reduce((a, m) => a + m.level, 0)
      // Derniere meteo
      const learnerCheckins = filteredCheckins
        .filter(c => c.learner_id === lid)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const lastWeather = learnerCheckins.length > 0 ? learnerCheckins[0].weather : null
      return { id: lid, name: learnerNameMap[lid] ?? 'Inconnu', totalActions, dyns, totalLevel, lastWeather }
    }).sort((a, b) => b.totalLevel - a.totalLevel || b.totalActions - a.totalActions)
  }, [filteredLearnerIds, learnerAxesMap, learnerNameMap, filteredCheckins])

  function RadioDot({ active }: { active: boolean }) {
    return (
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-indigo-600' : 'border-gray-300'}`}>
        {active && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
      </span>
    )
  }

  const handleDownloadReport = useCallback(async () => {
    if (isDownloading || selectedOption === 'all') return
    setIsDownloading(true)
    try {
      const res = await fetch(`/api/group-report?groupId=${selectedOption}`)
      if (!res.ok) throw new Error('Erreur telechargement')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'rapport.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur rapport PDF:', err)
    } finally {
      setIsDownloading(false)
    }
  }, [isDownloading, selectedOption])

  const apprenantLink = `/trainer/apprenants?group=${selectedOption}`

  return (
    <div className="space-y-4 pb-4">

      {/* ── Dropdown selection groupe + bouton rapport ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={`w-full flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-colors shadow-sm justify-between ${
              dropdownOpen
                ? 'border-indigo-400 text-indigo-700 ring-2 ring-indigo-100'
                : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700'
            }`}
          >
            <span className="truncate">{selectionLabel}</span>
            <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              <button
                onClick={() => selectOption('all')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 transition-colors ${selectedOption === 'all' ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
              >
                <RadioDot active={selectedOption === 'all'} />
                <span className={`text-sm font-semibold ${selectedOption === 'all' ? 'text-indigo-700' : 'text-gray-900'}`}>
                  Tous les groupes
                  <span className="ml-1 font-normal text-gray-500">({groups.length})</span>
                </span>
                <span className="ml-auto text-xs text-gray-500">
                  {groups.reduce((acc, g) => acc + g.members.length, 0)} app.
                </span>
              </button>
              <div className="py-1">
                {groups.map((g) => {
                  const isSalleAttente = g.name === 'Salle d\'attente'
                  return (
                    <button
                      key={g.id}
                      onClick={() => selectOption(g.id)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        selectedOption === g.id
                          ? isSalleAttente ? 'bg-amber-50' : 'bg-indigo-50'
                          : isSalleAttente ? 'hover:bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <RadioDot active={selectedOption === g.id} />
                      <span className={`text-sm ${
                        selectedOption === g.id
                          ? isSalleAttente ? 'text-amber-700 font-medium' : 'text-indigo-700 font-medium'
                          : isSalleAttente ? 'text-amber-600' : 'text-gray-700'
                      }`}>
                        {isSalleAttente ? '⚪ ' : ''}{g.name}
                      </span>
                      <span className="ml-auto text-xs text-gray-500">{g.members.length} app.</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bouton telecharger rapport PDF */}
        {selectedOption !== 'all' && (
          <button
            onClick={handleDownloadReport}
            disabled={isDownloading}
            className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            title="Telecharger le rapport PDF"
          >
            {isDownloading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            <span className="hidden sm:inline">{isDownloading ? 'Generation...' : 'Rapport'}</span>
          </button>
        )}
      </div>

      {/* ── Bloc principal : 3 colonnes compactes ── */}
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-3">

          {/* Colonne 1 : Membres */}
          <Link href={apprenantLink} className="text-center group">
            <div className="text-3xl font-black text-gray-800">
              {animatedMembers}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">membre{filteredLearnerIds.size !== 1 ? 's' : ''}</p>
          </Link>

          {/* Colonne 2 : Actions cette semaine */}
          <Link href={apprenantLink} className="text-center group">
            <div className={`text-3xl font-black ${recentActionsFiltered.length > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">cette semaine</p>
          </Link>

          {/* Colonne 3 : Check-ins */}
          <div className="text-center">
            {isCheckinOpen ? (
              missingCount === 0 ? (
                <>
                  <div className="text-3xl font-black text-emerald-600">✓</div>
                  <p className="text-[11px] text-emerald-600 mt-0.5 leading-tight font-medium">tous a jour</p>
                </>
              ) : (
                <>
                  <div className="text-3xl font-black text-amber-600">{missingCount}</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">en attente</p>
                </>
              )
            ) : (
              <>
                <div className={`text-3xl font-black ${lastWeekInfo.pct === 100 ? 'text-emerald-600' : lastWeekInfo.pct >= 50 ? 'text-indigo-600' : 'text-amber-600'}`}>
                  {lastWeekInfo.pct}%
                </div>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">check-ins</p>
              </>
            )}
          </div>

        </div>

        {/* Meteo distribution */}
        {totalWithCheckin > 0 && (
          <div className="flex items-center justify-center gap-3 mt-3 pt-3 border-t border-gray-100">
            <span className="text-[11px] text-gray-500">Meteo S-1</span>
            {weatherDistribution.sunny > 0 && (
              <span className="text-sm">☀️ <span className="text-xs font-semibold text-gray-600">{weatherDistribution.sunny}</span></span>
            )}
            {weatherDistribution.cloudy > 0 && (
              <span className="text-sm">⛅ <span className="text-xs font-semibold text-gray-600">{weatherDistribution.cloudy}</span></span>
            )}
            {weatherDistribution.stormy > 0 && (
              <span className="text-sm">⛈️ <span className="text-xs font-semibold text-gray-600">{weatherDistribution.stormy}</span></span>
            )}
          </div>
        )}
      </div>

      {/* ── Bandeau check-ins en attente (uniquement si fenêtre ouverte) ── */}
      {isCheckinOpen && missingCount > 0 && (
        <div className="rounded-xl px-4 py-2.5 bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Check-ins en attente :</span>{' '}
            {missingCheckinMembers.slice(0, 4).map((m) => m.first_name).join(', ')}
            {missingCheckinMembers.length > 4 && ` et ${missingCheckinMembers.length - 4} autre${missingCheckinMembers.length - 4 > 1 ? 's' : ''}`}
          </p>
        </div>
      )}

      {/* ── Messages de la team ── */}
      {selectedOption !== 'all' && (
        <TrainerTeamMessages groupId={selectedOption} currentUserId={currentUserId} />
      )}

      {/* ── Carousel actions recentes ── */}
      {carouselActions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-700">Actions recentes</h2>
            <button onClick={handleOpenAll} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline">
              Voir tout
            </button>
          </div>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scrollbar-thin pb-2"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {carouselActions.map((action) => {
              const dyn = getDynamiqueForCount(action.axe_action_count)
              return (
                <Link
                  key={action.id}
                  href={`/trainer/apprenants?group=${learnerGroupMap[action.learner_id] ?? ''}&learner=${action.learner_id}`}
                  className={`flex-shrink-0 w-[220px] bg-gradient-to-br ${LEVEL_CARD_COLORS[dyn.level] ?? LEVEL_CARD_COLORS[0]} rounded-xl p-3 text-left transition-all duration-200 hover:shadow-md active:scale-[0.98]`}
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className={`w-7 h-7 rounded-full ${LEVEL_AVATAR_COLORS[dyn.level] ?? LEVEL_AVATAR_COLORS[0]} flex items-center justify-center text-sm`}>
                      {dyn.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-700 truncate">
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-[10px] text-indigo-500 truncate">{action.axe_subject}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{action.description}</p>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-[10px] text-gray-500">
                      {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                    {(action.feedback.likes_count > 0 || action.feedback.comments_count > 0) && (
                      <div className="flex items-center gap-2 text-[10px]">
                        {action.feedback.likes_count > 0 && <span className="text-pink-400">❤️ {action.feedback.likes_count}</span>}
                        {action.feedback.comments_count > 0 && <span className="text-indigo-400">💬 {action.feedback.comments_count}</span>}
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
          {carouselActions.length > 1 && (
            <div className="flex justify-center gap-1 mt-2">
              {carouselActions.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSlide % carouselActions.length ? 'w-3.5 bg-indigo-500' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {carouselActions.length === 0 && filteredLearnerIds.size > 0 && (
        <div className="card text-center py-6">
          <p className="text-gray-500 text-sm">Aucune action enregistree</p>
        </div>
      )}

      {/* ── Tous en action ── */}
      {filteredLearnerIds.size > 0 && sorted.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-bold text-gray-700 mb-3">Tous en action</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">#</th>
                  <th className="text-left pb-2 font-medium">Participant</th>
                  <th className="text-center pb-2 font-medium">Actions</th>
                  <th className="text-center pb-2 font-medium">Axe 1</th>
                  <th className="text-center pb-2 font-medium">Axe 2</th>
                  <th className="text-center pb-2 font-medium">Axe 3</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((learner, idx) => (
                  <tr key={learner.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 text-xs text-gray-500 w-6">{idx + 1}</td>
                    <td className="py-1.5 font-medium text-gray-800 max-w-[140px]">
                      <Link
                        href={`/trainer/apprenants?group=${learnerGroupMap[learner.id] ?? ''}&learner=${learner.id}`}
                        className="hover:text-indigo-600 transition-colors flex items-center gap-1.5"
                      >
                        <span className="truncate">{learner.name}</span>
                        {learner.lastWeather && (
                          <span className="text-xs shrink-0">{WEATHER_ICONS[learner.lastWeather] ?? ''}</span>
                        )}
                      </Link>
                    </td>
                    <td className="py-1.5 text-center font-semibold text-gray-700">{learner.totalActions}</td>
                    {learner.dyns.map((m, i) => (
                      <td key={i} className="py-1.5 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm ${LEVEL_AVATAR_COLORS[m.level] ?? LEVEL_AVATAR_COLORS[0]}`}>{m.icon}</span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modale : toutes les actions recentes ── */}
      {showAllActions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAllActions(false)} />
          <div className="relative bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Actions recentes</h3>
              <button onClick={() => setShowAllActions(false)} className="text-gray-500 hover:text-gray-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {filteredActions.slice(0, 20).map((action) => {
                const dyn = getDynamiqueForCount(action.axe_action_count)
                return (
                <div
                  key={action.id}
                  className="bg-gray-50 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full ${LEVEL_AVATAR_COLORS[dyn.level] ?? LEVEL_AVATAR_COLORS[0]} flex items-center justify-center text-base`}>
                      {dyn.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-700">
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-xs text-indigo-500">{action.axe_subject}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-2">{action.description}</p>
                  <ActionFeedback
                    actionId={action.id}
                    feedback={action.feedback}
                    canInteract={true}
                  />
                </div>
              )})}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
