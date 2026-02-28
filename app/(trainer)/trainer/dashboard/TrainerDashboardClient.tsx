'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { ChevronDown } from 'lucide-react'
import type { PieEntry } from './WeatherPieChart'

const WeatherPieChart = dynamic(() => import('./WeatherPieChart'), { ssr: false })

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
}

export type UnassignedLearner = {
  id: string
  first_name: string
  last_name: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

const WEATHER_CONFIG = {
  sunny:  { label: 'Ça roule',  emoji: '☀️', color: '#fbbf24' },
  cloudy: { label: 'Mitigé',    emoji: '⛅', color: '#94a3b8' },
  stormy: { label: 'Difficile', emoji: '⛈️', color: '#f87171' },
}

export default function TrainerDashboardClient({
  groups,
  checkins,
  actions,
  currentWeek,
  currentYear,
  unassignedLearners = [],
}: {
  groups: GroupData[]
  checkins: CheckinData[]
  actions: ActionData[]
  currentWeek: number
  currentYear: number
  unassignedLearners?: UnassignedLearner[]
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

  // ── Camembert météo — dernier check-in par apprenant ─────────────────────
  const pieData: PieEntry[] = useMemo(() => {
    const latestByLearner: Record<string, CheckinData> = {}
    ;[...filteredCheckins]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .forEach((c) => {
        if (!latestByLearner[c.learner_id]) latestByLearner[c.learner_id] = c
      })

    const weatherGroups: Record<string, string[]> = { sunny: [], cloudy: [], stormy: [] }
    Object.entries(latestByLearner).forEach(([lid, c]) => {
      weatherGroups[c.weather]?.push(learnerNameMap[lid] ?? 'Inconnu')
    })

    return (['sunny', 'cloudy', 'stormy'] as const)
      .filter((k) => weatherGroups[k].length > 0)
      .map((k) => ({
        name: WEATHER_CONFIG[k].label,
        emoji: WEATHER_CONFIG[k].emoji,
        color: WEATHER_CONFIG[k].color,
        value: weatherGroups[k].length,
        learnerNames: weatherGroups[k],
      }))
  }, [filteredCheckins, learnerNameMap])

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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-indigo-600">{filteredGroups.length}</p>
          <p className="text-xs text-gray-500 mt-1">Groupe{filteredGroups.length > 1 ? 's' : ''}</p>
        </div>
        <div className="card text-center py-4">
          <p className="text-2xl font-bold text-indigo-600">{filteredLearnerIds.size}</p>
          <p className="text-xs text-gray-500 mt-1">Apprenant{filteredLearnerIds.size > 1 ? 's' : ''}</p>
        </div>
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
        pieData.length > 0 ? (
          <div className="card">
            <h2 className="section-title mb-4">Tendance météo</h2>
            <WeatherPieChart data={pieData} />
          </div>
        ) : (
          <div className="card text-center py-8 text-gray-400 text-sm">
            Aucun check-in enregistré pour la sélection
          </div>
        )
      )}

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
          <div className="space-y-2">
            {recentActions.map((action) => (
              <div
                key={action.id}
                className="p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-sm text-gray-900">{action.learner_name}</span>
                  <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
                    {action.axe_subject}
                  </span>
                  <span className="text-xs text-gray-400 ml-auto whitespace-nowrap">
                    {formatDate(action.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{action.description}</p>
              </div>
            ))}
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
