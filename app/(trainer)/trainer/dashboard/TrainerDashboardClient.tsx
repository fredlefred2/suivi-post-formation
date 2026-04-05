'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { ChevronDown, Download, Loader2 } from 'lucide-react'
import { getDynamique, getCurrentLevelIndex } from '@/lib/axeHelpers'
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

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}

function getDynamiqueForCount(count: number) {
  const dyn = getDynamique(count)
  return { icon: dyn.icon, level: getCurrentLevelIndex(count), label: dyn.label }
}

const AVATAR_BG_COLORS: Record<number, string> = {
  0: '#94a3b8', 1: '#0284c7', 2: '#059669', 3: '#d97706', 4: '#e11d48',
}

const LEVEL_DOT_BG: Record<number, string> = {
  0: '#f1f5f9', 1: '#e0f2fe', 2: '#d1fae5', 3: '#ffedd5', 4: '#ffe4e6',
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
  learnerRegularity?: Record<string, number>
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
  learnerRegularity = {},
  initialGroup,
  currentUserId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()

  // ── State ──
  const [selectedOption, setSelectedOption] = useState<string>(
    initialGroup && initialGroup !== 'all' && groups.some(g => g.id === initialGroup)
      ? initialGroup
      : 'all'
  )
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [showAllActions, setShowAllActions] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Restaurer le localStorage APRES hydration
  useEffect(() => {
    if (!initialGroup || initialGroup === 'all') {
      const stored = localStorage.getItem('trainer_selected_group')
      if (stored && stored !== 'all' && stored !== 'unassigned' && groups.some(g => g.id === stored)) {
        setSelectedOption(stored)
        // Mettre à jour l'URL pour que BottomNav puisse lire le group
        window.history.replaceState(null, '', `${pathname}?group=${stored}`)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectOption(option: string) {
    setSelectedOption(option)
    setDropdownOpen(false)
    // Synchro : stocker dans localStorage + mettre à jour l'URL
    if (option !== 'all' && option !== 'unassigned') {
      localStorage.setItem('trainer_selected_group', option)
      window.history.replaceState(null, '', `${pathname}?group=${option}`)
    } else {
      // Pour 'all', retirer le param group de l'URL
      window.history.replaceState(null, '', pathname)
    }
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

  // ── Régularité moyenne du groupe ──
  const avgRegularity = useMemo(() => {
    const ids = Array.from(filteredLearnerIds)
    if (ids.length === 0) return 0
    const sum = ids.reduce((acc, lid) => acc + (learnerRegularity[lid] ?? 0), 0)
    return Math.round(sum / ids.length)
  }, [filteredLearnerIds, learnerRegularity])

  // ── Compteurs animes ──
  const animatedRegularity = useCountUp(avgRegularity)
  const animatedDelta = useCountUp(recentActionsFiltered.length)

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
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? 'border-[#fbbf24]' : 'border-gray-300'}`}>
        {active && <span className="w-2 h-2 rounded-full bg-[#fbbf24]" />}
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
                ? 'border-[#fbbf24] text-[#1a1a2e] ring-2 ring-[rgba(251,191,36,0.15)]'
                : 'border-gray-200 text-gray-700 hover:border-[#fbbf24] hover:text-[#1a1a2e]'
            }`}
          >
            <span className="truncate">{selectionLabel}</span>
            <ChevronDown size={16} className={`shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
              <button
                onClick={() => selectOption('all')}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 transition-colors ${selectedOption === 'all' ? 'bg-[#fffbeb]' : 'hover:bg-gray-50'}`}
              >
                <RadioDot active={selectedOption === 'all'} />
                <span className={`text-sm font-semibold ${selectedOption === 'all' ? 'text-[#1a1a2e]' : 'text-gray-900'}`}>
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
                          ? isSalleAttente ? 'bg-amber-50' : 'bg-[#fffbeb]'
                          : isSalleAttente ? 'hover:bg-amber-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <RadioDot active={selectedOption === g.id} />
                      <span className={`text-sm ${
                        selectedOption === g.id
                          ? isSalleAttente ? 'text-amber-700 font-medium' : 'text-[#1a1a2e] font-medium'
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
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            style={{ background: '#fbbf24', color: '#1a1a2e' }}
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

      {/* ── Header navy ── */}
      <div
        className="rounded-[28px] p-5 relative overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
        style={{ background: '#1a1a2e' }}
        onClick={() => router.push(`/trainer/apprenants${selectedOption !== 'all' && selectedOption !== 'unassigned' ? `?group=${selectedOption}` : ''}`)}
      >
        <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />

        <div className="relative flex items-start justify-between mb-4">
          <div>
            <h1 className="text-[22px] font-extrabold text-white">{selectionLabel}</h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{filteredLearnerIds.size} participant{filteredLearnerIds.size !== 1 ? 's' : ''}</p>
          </div>
          {totalWithCheckin > 0 && (() => {
            const max = Math.max(weatherDistribution.sunny, weatherDistribution.cloudy, weatherDistribution.stormy)
            const avgEmoji = weatherDistribution.sunny === max ? '☀️' : weatherDistribution.cloudy === max ? '⛅' : '⛈️'
            return <span className="text-3xl drop-shadow-lg">{avgEmoji}</span>
          })()}
        </div>

        <div className="relative grid grid-cols-3 gap-2">
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="font-display text-[26px] font-bold" style={{ color: avgRegularity >= 75 ? '#6ee7b7' : avgRegularity >= 50 ? '#fbbf24' : '#f87171' }}>
              {animatedRegularity}%
            </div>
            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>régularité</p>
          </div>
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <div className="font-display text-[26px] font-bold" style={{ color: recentActionsFiltered.length > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
              {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
            </div>
            <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>cette semaine</p>
          </div>
          <div className="rounded-2xl py-3 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
            {isCheckinOpen ? (
              missingCount === 0 ? (
                <>
                  <div className="font-display text-[26px] font-bold" style={{ color: '#6ee7b7' }}>✓</div>
                  <p className="text-[10px] mt-0.5 leading-tight" style={{ color: '#6ee7b7' }}>tous a jour</p>
                </>
              ) : (
                <>
                  <div className="font-display text-[26px] font-bold" style={{ color: '#fbbf24' }}>{missingCount}</div>
                  <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>en attente</p>
                </>
              )
            ) : (
              <>
                <div className="font-display text-[26px] font-bold" style={{ color: lastWeekInfo.pct === 100 ? '#6ee7b7' : lastWeekInfo.pct >= 50 ? 'white' : '#fbbf24' }}>
                  {lastWeekInfo.pct}%
                </div>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.4)' }}>check-ins</p>
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

      {/* ── Podium top 3 ── */}
      {sorted.length > 0 && (() => {
        const podium = sorted.slice(0, 3)
        const podiumDisplay = podium.length >= 3
          ? [podium[1], podium[0], podium[2]]
          : podium.length === 2
          ? [podium[1], podium[0]]
          : podium

        const podiumConfig = [
          { avatarSize: 'w-11 h-11', border: '2px solid #94a3b8', shadow: 'none', baseH: 56, baseGrad: 'linear-gradient(180deg, #cbd5e1 0%, #94a3b8 100%)', baseFontSize: 22, avatarFontSize: 14 },
          { avatarSize: 'w-14 h-14', border: '3px solid #fbbf24', shadow: '0 4px 16px rgba(251,191,36,0.4)', baseH: 80, baseGrad: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)', baseFontSize: 28, avatarFontSize: 18 },
          { avatarSize: 'w-11 h-11', border: '2px solid #f97316', shadow: 'none', baseH: 40, baseGrad: 'linear-gradient(180deg, #fdba74 0%, #f97316 100%)', baseFontSize: 22, avatarFontSize: 14 },
        ]

        function getInitials(name: string) {
          return name.split(' ').map(n => n[0]).join('').toUpperCase()
        }

        return (
          <div
            className="cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => router.push(`/trainer/apprenants${selectedOption !== 'all' && selectedOption !== 'unassigned' ? `?group=${selectedOption}` : ''}`)}
          >
            <h2 className="text-[14px] font-bold mb-1" style={{ color: '#1a1a2e' }}>Les plus actifs sur Yapluka</h2>
            <div className="flex items-end justify-center gap-2 pt-4 pb-0 px-2">
              {podiumDisplay.map((learner, displayIdx) => {
                const cfg = podiumConfig[podium.length >= 3 ? displayIdx : podium.length === 2 ? (displayIdx === 0 ? 0 : 1) : 1]
                const actualRank = podium.indexOf(learner) + 1
                return (
                  <div key={learner.id} className="flex flex-col items-center flex-1" style={{ maxWidth: 120 }}>
                    <div
                      className={`${cfg.avatarSize} rounded-full flex items-center justify-center font-extrabold text-white mb-2`}
                      style={{ background: '#1a1a2e', border: cfg.border, boxShadow: cfg.shadow, fontSize: cfg.avatarFontSize }}
                    >
                      {getInitials(learner.name)}
                    </div>
                    <p className="text-[11px] font-bold text-center truncate w-full" style={{ color: '#1a1a2e' }}>{learner.name}</p>
                    <p className="text-[10px] font-medium mb-1.5" style={{ color: '#a0937c' }}>{learner.totalActions} action{learner.totalActions !== 1 ? 's' : ''}</p>
                    <div className="flex gap-1 mb-2">
                      {learner.dyns.map((d, i) => (
                        <span key={i} className="w-[22px] h-[22px] rounded-lg flex items-center justify-center text-[11px]" style={{ background: LEVEL_DOT_BG[d.level] }}>
                          {d.icon}
                        </span>
                      ))}
                    </div>
                    <div
                      className="w-full rounded-t-xl flex items-center justify-center font-bold text-white"
                      style={{ height: cfg.baseH, background: cfg.baseGrad, fontFamily: "'Space Grotesk', sans-serif", fontSize: cfg.baseFontSize }}
                    >
                      {actualRank}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Classement complet ── */}
      {sorted.length > 3 && (
        <div style={{ marginBottom: 20 }}>
          {sorted.slice(3).map((learner, idx) => (
            <Link
              key={learner.id}
              href={`/trainer/apprenants?group=${learnerGroupMap[learner.id] ?? ''}&learner=${learner.id}`}
              className="flex items-center gap-2.5 bg-white hover:bg-[#fffbeb] transition-colors"
              style={{ padding: '10px 14px', border: '1.5px solid #f0ebe0', borderRadius: 14, marginBottom: 6, textDecoration: 'none' }}
            >
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0" style={{ background: '#f0ebe0', color: '#a0937c' }}>
                {idx + 4}
              </div>
              <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: '#1a1a2e' }}>{learner.name}</span>
              {learner.lastWeather && <span className="text-sm shrink-0">{WEATHER_ICONS[learner.lastWeather] ?? ''}</span>}
              <span className="text-[11px] font-medium shrink-0" style={{ color: '#a0937c' }}>{learner.totalActions} act.</span>
              <div className="flex gap-0.5 shrink-0">
                {learner.dyns.map((d, i) => (
                  <span key={i} className="w-5 h-5 rounded-md flex items-center justify-center text-[10px]" style={{ background: LEVEL_DOT_BG[d.level] }}>
                    {d.icon}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Actions récentes avec feedback inline ── */}
      {filteredActions.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[14px] font-bold" style={{ color: '#1a1a2e' }}>Actions recentes</h2>
          </div>

          <div className="space-y-2.5">
            {(showAllActions ? filteredActions.slice(0, 20) : filteredActions.slice(0, 4)).map((action) => {
              const dyn = getDynamiqueForCount(action.axe_action_count)
              return (
                <div
                  key={action.id}
                  className="bg-white rounded-[18px] p-3.5"
                  style={{ border: '1.5px solid #f0ebe0' }}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                      style={{ background: AVATAR_BG_COLORS[dyn.level] ?? AVATAR_BG_COLORS[0] }}
                    >
                      {action.learner_first_name.charAt(0)}{action.learner_last_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold" style={{ color: '#1a1a2e' }}>
                          {action.learner_first_name} {action.learner_last_name}
                        </span>
                        <span className="text-xs">{dyn.icon}</span>
                        <span className="text-[10px] ml-auto" style={{ color: '#a0937c' }}>
                          {new Date(action.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium" style={{ color: '#92400e' }}>{action.axe_subject}</p>
                    </div>
                  </div>
                  <p className="text-[13px] leading-relaxed mt-2" style={{ color: '#1a1a2e' }}>{action.description}</p>
                  <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid #f5f0e8' }}>
                    <ActionFeedback actionId={action.id} feedback={action.feedback} canInteract={true} />
                  </div>
                </div>
              )
            })}
          </div>

          {filteredActions.length > 4 && (
            <button
              onClick={() => setShowAllActions(prev => !prev)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2.5 rounded-[14px] text-xs font-semibold transition-all"
              style={{
                border: '2px dashed #f0ebe0',
                color: '#a0937c',
                background: showAllActions ? '#fffbeb' : 'transparent',
                borderColor: showAllActions ? '#fbbf24' : '#f0ebe0',
              }}
            >
              {showAllActions
                ? '▲ Replier'
                : `Voir les ${filteredActions.length - 4} autres actions`
              }
            </button>
          )}
        </div>
      ) : filteredLearnerIds.size > 0 ? (
        <div className="rounded-[22px] bg-white p-6 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <p className="text-2xl mb-2">💤</p>
          <p className="text-sm" style={{ color: '#a0937c' }}>Aucune action enregistree</p>
        </div>
      ) : null}
    </div>
  )
}
