'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { WEATHER_COLORS } from '@/lib/types'
import type { ActionFeedbackData } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'

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
  axe_subject: string
  feedback: ActionFeedbackData
}

export type UnassignedLearner = {
  id: string
  first_name: string
  last_name: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const WEATHER_DISPLAY = [
  { key: 'sunny'  as const, emoji: '☀️'  },
  { key: 'cloudy' as const, emoji: '⛅'  },
  { key: 'stormy' as const, emoji: '🌧️' },
]

const WEATHER_POINTS: Record<string, number> = { stormy: 0, cloudy: 1, sunny: 2 }

function getOverallWeatherEmoji(score: number) {
  if (score < 0.4)  return '🌧️'     // Difficile
  if (score < 0.8)  return '🌥️'     // Nuage gris
  if (score < 1.2)  return '⛅'      // Mitigé
  if (score <= 1.6) return '🌤️'     // Soleil avec petits nuages
  return '☀️'                        // Ça roule
}

// Médaille pour le scoring
function getMedalForCount(count: number) {
  if (count === 0) return { icon: '—', level: 0 }
  if (count <= 2) return { icon: '🥉', level: 1 }
  if (count <= 5) return { icon: '🥈', level: 2 }
  if (count <= 8) return { icon: '🥇', level: 3 }
  return { icon: '🏅', level: 4 }
}

export default function TrainerDashboardClient({
  groups,
  checkins,
  actions,
  currentWeek,
  currentYear,
  unassignedLearners = [],
  learnerAxesMap = {},
}: {
  groups: GroupData[]
  checkins: CheckinData[]
  actions: ActionData[]
  currentWeek: number
  currentYear: number
  unassignedLearners?: UnassignedLearner[]
  learnerAxesMap?: Record<string, number[]>
}) {
  // 'all' = tous les groupes | groupId = un seul groupe | 'unassigned' = non affectés
  const [selectedOption, setSelectedOption] = useState<'all' | string>('all')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function selectOption(option: string) {
    setSelectedOption(option)
    setDropdownOpen(false)
  }

  // Fermeture du dropdown au clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  // Label du bouton dropdown
  const selectionLabel =
    selectedOption === 'all'
      ? 'Tous les groupes'
      : selectedOption === 'unassigned'
      ? '⚠️ Non affectés'
      : groups.find((g) => g.id === selectedOption)?.name ?? 'Groupe'

  // ── Données filtrées ──────────────────────────────────────────────────────
  const filteredGroups =
    selectedOption === 'all'
      ? groups
      : selectedOption === 'unassigned'
      ? []
      : groups.filter((g) => g.id === selectedOption)

  const filteredLearnerIds = useMemo(() => {
    if (selectedOption === 'unassigned') {
      return new Set(unassignedLearners.map((l) => l.id))
    }
    return new Set(filteredGroups.flatMap((g) => g.members.map((m) => m.learner_id)))
  }, [filteredGroups, selectedOption, unassignedLearners])

  const learnerNameMap = useMemo(() => {
    const map: Record<string, string> = {}
    groups.forEach((g) =>
      g.members.forEach((m) => {
        map[m.learner_id] = `${m.first_name} ${m.last_name}`
      })
    )
    unassignedLearners.forEach((l) => {
      map[l.id] = `${l.first_name} ${l.last_name}`
    })
    return map
  }, [groups, unassignedLearners])

  const filteredCheckins = checkins.filter((c) => filteredLearnerIds.has(c.learner_id))
  const thisWeekCheckins = filteredCheckins.filter(
    (c) => c.week_number === currentWeek && c.year === currentYear
  )
  const filteredActions = actions.filter((a) => filteredLearnerIds.has(a.learner_id))

  // ── Météo : dernier check-in par apprenant → comptage + noms ─────────────
  const weatherSummary = useMemo(() => {
    const latestByLearner: Record<string, CheckinData> = {}
    ;[...filteredCheckins]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((c) => {
        if (!latestByLearner[c.learner_id]) latestByLearner[c.learner_id] = c
      })

    const result: Record<'sunny' | 'cloudy' | 'stormy', { count: number; names: string[] }> = {
      sunny:  { count: 0, names: [] },
      cloudy: { count: 0, names: [] },
      stormy: { count: 0, names: [] },
    }
    Object.entries(latestByLearner).forEach(([lid, c]) => {
      const w = c.weather as 'sunny' | 'cloudy' | 'stormy'
      if (result[w]) {
        result[w].count++
        result[w].names.push(learnerNameMap[lid] ?? 'Inconnu')
      }
    })
    return result
  }, [filteredCheckins, learnerNameMap])

  const totalWithCheckin = Object.values(weatherSummary).reduce((acc, v) => acc + v.count, 0)
  const hasAnyCheckin = totalWithCheckin > 0

  const recentActions = filteredActions.slice(0, 10)

  // Petit point radio visuel
  function RadioDot({ active }: { active: boolean }) {
    return (
      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
        active ? 'border-indigo-600' : 'border-gray-300'
      }`}>
        {active && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
      </span>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Dropdown sélection groupe ───────────────────────────────────── */}
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
          <ChevronDown
            size={16}
            className={`shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {dropdownOpen && (
          <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[260px]">

            {/* Tous les groupes */}
            <button
              onClick={() => selectOption('all')}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-gray-100 transition-colors ${
                selectedOption === 'all' ? 'bg-indigo-50' : 'hover:bg-gray-50'
              }`}
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

            {/* Groupes individuels */}
            <div className="py-1">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectOption(g.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selectedOption === g.id ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <RadioDot active={selectedOption === g.id} />
                  <span className={`text-sm ${selectedOption === g.id ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}>
                    {g.name}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{g.members.length} app.</span>
                </button>
              ))}
            </div>

            {/* Séparateur + Non affectés */}
            <div className="border-t border-gray-100 py-1">
              <button
                onClick={() => selectOption('unassigned')}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  selectedOption === 'unassigned' ? 'bg-amber-50' : 'hover:bg-amber-50'
                }`}
              >
                <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selectedOption === 'unassigned' ? 'border-amber-500' : 'border-gray-300'
                }`}>
                  {selectedOption === 'unassigned' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                </span>
                <span className={`text-sm font-medium ${selectedOption === 'unassigned' ? 'text-amber-700' : 'text-amber-600'}`}>
                  ⚠️ Non affectés
                </span>
                <span className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full border ${
                  unassignedLearners.length > 0
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-gray-400 bg-gray-50 border-gray-200'
                }`}>
                  {unassignedLearners.length}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Alerte apprenants non affectés ─────────────────────────────── */}
      {unassignedLearners.length > 0 && selectedOption !== 'unassigned' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
          <span className="text-lg">⚠️</span>
          <span className="text-amber-800">
            <strong>{unassignedLearners.length}</strong> apprenant{unassignedLearners.length > 1 ? 's' : ''} non affecté{unassignedLearners.length > 1 ? 's' : ''} à aucun groupe.
          </span>
          <button
            onClick={() => selectOption('unassigned')}
            className="ml-auto text-amber-700 hover:text-amber-900 underline text-xs whitespace-nowrap font-medium"
          >
            Afficher →
          </button>
        </div>
      )}

      {/* ── Badges stats ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        <Link
          href={`/trainer/apprenants?group=${selectedOption}`}
          className="card text-center py-4 hover:border-indigo-200 hover:bg-indigo-50 transition-colors cursor-pointer"
        >
          <p className="text-2xl font-bold text-indigo-600">{filteredLearnerIds.size}</p>
          <p className="text-xs text-gray-500 mt-1">Apprenant{filteredLearnerIds.size > 1 ? 's' : ''}</p>
        </Link>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-emerald-600 leading-none">
            {thisWeekCheckins.length}
            <span className="text-sm font-normal text-gray-400">/{filteredLearnerIds.size}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Check-ins S{currentWeek}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-amber-600">{filteredActions.length}</p>
          <p className="text-xs text-gray-500 mt-1">Actions menées</p>
        </div>
      </div>

      {/* ── Tendance météo ─────────────────────────────────────────────── */}
      {selectedOption !== 'unassigned' && (
        hasAnyCheckin ? (() => {
          const overallScore = totalWithCheckin > 0
            ? Object.entries(weatherSummary).reduce((acc, [key, { count }]) => acc + count * (WEATHER_POINTS[key] ?? 0), 0) / totalWithCheckin
            : 0
          const overallEmoji = getOverallWeatherEmoji(overallScore)

          return (
            <div className="card">
              <h2 className="section-title mb-3">Tendance météo</h2>
              <div className="flex items-center gap-4">
                {/* Détail par météo — vertical */}
                <div className="flex flex-col gap-2 flex-1">
                  {WEATHER_DISPLAY.map(({ key, emoji }) => {
                    const { count, names } = weatherSummary[key]
                    const pct = totalWithCheckin > 0
                      ? Math.round((count / totalWithCheckin) * 100)
                      : 0
                    return (
                      <div key={key} className="relative group">
                        <div className="flex items-center gap-3 rounded-lg px-3 py-2 bg-gray-50">
                          <span className="text-xl">{emoji}</span>
                          <span className="font-bold text-gray-800">{count}</span>
                          <span className="text-xs text-gray-400">({pct}%)</span>
                        </div>

                        {/* Tooltip au survol */}
                        {names.length > 0 && (
                          <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-20
                                          invisible group-hover:visible opacity-0 group-hover:opacity-100
                                          transition-opacity duration-150
                                          bg-gray-900 text-white text-xs rounded-lg px-3 py-2
                                          shadow-lg pointer-events-none w-max max-w-[200px]">
                            {names.map((name, i) => (
                              <p key={i} className="leading-snug">· {name}</p>
                            ))}
                            <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Météo générale — grosse icône */}
                <div className="flex flex-col items-center justify-center px-4">
                  <span className="text-7xl leading-none">{overallEmoji}</span>
                  <p className="text-xs text-gray-400 mt-2 text-center">Météo générale</p>
                </div>
              </div>
            </div>
          )
        })() : (
          <div className="card text-center py-8 text-gray-400 text-sm">
            Aucun check-in enregistré pour la sélection
          </div>
        )
      )}

      {/* ── Scoring apprenants ─────────────────────────────────────────── */}
      {selectedOption !== 'unassigned' && filteredLearnerIds.size > 0 && (() => {
        const scoringData = Array.from(filteredLearnerIds).map((lid) => {
          const axesCounts = learnerAxesMap[lid] ?? []
          const totalActions = axesCounts.reduce((a, b) => a + b, 0)
          const medals = [0, 1, 2].map((i) => getMedalForCount(axesCounts[i] ?? 0))
          const totalLevel = medals.reduce((a, m) => a + m.level, 0)
          return {
            id: lid,
            name: learnerNameMap[lid] ?? 'Inconnu',
            totalActions,
            medals,
            totalLevel,
          }
        })
        .sort((a, b) => b.totalLevel - a.totalLevel || b.totalActions - a.totalActions)

        return scoringData.length > 0 ? (
          <div className="card">
            <h2 className="section-title mb-3">Classement</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="text-left pb-2 font-medium">#</th>
                  <th className="text-left pb-2 font-medium">Apprenant</th>
                  <th className="text-center pb-2 font-medium">Actions</th>
                  <th className="text-center pb-2 font-medium">Axe 1</th>
                  <th className="text-center pb-2 font-medium">Axe 2</th>
                  <th className="text-center pb-2 font-medium">Axe 3</th>
                </tr>
              </thead>
              <tbody>
                {scoringData.map((learner, idx) => (
                  <tr key={learner.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 text-xs text-gray-400 w-6">{idx + 1}</td>
                    <td className="py-1.5 font-medium text-gray-800 truncate max-w-[140px]">
                      <Link href={`/trainer/learner/${learner.id}`} className="hover:text-indigo-600 transition-colors">
                        {learner.name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-center font-semibold text-gray-700">{learner.totalActions}</td>
                    {learner.medals.map((m, i) => (
                      <td key={i} className="py-1.5 text-center text-base">{m.icon}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      })()}

      {/* ── Liste non affectés ─────────────────────────────────────────── */}
      {selectedOption === 'unassigned' && (
        unassignedLearners.length > 0 ? (
          <div className="card border-amber-100">
            <h2 className="section-title mb-3 text-amber-700">⚠️ Apprenants non affectés</h2>
            <div className="space-y-1.5">
              {unassignedLearners.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-100"
                >
                  <span className="text-sm font-medium text-gray-800">
                    {l.first_name} {l.last_name}
                  </span>
                  <span className="ml-auto text-xs text-amber-600 bg-white border border-amber-200 px-2 py-0.5 rounded-full">
                    Non affecté
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card text-center py-8 text-gray-400 text-sm">
            ✅ Tous les apprenants sont affectés à un groupe
          </div>
        )
      )}

      {/* ── Dernières actions ──────────────────────────────────────────── */}
      {recentActions.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">Dernières actions enregistrées</h2>
          <div className="divide-y divide-gray-50">
            {recentActions.map((action) => {
              const initials = action.learner_name
                .split(' ')
                .map((n) => n[0] ?? '')
                .join('')
                .slice(0, 2)
                .toUpperCase()
              return (
                <div
                  key={action.id}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  {/* Avatar initiales */}
                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                    {initials}
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 leading-snug">
                      ⚡ {action.description}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500 font-medium">{action.learner_name}</span>
                      <span className="text-gray-300 text-xs">·</span>
                      <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-1.5 py-0.5 rounded-full">
                        {action.axe_subject}
                      </span>
                      <span className="ml-auto text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(action.created_at)}
                      </span>
                    </div>
                    {/* Like + Commentaire */}
                    <div className="mt-1.5">
                      <ActionFeedback
                        actionId={action.id}
                        feedback={action.feedback}
                        canInteract={true}
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {recentActions.length === 0 && filteredLearnerIds.size > 0 && selectedOption !== 'unassigned' && (
        <div className="card text-center py-8 text-gray-400 text-sm">
          Aucune action enregistrée pour la sélection
        </div>
      )}
    </div>
  )
}
