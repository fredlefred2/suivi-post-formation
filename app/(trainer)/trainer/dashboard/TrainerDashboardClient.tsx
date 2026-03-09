'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronDown, Users, TrendingUp, X, ClipboardCheck, Download, Loader2 } from 'lucide-react'
import type { ActionFeedbackData } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'
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

const WEATHER_POINTS: Record<string, number> = { stormy: 0, cloudy: 1, sunny: 2 }

function getOverallWeatherEmoji(score: number) {
  if (score < 0.4) return '🌧️'
  if (score < 0.8) return '🌥️'
  if (score < 1.2) return '⛅'
  if (score <= 1.6) return '🌤️'
  return '☀️'
}

function getDynamiqueForCount(count: number) {
  if (count === 0) return { icon: '⏳', level: 0, label: 'Veille' }
  if (count <= 2) return { icon: '👣', level: 1, label: 'Impulsion' }
  if (count <= 5) return { icon: '🥁', level: 2, label: 'Rythme' }
  if (count <= 8) return { icon: '🔥', level: 3, label: 'Intensité' }
  return { icon: '🚀', level: 4, label: 'Propulsion' }
}

const LEVEL_CARD_COLORS: Record<number, string> = {
  0: 'from-gray-50 to-gray-100',
  1: 'from-teal-50 to-emerald-50',
  2: 'from-blue-50 to-indigo-50',
  3: 'from-orange-50 to-amber-50',
  4: 'from-purple-50 to-fuchsia-50',
}

const LEVEL_AVATAR_COLORS: Record<number, string> = {
  0: 'bg-gray-200 text-gray-700',
  1: 'bg-teal-200 text-teal-700',
  2: 'bg-blue-200 text-blue-700',
  3: 'bg-orange-200 text-orange-700',
  4: 'bg-purple-200 text-purple-700',
}

type Props = {
  groups: GroupData[]
  checkins: CheckinData[]
  actions: ActionData[]
  currentWeek: number
  currentYear: number
  unassignedLearners?: UnassignedLearner[]
  learnerAxesMap?: Record<string, number[]>
  initialGroup?: string
}

export default function TrainerDashboardClient({
  groups,
  checkins,
  actions,
  currentWeek,
  currentYear,
  unassignedLearners = [],
  learnerAxesMap = {},
  initialGroup,
}: Props) {
  // ── State ──
  // Initialiser sans localStorage pour éviter le mismatch d'hydration
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

  // Restaurer le localStorage APRÈS hydration, puis sync
  useEffect(() => {
    if (!initialGroup || initialGroup === 'all') {
      const stored = localStorage.getItem('trainer_selected_group')
      if (stored && (stored === 'all' || groups.some(g => g.id === stored))) {
        setSelectedOption(stored)
        return
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    localStorage.setItem('trainer_selected_group', selectedOption)
  }, [selectedOption])

  function selectOption(option: string) {
    setSelectedOption(option)
    setDropdownOpen(false)
  }

  // Fermeture dropdown au clic extérieur
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

  // ── Données filtrées ──
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

  // Actions 7 derniers jours
  const sevenDaysAgo = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString()
  }, [])
  const recentActionsFiltered = filteredActions.filter((a) => a.created_at >= sevenDaysAgo)

  // Actions pour le carousel (les 10 plus récentes filtrées)
  const carouselActions = filteredActions.slice(0, 10)

  // ── Météo générale ──
  const weatherSummary = useMemo(() => {
    const latestByLearner: Record<string, CheckinData> = {}
    ;[...filteredCheckins]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((c) => { if (!latestByLearner[c.learner_id]) latestByLearner[c.learner_id] = c })

    const counts = { sunny: 0, cloudy: 0, stormy: 0 }
    Object.values(latestByLearner).forEach((c) => {
      const w = c.weather as 'sunny' | 'cloudy' | 'stormy'
      if (counts[w] !== undefined) counts[w]++
    })
    return counts
  }, [filteredCheckins])

  const totalWithCheckin = weatherSummary.sunny + weatherSummary.cloudy + weatherSummary.stormy
  const overallScore = totalWithCheckin > 0
    ? Object.entries(weatherSummary).reduce((acc, [key, count]) => acc + count * (WEATHER_POINTS[key] ?? 0), 0) / totalWithCheckin
    : -1
  const overallEmoji = overallScore >= 0 ? getOverallWeatherEmoji(overallScore) : null

  // ── Indice d'action moyen ──
  const avgActions = filteredLearnerIds.size > 0
    ? Math.round(filteredActions.length / filteredLearnerIds.size)
    : 0
  const actionIndice = getDynamiqueForCount(avgActions)

  // ── Check-ins manquants ──
  const thisWeekCheckinLearnerIds = new Set(thisWeekCheckins.map((c) => c.learner_id))
  const missingCheckinMembers = useMemo(() => {
    return filteredGroups.flatMap((g) => g.members)
      .filter((m) => !thisWeekCheckinLearnerIds.has(m.learner_id))
  }, [filteredGroups, thisWeekCheckinLearnerIds])
  const missingCount = missingCheckinMembers.length

  // ── Compteurs animés ──
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
      return { id: lid, name: learnerNameMap[lid] ?? 'Inconnu', totalActions, dyns, totalLevel }
    }).sort((a, b) => b.totalLevel - a.totalLevel || b.totalActions - a.totalActions)
  }, [filteredLearnerIds, learnerAxesMap, learnerNameMap])

  function getInitials(first: string, last: string) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
  }

  // Petit point radio visuel
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
      if (!res.ok) throw new Error('Erreur téléchargement')
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
    <div className="space-y-6 pb-4">

      {/* ── Dropdown sélection groupe + bouton rapport ── */}
      <div className="flex items-center gap-2">
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-colors shadow-sm min-w-[220px] justify-between ${
            dropdownOpen
              ? 'border-indigo-400 text-indigo-700 ring-2 ring-indigo-100'
              : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700'
          }`}
        >
          <span className="truncate">📊 {selectionLabel}</span>
          <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[260px]">
            <button
              onClick={() => selectOption('all')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 transition-colors ${selectedOption === 'all' ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}
            >
              <RadioDot active={selectedOption === 'all'} />
              <span className={`text-sm font-semibold ${selectedOption === 'all' ? 'text-indigo-700' : 'text-gray-900'}`}>
                Tous les groupes
                <span className="ml-1 font-normal text-gray-400">({groups.length})</span>
              </span>
              <span className="ml-auto text-xs text-gray-400">
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
                      {isSalleAttente ? '⏳ ' : ''}{g.name}
                    </span>
                    <span className="ml-auto text-xs text-gray-400">{g.members.length} app.</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bouton télécharger rapport PDF */}
      {selectedOption !== 'all' && (
        <button
          onClick={handleDownloadReport}
          disabled={isDownloading}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          title="Télécharger le rapport PDF"
        >
          {isDownloading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          <span className="hidden sm:inline">{isDownloading ? 'Génération...' : 'Rapport'}</span>
        </button>
      )}
      </div>

      {/* ── Bloc 1 : Membres + Météo générale ── */}
      <div className="card py-5 px-4">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          <Link href={apprenantLink} className="text-center px-2 hover:opacity-80 transition-opacity">
            <Users size={28} className="mx-auto text-indigo-500 mb-1.5" />
            <p className="text-3xl font-bold text-gray-800">{animatedMembers}</p>
            <p className="text-xs text-gray-500 mt-0.5">Membre{filteredLearnerIds.size !== 1 ? 's' : ''}</p>
          </Link>
          <div className="text-center px-2 flex flex-col items-center justify-center">
            {overallEmoji ? (
              <>
                <p className="text-xs text-gray-500 mb-2">Météo générale</p>
                <span className="text-6xl leading-none">{overallEmoji}</span>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">Météo générale</p>
                <span className="text-5xl text-gray-300">-</span>
                <p className="text-[11px] text-gray-400 mt-1">Pas de check-in</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bloc 2 : Actions cette semaine + Indice d'action ── */}
      <Link href={apprenantLink} className="card py-5 px-4 block hover:border-indigo-200 transition-colors">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          <div className="text-center px-2">
            <TrendingUp size={28} className="mx-auto text-emerald-500 mb-1.5" />
            <p className={`text-3xl font-bold ${recentActionsFiltered.length > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Actions cette semaine</p>
          </div>
          <div className="text-center px-2 flex flex-col items-center justify-center">
            <span className="text-6xl leading-none">{actionIndice.icon}</span>
            <p className="text-sm font-semibold text-gray-700 mt-2">{actionIndice.label}</p>
          </div>
        </div>
      </Link>

      {/* ── Bloc 3 : Check-ins manquants ── */}
      <div className="card py-5 px-4">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          <div className="text-center px-2 flex flex-col items-center justify-center">
            {missingCount === 0 ? (
              <>
                <span className="text-4xl leading-none mb-1">✅</span>
                <p className="text-lg font-bold text-emerald-600">100%</p>
                <p className="text-xs text-gray-500 mt-0.5">Check-ins complets</p>
              </>
            ) : (
              <>
                <ClipboardCheck size={32} className="text-indigo-400 mb-1" />
                <p className="text-lg font-bold text-gray-800">{missingCount} en attente</p>
                <p className="text-xs text-gray-500 mt-0.5">sur {filteredLearnerIds.size} participant{filteredLearnerIds.size > 1 ? 's' : ''}</p>
              </>
            )}
          </div>
          <div className="px-3 flex flex-col justify-center">
            {missingCount === 0 ? (
              <p className="text-sm text-emerald-600 text-center">Tous les check-ins sont à jour ✅</p>
            ) : (
              <div className="space-y-0.5 max-h-[80px] overflow-y-auto scrollbar-hide">
                {missingCheckinMembers.slice(0, 5).map((m) => (
                  <p key={m.learner_id} className="text-sm text-amber-700 truncate">
                    · {m.first_name}
                  </p>
                ))}
                {missingCheckinMembers.length > 5 && (
                  <p className="text-xs text-gray-400 italic">et {missingCheckinMembers.length - 5} autre{missingCheckinMembers.length - 5 > 1 ? 's' : ''}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Carousel actions récentes ── */}
      {carouselActions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Actions récentes</h2>
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
                  className={`flex-shrink-0 w-[220px] bg-gradient-to-br ${LEVEL_CARD_COLORS[dyn.level] ?? LEVEL_CARD_COLORS[0]} rounded-xl p-4 text-left transition-all duration-200 hover:shadow-md active:scale-[0.98]`}
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-full ${LEVEL_AVATAR_COLORS[dyn.level] ?? LEVEL_AVATAR_COLORS[0]} flex items-center justify-center text-xs font-bold`}>
                      {getInitials(action.learner_first_name, action.learner_last_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-gray-700 truncate">
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-[10px] text-indigo-500 truncate">{action.axe_subject}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">{action.description}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-[10px] text-gray-400">
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
            <div className="flex justify-center gap-1 mt-3">
              {carouselActions.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSlide % carouselActions.length ? 'w-4 bg-indigo-500' : 'w-1.5 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {carouselActions.length === 0 && filteredLearnerIds.size > 0 && (
        <div className="card text-center py-6">
          <p className="text-gray-400 text-sm">Aucune action enregistrée</p>
        </div>
      )}

      {/* ── Tous en action ── */}
      {filteredLearnerIds.size > 0 && sorted.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-3">Tous en action</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
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
                    <td className="py-1.5 text-xs text-gray-400 w-6">{idx + 1}</td>
                    <td className="py-1.5 font-medium text-gray-800 truncate max-w-[140px]">
                      <Link
                        href={`/trainer/apprenants?group=${learnerGroupMap[learner.id] ?? ''}&learner=${learner.id}`}
                        className="hover:text-indigo-600 transition-colors"
                      >
                        {learner.name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-center font-semibold text-gray-700">{learner.totalActions}</td>
                    {learner.dyns.map((m, i) => (
                      <td key={i} className="py-1.5 text-center text-base">{m.icon}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modale : toutes les actions récentes ── */}
      {showAllActions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAllActions(false)} />
          <div className="relative bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Actions récentes</h3>
              <button onClick={() => setShowAllActions(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {filteredActions.slice(0, 20).map((action) => (
                <div
                  key={action.id}
                  className="bg-gray-50 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold">
                      {getInitials(action.learner_first_name, action.learner_last_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-700">
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-xs text-indigo-500">{action.axe_subject}</p>
                    </div>
                    <span className="text-xs text-gray-400">
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
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
