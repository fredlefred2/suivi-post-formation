'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import Link from 'next/link'
import { UserCheck, UserMinus, ChevronDown } from 'lucide-react'
import { assignToGroup, removeFromGroup } from './actions'

type LearnerStats = {
  axesCount: number
  actionsTotal: number
  actionsThisWeek: number
}

type Learner = {
  id: string
  first_name: string
  last_name: string
  groupId: string | null
  groupName: string | null
  stats: LearnerStats | null
}

type Group = {
  id: string
  name: string
}

function RadioDot({ active, amber = false }: { active: boolean; amber?: boolean }) {
  const color = amber ? 'border-amber-500' : 'border-indigo-600'
  const dot = amber ? 'bg-amber-500' : 'bg-indigo-600'
  return (
    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${active ? color : 'border-gray-300'}`}>
      {active && <span className={`w-2 h-2 rounded-full ${dot}`} />}
    </span>
  )
}

function LearnerRow({ learner, groups }: { learner: Learner; groups: Group[] }) {
  const [selectedGroup, setSelectedGroup] = useState('')
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'error' | 'ok'; text: string } | null>(null)

  function handleAssign() {
    if (!selectedGroup) return
    setMsg(null)
    startTransition(async () => {
      const result = await assignToGroup(learner.id, selectedGroup)
      if (result?.error) {
        setMsg({ type: 'error', text: result.error })
      } else {
        setMsg({ type: 'ok', text: 'Affecté !' })
      }
    })
  }

  function handleRemove() {
    if (!learner.groupId) return
    setMsg(null)
    startTransition(async () => {
      const result = await removeFromGroup(learner.id, learner.groupId!)
      if (result?.error) setMsg({ type: 'error', text: result.error })
      else setMsg({ type: 'ok', text: 'Retiré du groupe.' })
    })
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-indigo-200 text-indigo-800 font-semibold flex items-center justify-center text-sm shrink-0">
        {learner.first_name[0]}{learner.last_name[0]}
      </div>

      {/* Nom + stats */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/trainer/learner/${learner.id}?from=apprenants${learner.groupId ? `&group=${learner.groupId}` : ''}`}
          className="font-medium text-gray-900 hover:text-indigo-600 hover:underline transition-colors"
        >
          {learner.first_name} {learner.last_name}
        </Link>
        {learner.stats && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {/* Axes */}
            <span className="inline-flex items-center gap-1 text-xs bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-medium">
              🎯 <span>{learner.stats.axesCount} axe{learner.stats.axesCount > 1 ? 's' : ''}</span>
            </span>
            {/* Actions totales */}
            <span className="inline-flex items-center gap-1 text-xs bg-gray-200 text-gray-700 border border-gray-300 px-2 py-0.5 rounded-full font-medium">
              ⚡ <span>{learner.stats.actionsTotal} action{learner.stats.actionsTotal > 1 ? 's' : ''}</span>
            </span>
            {/* Delta cette semaine */}
            {learner.stats.actionsThisWeek > 0 ? (
              <span className="inline-flex items-center gap-1 text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                +{learner.stats.actionsThisWeek} cette sem.
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-500 border border-gray-300 px-2 py-0.5 rounded-full">
                0 cette sem.
              </span>
            )}
          </div>
        )}
        {msg && (
          <p className={`text-xs mt-0.5 ${msg.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Action selon l'état */}
      {learner.groupId ? (
        <div className="flex items-center shrink-0">
          <button
            onClick={handleRemove}
            disabled={isPending}
            title="Retirer du groupe"
            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
          >
            <UserMinus size={16} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs bg-amber-100 text-amber-800 border border-amber-300 px-2 py-1 rounded-full">
            Non affecté
          </span>
          {groups.length > 0 && (
            <>
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-400"
              >
                <option value="">Affecter à...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <button
                onClick={handleAssign}
                disabled={isPending || !selectedGroup}
                title="Affecter au groupe"
                className="p-1.5 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-40"
              >
                <UserCheck size={16} />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function ApprenantsClient({
  learners,
  groups,
  initialGroup = 'all',
}: {
  learners: Learner[]
  groups: Group[]
  initialGroup?: string
}) {
  // 'all' | groupId | 'unassigned'
  const [selectedOption, setSelectedOption] = useState<'all' | string>(initialGroup)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function selectOption(option: string) {
    setSelectedOption(option)
    setDropdownOpen(false)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const unassigned = learners.filter((l) => !l.groupId)
  const assigned = learners.filter((l) => l.groupId)

  // Label du bouton dropdown
  const selectionLabel =
    selectedOption === 'all'
      ? 'Tous les groupes'
      : selectedOption === 'unassigned'
      ? '⚠️ Non affectés'
      : groups.find((g) => g.id === selectedOption)?.name ?? 'Groupe'

  // Learners visibles selon la sélection
  const filteredByGroup =
    selectedOption === 'all'
      ? null // vue groupée
      : selectedOption === 'unassigned'
      ? unassigned
      : learners.filter((l) => l.groupId === selectedOption)

  // Pour la vue "Tous les groupes" : regrouper par groupe
  const groupedView = selectedOption === 'all'
    ? groups.map((g) => ({
        group: g,
        learners: learners.filter((l) => l.groupId === g.id),
      })).filter((g) => g.learners.length > 0)
    : []

  const totalAssigned = assigned.length
  const totalUnassigned = unassigned.length

  return (
    <div className="space-y-6 pb-4">
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
          boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative">
          <h1 className="text-xl font-extrabold text-white">Participants</h1>
          <p className="text-xs text-indigo-200 mt-0.5">{learners.length} inscrit{learners.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {learners.length === 0 ? (
        <div className="card text-center py-10 text-gray-500 text-sm">
          Aucun participant inscrit pour l&apos;instant.
        </div>
      ) : (
        <>
          {/* ── Dropdown sélection groupe ─────────────────────────────── */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-colors shadow-sm min-w-[220px] justify-between ${
                dropdownOpen
                  ? 'border-indigo-400 text-indigo-700 ring-2 ring-indigo-100'
                  : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700'
              }`}
            >
              <span className="truncate">👥 {selectionLabel}</span>
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
                  <span className="ml-auto text-xs text-gray-500">{totalAssigned} app.</span>
                </button>

                {/* Groupes individuels */}
                <div className="py-1">
                  {groups.map((g) => {
                    const count = learners.filter((l) => l.groupId === g.id).length
                    return (
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
                        <span className="ml-auto text-xs text-gray-500">{count} app.</span>
                      </button>
                    )
                  })}
                </div>

                {/* Non affectés */}
                <div className="border-t border-gray-100 py-1">
                  <button
                    onClick={() => selectOption('unassigned')}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      selectedOption === 'unassigned' ? 'bg-amber-50' : 'hover:bg-amber-50'
                    }`}
                  >
                    <RadioDot active={selectedOption === 'unassigned'} amber />
                    <span className={`text-sm font-medium ${selectedOption === 'unassigned' ? 'text-amber-700' : 'text-amber-600'}`}>
                      ⚠️ Non affectés
                    </span>
                    <span className={`ml-auto text-xs font-semibold px-1.5 py-0.5 rounded-full border ${
                      totalUnassigned > 0
                        ? 'text-amber-800 bg-amber-100 border-amber-300'
                        : 'text-gray-500 bg-gray-100 border-gray-300'
                    }`}>
                      {totalUnassigned}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Vue "Tous les groupes" ────────────────────────────────── */}
          {selectedOption === 'all' && (
            <>
              {/* Non affectés en premier si existants */}
              {unassigned.length > 0 && (
                <div className="card border-amber-200">
                  <h2 className="section-title mb-3">
                    En attente d&apos;affectation
                    <span className="ml-2 text-xs font-normal bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                      {unassigned.length}
                    </span>
                  </h2>
                  {groups.length === 0 && (
                    <p className="text-xs text-gray-500 mb-3">
                      Créez d&apos;abord un groupe pour pouvoir affecter des participants.
                    </p>
                  )}
                  <div className="space-y-2">
                    {unassigned.map((l) => (
                      <LearnerRow key={l.id} learner={l} groups={groups} />
                    ))}
                  </div>
                </div>
              )}

              {/* Un bloc par groupe */}
              {groupedView.map(({ group, learners: groupLearners }) => (
                <div key={group.id} className="card">
                  <h2 className="section-title mb-3">
                    {group.name}
                    <span className="ml-2 text-xs font-normal bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                      {groupLearners.length}
                    </span>
                  </h2>
                  <div className="space-y-2">
                    {groupLearners.map((l) => (
                      <LearnerRow key={l.id} learner={l} groups={groups} />
                    ))}
                  </div>
                </div>
              ))}

              {groupedView.length === 0 && unassigned.length === 0 && (
                <div className="card text-center py-8 text-gray-500 text-sm">
                  Aucun participant dans vos groupes.
                </div>
              )}
            </>
          )}

          {/* ── Vue groupe unique ─────────────────────────────────────── */}
          {selectedOption !== 'all' && selectedOption !== 'unassigned' && (
            filteredByGroup && filteredByGroup.length > 0 ? (
              <div className="card">
                <h2 className="section-title mb-3">
                  {groups.find((g) => g.id === selectedOption)?.name}
                  <span className="ml-2 text-xs font-normal bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {filteredByGroup.length}
                  </span>
                </h2>
                <div className="space-y-2">
                  {filteredByGroup.map((l) => (
                    <LearnerRow key={l.id} learner={l} groups={groups} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="card text-center py-8 text-gray-500 text-sm">
                Aucun participant dans ce groupe.
              </div>
            )
          )}

          {/* ── Vue non affectés ──────────────────────────────────────── */}
          {selectedOption === 'unassigned' && (
            unassigned.length > 0 ? (
              <div className="card border-amber-200">
                <h2 className="section-title mb-3 text-amber-700">
                  ⚠️ En attente d&apos;affectation
                  <span className="ml-2 text-xs font-normal bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full">
                    {unassigned.length}
                  </span>
                </h2>
                {groups.length === 0 && (
                  <p className="text-xs text-gray-500 mb-3">
                    Créez d&apos;abord un groupe pour pouvoir affecter des participants.
                  </p>
                )}
                <div className="space-y-2">
                  {unassigned.map((l) => (
                    <LearnerRow key={l.id} learner={l} groups={groups} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="card text-center py-8 text-gray-500 text-sm">
                ✅ Tous les participants sont affectés à un groupe.
              </div>
            )
          )}
        </>
      )}
    </div>
  )
}
