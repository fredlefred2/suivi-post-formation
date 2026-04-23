'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
import type { ActionFeedbackData } from '@/lib/types'
import { useCountUp } from '@/lib/useCountUp'
import ActionItem from '@/app/components/ui/ActionItem'

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
  /** Gestes 15 derniers jours par apprenant — actions + check-ins + quizz */
  learnerGestes15d?: Record<string, { actions: number; checkins: number; quizzes: number }>
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
  learnerGestes15d = {},
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
  const [showAllActions, setShowAllActions] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

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
    // Synchro : stocker dans localStorage + mettre à jour l'URL
    if (option !== 'all' && option !== 'unassigned') {
      localStorage.setItem('trainer_selected_group', option)
      window.history.replaceState(null, '', `${pathname}?group=${option}`)
    } else {
      // Pour 'all', retirer le param group de l'URL
      window.history.replaceState(null, '', pathname)
    }
  }

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

  // ── Scoring (trié par gestes 15 derniers jours — aligné sur podium apprenant) ──
  const sorted = useMemo(() => {
    return Array.from(filteredLearnerIds).map((lid) => {
      const axesCounts = learnerAxesMap[lid] ?? []
      const totalActions = axesCounts.reduce((a, b) => a + b, 0)
      // Derniere meteo
      const learnerCheckins = filteredCheckins
        .filter(c => c.learner_id === lid)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      const lastWeather = learnerCheckins.length > 0 ? learnerCheckins[0].weather : null
      // Gestes 15j
      const g15 = learnerGestes15d[lid] ?? { actions: 0, checkins: 0, quizzes: 0 }
      const gestes15 = g15.actions + g15.checkins + g15.quizzes
      return { id: lid, name: learnerNameMap[lid] ?? 'Inconnu', totalActions, lastWeather, gestes15, gestes15Breakdown: g15 }
    }).sort((a, b) => b.gestes15 - a.gestes15 || b.totalActions - a.totalActions)
  }, [filteredLearnerIds, learnerAxesMap, learnerNameMap, filteredCheckins, learnerGestes15d])


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

      {/* ── Header navy avec chips intégrées ── */}
      <div
        className="rounded-[28px] relative overflow-hidden"
        style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
      >
        <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />

        {/* ── Chips groupes ── */}
        <div className="relative flex gap-1.5 px-4 pt-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
          <button
            onClick={(e) => { e.stopPropagation(); selectOption('all') }}
            className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all active:scale-95"
            style={{
              background: selectedOption === 'all' ? '#fbbf24' : 'transparent',
              color: selectedOption === 'all' ? '#1a1a2e' : 'rgba(255,255,255,0.5)',
              border: selectedOption === 'all' ? '1.5px solid #fbbf24' : '1.5px solid rgba(255,255,255,0.15)',
            }}
          >
            Tous
          </button>
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={(e) => { e.stopPropagation(); selectOption(g.id) }}
              className="shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all active:scale-95"
              style={{
                background: selectedOption === g.id ? '#fbbf24' : 'transparent',
                color: selectedOption === g.id ? '#1a1a2e' : 'rgba(255,255,255,0.5)',
                border: selectedOption === g.id ? '1.5px solid #fbbf24' : '1.5px solid rgba(255,255,255,0.15)',
              }}
            >
              {g.name === 'Salle d\'attente' ? '⚪ Attente' : g.name}
              <span className="ml-1 opacity-60" style={{ fontSize: 10 }}>{g.members.length}</span>
            </button>
          ))}
        </div>

        {/* ── Contenu cliquable → apprenants ── */}
        <div
          className="relative px-5 pb-5 cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => router.push(`/trainer/apprenants${selectedOption !== 'all' && selectedOption !== 'unassigned' ? `?group=${selectedOption}` : ''}`)}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-[17px] font-extrabold text-white leading-tight">{selectionLabel}</h1>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>{filteredLearnerIds.size} participant{filteredLearnerIds.size !== 1 ? 's' : ''}</p>
            </div>
            {totalWithCheckin > 0 && (() => {
              const max = Math.max(weatherDistribution.sunny, weatherDistribution.cloudy, weatherDistribution.stormy)
              const avgEmoji = weatherDistribution.sunny === max ? '☀️' : weatherDistribution.cloudy === max ? '⛅' : '⛈️'
              return <span className="text-2xl drop-shadow-lg">{avgEmoji}</span>
            })()}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl py-2 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="font-display text-[19px] font-bold" style={{ color: avgRegularity >= 75 ? '#6ee7b7' : avgRegularity >= 50 ? '#fbbf24' : '#f87171' }}>
                {animatedRegularity}%
              </div>
              <p className="text-[9px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>régularité</p>
            </div>
            <div className="rounded-xl py-2 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="font-display text-[19px] font-bold" style={{ color: recentActionsFiltered.length > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                {animatedDelta > 0 ? `+${animatedDelta}` : '0'}
              </div>
              <p className="text-[9px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>cette semaine</p>
            </div>
            <div className="rounded-xl py-2 px-2 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
              {isCheckinOpen ? (
                missingCount === 0 ? (
                  <>
                    <div className="font-display text-[19px] font-bold" style={{ color: '#6ee7b7' }}>✓</div>
                    <p className="text-[9px] mt-0.5 leading-tight" style={{ color: '#6ee7b7' }}>tous à jour</p>
                  </>
                ) : (
                  <>
                    <div className="font-display text-[19px] font-bold" style={{ color: '#fbbf24' }}>{missingCount}</div>
                    <p className="text-[9px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>en attente</p>
                  </>
                )
              ) : (
                <>
                  <div className="font-display text-[19px] font-bold" style={{ color: lastWeekInfo.pct === 100 ? '#6ee7b7' : lastWeekInfo.pct >= 50 ? 'white' : '#fbbf24' }}>
                    {lastWeekInfo.pct}%
                  </div>
                  <p className="text-[9px] mt-0.5 leading-tight" style={{ color: 'rgba(255,255,255,0.45)' }}>check-ins</p>
                </>
              )}
            </div>
          </div>

          {/* Bouton rapport PDF intégré */}
          {selectedOption !== 'all' && (
            <div className="flex justify-end mt-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleDownloadReport() }}
                disabled={isDownloading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 active:scale-95"
                style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
              >
                {isDownloading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                {isDownloading ? (downloadStatus || 'Generation...') : 'Rapport PDF'}
              </button>
            </div>
          )}
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

      {/* ── Podium top 3 — 15 derniers jours (identique au podium apprenant) ── */}
      {sorted.length > 0 && (() => {
        function getInitials(name: string) {
          return name.split(' ').map(n => n[0]).join('').toUpperCase()
        }

        const podium = sorted.filter(s => s.gestes15 > 0).slice(0, 3)
        const podiumDisplay = podium.length >= 3
          ? [podium[1], podium[0], podium[2]]
          : podium.length === 2
          ? [podium[1], podium[0]]
          : podium

        const podiumConfig = [
          {
            avatarSize: 'w-10 h-10',
            avatarBorder: '2px solid #cbd5e1',
            avatarShadow: '0 0 0 3px rgba(148,163,184,0.12)',
            avatarFontSize: 13,
            stepH: 34,
            stepBg: 'linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)',
            stepColor: '#475569',
            stepFontSize: 18,
            chipBg: '#f1f5f9',
            chipColor: '#475569',
            chipBorder: '1px solid #e2e8f0',
          },
          {
            avatarSize: 'w-[52px] h-[52px]',
            avatarBorder: '3px solid #fbbf24',
            avatarShadow: '0 4px 14px rgba(251,191,36,0.4), 0 0 0 3px rgba(251,191,36,0.15)',
            avatarFontSize: 16,
            stepH: 50,
            stepBg: 'linear-gradient(180deg, #fbbf24 0%, #f59e0b 100%)',
            stepColor: '#fff',
            stepFontSize: 22,
            chipBg: '#fffbeb',
            chipColor: '#92400e',
            chipBorder: '1px solid #fde68a',
          },
          {
            avatarSize: 'w-10 h-10',
            avatarBorder: '2px solid #fdba74',
            avatarShadow: '0 0 0 3px rgba(253,186,116,0.15)',
            avatarFontSize: 13,
            stepH: 24,
            stepBg: 'linear-gradient(180deg, #fdba74 0%, #f97316 100%)',
            stepColor: '#fff',
            stepFontSize: 18,
            chipBg: '#fff7ed',
            chipColor: '#9a3412',
            chipBorder: '1px solid #fed7aa',
          },
        ]

        if (podium.length === 0) {
          return (
            <div className="rounded-[18px] bg-white p-4 text-center" style={{ border: '2px solid #f0ebe0' }}>
              <p className="text-xl mb-1">🌅</p>
              <p className="text-[12px]" style={{ color: '#a0937c' }}>La quinzaine commence, personne n&apos;a encore posté.</p>
            </div>
          )
        }

        return (
          <div
            className="rounded-[18px] px-3 pt-3 pb-2 cursor-pointer active:scale-[0.98] transition-transform"
            onClick={() => router.push(`/trainer/apprenants${selectedOption !== 'all' && selectedOption !== 'unassigned' ? `?group=${selectedOption}` : ''}`)}
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #fffbf0 100%)',
              border: '2px solid #f0ebe0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <h2 className="text-[10.5px] font-extrabold tracking-wider uppercase text-center mb-2" style={{ color: '#a0937c' }}>
              Les plus actifs · 15 derniers jours
            </h2>
            <div className="flex items-end justify-center gap-2">
              {podiumDisplay.map((learner, displayIdx) => {
                const cfg = podiumConfig[podium.length >= 3 ? displayIdx : podium.length === 2 ? (displayIdx === 0 ? 0 : 1) : 1]
                const actualRank = podium.indexOf(learner) + 1
                const gestes = learner.gestes15
                return (
                  <div key={learner.id} className="flex flex-col items-center flex-1" style={{ maxWidth: 110 }}>
                    <div
                      className={`${cfg.avatarSize} rounded-full flex items-center justify-center font-extrabold mb-1 transition-transform`}
                      style={{
                        background: '#1a1a2e',
                        color: '#fbbf24',
                        border: cfg.avatarBorder,
                        boxShadow: cfg.avatarShadow,
                        fontSize: cfg.avatarFontSize,
                      }}
                    >
                      {getInitials(learner.name)}
                    </div>

                    <p className="text-[11px] font-extrabold text-center truncate w-full mb-1.5" style={{ color: '#1a1a2e' }}>
                      {learner.name.split(' ')[0]}
                    </p>

                    <div
                      className="w-full rounded-t-[12px] flex items-center justify-center font-extrabold"
                      style={{
                        height: cfg.stepH,
                        background: cfg.stepBg,
                        color: cfg.stepColor,
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: cfg.stepFontSize,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {actualRank}
                    </div>

                    {/* Chip "X gestes" */}
                    <div
                      className="mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold"
                      style={{
                        background: cfg.chipBg,
                        color: cfg.chipColor,
                        border: cfg.chipBorder,
                      }}
                    >
                      {gestes} geste{gestes !== 1 ? 's' : ''}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[9.5px] text-center mt-2" style={{ color: '#a0937c' }}>
              1 geste = 1 action · 1 check-in · 1 quiz
            </p>
          </div>
        )
      })()}

      {/* ── Classement 4e+ — gestes 15 derniers jours ── */}
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
              <div
                className="px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0"
                style={{
                  background: learner.gestes15 > 0 ? '#fffbeb' : '#f1f5f9',
                  color: learner.gestes15 > 0 ? '#92400e' : '#64748b',
                  border: learner.gestes15 > 0 ? '1px solid #fde68a' : '1px solid #e2e8f0',
                }}
              >
                {learner.gestes15} geste{learner.gestes15 !== 1 ? 's' : ''}
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

          <div className="rounded-[18px] bg-white px-4" style={{ border: '2px solid #f0ebe0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            {(showAllActions ? filteredActions.slice(0, 20) : filteredActions.slice(0, 4)).map((action) => (
              <ActionItem
                key={action.id}
                action={{
                  id: action.id,
                  description: action.description,
                  created_at: action.created_at,
                  axe_subject: action.axe_subject,
                  axe_action_count: action.axe_action_count,
                  learner_first_name: action.learner_first_name,
                  learner_last_name: action.learner_last_name,
                }}
                feedback={action.feedback}
                showAuthor
                showAxe
                lineClamp={3}
                avatarSize={38}
              />
            ))}
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
