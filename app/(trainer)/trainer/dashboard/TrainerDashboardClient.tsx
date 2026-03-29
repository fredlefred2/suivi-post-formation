'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { ChevronDown, X, Download, Loader2 } from 'lucide-react'
import { getDynamique, getCurrentLevelIndex } from '@/lib/axeHelpers'
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
  const dyn = getDynamique(count)
  return { icon: dyn.icon, level: getCurrentLevelIndex(count), label: dyn.label }
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

  const [downloadStatus, setDownloadStatus] = useState('')

  const handleDownloadReport = useCallback(async () => {
    if (isDownloading || selectedOption === 'all') return
    setIsDownloading(true)
    try {
      // Étape 1 : Récupérer les données du groupe (avec auth cookie)
      setDownloadStatus('Collecte des donnees...')
      const dataRes = await fetch(`/api/group-report?groupId=${selectedOption}&mode=data`, {
        credentials: 'include',
      })
      if (!dataRes.ok) throw new Error(`Erreur récupération données (${dataRes.status})`)
      const reportData = await dataRes.json()

      // Étape 2 : Analyse IA (route Edge streaming pour éviter timeout)
      setDownloadStatus('Analyse en cours...')
      let aiAnalysis = null
      try {
        const aiRes = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData),
        })
        if (aiRes.ok) {
          // La réponse est un stream de texte brut (pas du JSON direct)
          const rawText = await aiRes.text()
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            aiAnalysis = JSON.parse(jsonMatch[0])
            console.log('[PDF] Analyse IA reçue:', Object.keys(aiAnalysis))
          } else {
            console.error('[PDF] Pas de JSON dans la réponse IA:', rawText.substring(0, 200))
          }
        } else {
          const errText = await aiRes.text()
          console.error('[PDF] Erreur analyse IA:', aiRes.status, errText)
        }
      } catch (aiErr) {
        console.error('[PDF] Exception analyse IA:', aiErr)
      }

      // Étape 3 : Générer le PDF (pas besoin d'auth, données dans le body)
      setDownloadStatus('Generation du PDF...')
      console.log('[PDF] Envoi POST avec aiAnalysis:', aiAnalysis ? `OK (${aiAnalysis.learnerAnalyses?.length} analyses)` : 'null')
      const pdfRes = await fetch('/api/group-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData, aiAnalysis }),
      })
      if (!pdfRes.ok) throw new Error(`Erreur génération PDF (${pdfRes.status})`)

      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfRes.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'rapport.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Erreur rapport PDF:', err)
    } finally {
      setIsDownloading(false)
      setDownloadStatus('')
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
            <span className="hidden sm:inline">{isDownloading ? (downloadStatus || 'Generation...') : 'Rapport'}</span>
          </button>
        )}
      </div>

      {/* ── Bloc principal : gradient indigo harmonisé ── */}
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
          boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />

        {/* Titre + météo moyenne */}
        <div className="relative flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-white">{selectionLabel}</h1>
            <p className="text-xs text-indigo-200 mt-0.5">{filteredLearnerIds.size} participant{filteredLearnerIds.size !== 1 ? 's' : ''}</p>
          </div>
          {totalWithCheckin > 0 && (() => {
            const max = Math.max(weatherDistribution.sunny, weatherDistribution.cloudy, weatherDistribution.stormy)
            const avgEmoji = weatherDistribution.sunny === max ? '☀️' : weatherDistribution.cloudy === max ? '⛅' : '⛈️'
            return <span className="text-3xl drop-shadow-lg">{avgEmoji}</span>
          })()}
        </div>

        {/* Stats en 3 colonnes glass */}
        <div className="relative grid grid-cols-3 gap-2">
          <Link href={apprenantLink} className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center hover:bg-white/20 transition-colors">
            <div className="text-2xl font-black text-white">{animatedMembers}</div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">membre{filteredLearnerIds.size !== 1 ? 's' : ''}</p>
          </Link>

          <Link href={apprenantLink} className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center hover:bg-white/20 transition-colors">
            <div className={`text-2xl font-black ${recentActionsFiltered.length > 0 ? 'text-emerald-300' : 'text-white/40'}`}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">cette semaine</p>
          </Link>

          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            {isCheckinOpen ? (
              missingCount === 0 ? (
                <>
                  <div className="text-2xl font-black text-emerald-300">✓</div>
                  <p className="text-[10px] text-emerald-300 mt-0.5 leading-tight font-medium">tous à jour</p>
                </>
              ) : (
                <>
                  <div className="text-2xl font-black text-amber-300">{missingCount}</div>
                  <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">en attente</p>
                </>
              )
            ) : (
              <>
                <div className={`text-2xl font-black ${lastWeekInfo.pct === 100 ? 'text-emerald-300' : lastWeekInfo.pct >= 50 ? 'text-white' : 'text-amber-300'}`}>
                  {lastWeekInfo.pct}%
                </div>
                <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">check-ins</p>
              </>
            )}
          </div>
        </div>
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

      {/* ── Actions récentes ── */}
      {carouselActions.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800">Actions récentes</h2>
            <button onClick={handleOpenAll} className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold">
              Voir tout →
            </button>
          </div>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto pb-2"
            style={{ scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}
          >
            {carouselActions.map((action) => {
              const dyn = getDynamiqueForCount(action.axe_action_count)
              const borderColors: Record<number, string> = {
                0: '#94a3b8', 1: '#38bdf8', 2: '#34d399', 3: '#fb923c', 4: '#fb7185',
              }
              const bc = borderColors[dyn.level] ?? borderColors[0]
              return (
                <Link
                  key={action.id}
                  href={`/trainer/apprenants?group=${learnerGroupMap[action.learner_id] ?? ''}&learner=${action.learner_id}`}
                  className="flex-shrink-0 w-[240px] bg-white rounded-2xl p-4 text-left transition-all duration-200 active:scale-[0.97] relative overflow-hidden"
                  style={{
                    scrollSnapAlign: 'start',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
                    borderLeft: `3px solid ${bc}`,
                  }}
                >
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ background: `linear-gradient(135deg, ${bc}, ${bc}dd)` }}
                    >
                      {action.learner_first_name.charAt(0)}{action.learner_last_name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-[10px] text-indigo-500 font-medium truncate">{action.axe_subject}</p>
                    </div>
                    <span className="text-base shrink-0">{dyn.icon}</span>
                  </div>
                  <p className="text-[13px] text-gray-600 line-clamp-2 leading-relaxed">{action.description}</p>
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 font-medium">
                      {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                    </p>
                    {(action.feedback.likes_count > 0 || action.feedback.comments_count > 0) && (
                      <div className="flex items-center gap-2 text-[10px]">
                        {action.feedback.likes_count > 0 && <span className="text-pink-400 font-semibold">❤️ {action.feedback.likes_count}</span>}
                        {action.feedback.comments_count > 0 && <span className="text-indigo-400 font-semibold">💬 {action.feedback.comments_count}</span>}
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
      ) : filteredLearnerIds.size > 0 ? (
        <div className="rounded-2xl bg-white p-6 text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p className="text-gray-500 text-sm">Aucune action enregistrée</p>
        </div>
      ) : null}

      {/* ── Classement ── */}
      {filteredLearnerIds.size > 0 && sorted.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-gray-800 mb-3">Classement</h2>
          <div className="space-y-2">
            {sorted.map((learner, idx) => {
              const isTop3 = idx < 3
              const rankColors: Record<number, { bg: string; border: string; text: string; badge: string }> = {
                0: { bg: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)', border: '1px solid #fbbf24', text: '#92400e', badge: '#f59e0b' },
                1: { bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', border: '1px solid #cbd5e1', text: '#475569', badge: '#94a3b8' },
                2: { bg: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)', border: '1px solid #fdba74', text: '#9a3412', badge: '#f97316' },
              }
              const rc = rankColors[idx]
              return (
                <Link
                  key={learner.id}
                  href={`/trainer/apprenants?group=${learnerGroupMap[learner.id] ?? ''}&learner=${learner.id}`}
                  className="rounded-2xl p-3.5 flex items-center gap-3 transition-all duration-200 hover:shadow-md"
                  style={isTop3 && rc ? {
                    background: rc.bg,
                    border: rc.border,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  } : {
                    background: 'white',
                    border: '1px solid #f1f5f9',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                  }}
                >
                  {/* Rang */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={isTop3 && rc ? {
                      background: rc.badge,
                      color: 'white',
                      boxShadow: `0 2px 8px ${rc.badge}66`,
                    } : {
                      background: '#f1f5f9',
                      color: '#94a3b8',
                    }}
                  >
                    {idx + 1}
                  </div>

                  {/* Nom + actions + météo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold truncate" style={{ color: isTop3 && rc ? rc.text : '#1f2937' }}>
                        {learner.name}
                      </p>
                      {learner.lastWeather && (
                        <span className="text-sm shrink-0">{WEATHER_ICONS[learner.lastWeather] ?? ''}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">{learner.totalActions} action{learner.totalActions !== 1 ? 's' : ''}</p>
                  </div>

                  {/* Icônes dynamique des axes */}
                  <div className="flex items-center gap-1 shrink-0">
                    {learner.dyns.map((m, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm ${LEVEL_AVATAR_COLORS[m.level] ?? LEVEL_AVATAR_COLORS[0]}`}
                      >
                        {m.icon}
                      </span>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Message à la team (barre compacte en bas) ── */}
      {selectedOption !== 'all' && (
        <TrainerTeamMessages groupId={selectedOption} currentUserId={currentUserId} />
      )}

      {/* ── Modale : toutes les actions recentes ── */}
      {showAllActions && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAllActions(false)} />
          <div className="relative bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col pb-[max(0px,env(safe-area-inset-bottom))]">
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
