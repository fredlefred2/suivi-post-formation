'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, X, ChevronDown, MoreVertical, Sparkles, Loader2 } from 'lucide-react'
import { createGroup, deleteGroup, removeLearnerFromGroup } from './actions'
import { assignToGroup, deleteLearner } from '@/app/(trainer)/trainer/apprenants/actions'

type Group = {
  id: string
  name: string
  theme: string | null
  created_at: string
  group_members: Array<{ count: number }>
}

type MemberInfo = {
  learner_id: string
  first_name: string
  last_name: string
  tips_total: number
  tips_sent: number
}

export default function GroupsClient({
  groups,
  membersMap,
}: {
  groups: Group[]
  membersMap: Record<string, MemberInfo[]>
}) {
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Tous les groupes fermés par défaut
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [deletingLearnerId, setDeletingLearnerId] = useState<string | null>(null)
  const [deletingLearnerGroupId, setDeletingLearnerGroupId] = useState<string | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [rewritingTheme, setRewritingTheme] = useState(false)
  const [createThemeValue, setCreateThemeValue] = useState('')

  async function handleRewriteTheme(currentValue: string, setter: (v: string) => void) {
    if (!currentValue.trim() || currentValue.trim().length < 5) return
    setRewritingTheme(true)
    try {
      const res = await fetch('/api/theme/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: currentValue }),
      })
      const data = await res.json()
      if (data.rewritten) setter(data.rewritten)
    } catch {
      // silently fail
    }
    setRewritingTheme(false)
  }

  // Fermer les menus quand on clique ailleurs
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-menu]')) {
      setOpenMenu(null)
    }
  }, [])

  useEffect(() => {
    if (openMenu) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [openMenu, handleOutsideClick])

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createGroup(formData)
      if (result?.error) setError(result.error)
      else setShowForm(false)
    })
  }

  function handleReassign(learnerId: string, fromGroupId: string, toGroupId: string) {
    setOpenMenu(null)
    startTransition(async () => {
      await removeLearnerFromGroup(fromGroupId, learnerId)
      await assignToGroup(learnerId, toGroupId)
    })
  }

  function handleDeleteLearner() {
    if (!deletingLearnerId) return
    startTransition(async () => {
      await deleteLearner(deletingLearnerId)
      setDeletingLearnerId(null)
      setDeletingLearnerGroupId(null)
    })
  }

  function handleDeleteGroup() {
    if (!deletingGroupId) return
    startTransition(async () => {
      await deleteGroup(deletingGroupId)
      setDeletingGroupId(null)
    })
  }

  function openDeleteLearner(learnerId: string, groupId: string) {
    setOpenMenu(null)
    // Petit délai pour que le menu se ferme avant d'ouvrir la modale
    setTimeout(() => {
      setDeletingLearnerId(learnerId)
      setDeletingLearnerGroupId(groupId)
    }, 50)
  }

  const deletingLearner = deletingLearnerId && deletingLearnerGroupId
    ? membersMap[deletingLearnerGroupId]?.find((m) => m.learner_id === deletingLearnerId)
    : null

  const deletingGroup = deletingGroupId
    ? groups.find((g) => g.id === deletingGroupId)
    : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Groupes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={14} /> Nouveau
        </button>
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <div className="card border-2 border-indigo-100">
          <p className="font-semibold text-gray-800 text-sm mb-3">Nouveau groupe</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label text-xs">Nom du groupe *</label>
              <input name="name" required className="input text-sm py-2.5" placeholder="Ex: Management — Oct. 2024" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label text-xs mb-0">Thème de la formation</label>
                {createThemeValue.trim().length >= 5 && (
                  <button
                    type="button"
                    disabled={rewritingTheme}
                    onClick={() => handleRewriteTheme(createThemeValue, setCreateThemeValue)}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors disabled:opacity-50"
                  >
                    {rewritingTheme ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {rewritingTheme ? 'Réécriture...' : 'Reformuler'}
                  </button>
                )}
              </div>
              <textarea
                name="theme"
                value={createThemeValue}
                onChange={e => setCreateThemeValue(e.target.value)}
                className="input text-sm py-2.5 min-h-[100px] resize-y"
                placeholder="Ex: Communication assertive, gestion des conflits, leadership situationnel..."
              />
              <p className="text-xs text-gray-400 mt-1">Saisissez vos mots-clés puis cliquez sur Reformuler pour obtenir un thème structuré</p>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? 'Création...' : 'Créer'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des groupes */}
      {groups.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-500">Aucun groupe pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const memberCount = group.group_members[0]?.count ?? 0
            const members = membersMap[group.id] ?? []
            const isExpanded = expandedGroups.has(group.id)

            return (
              <div key={group.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-visible">
                {/* Header du groupe */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-lg shrink-0">
                      👥
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900 text-[15px] truncate">{group.name}</p>
                        <span className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                          {memberCount}
                        </span>
                      </div>
                      {group.theme && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{group.theme}</p>
                      )}
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-gray-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {/* Menu groupe */}
                  <div className="relative" data-menu>
                    <button
                      onClick={() => setOpenMenu(openMenu === `group-${group.id}` ? null : `group-${group.id}`)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                    >
                      <MoreVertical size={16} />
                    </button>
                    {openMenu === `group-${group.id}` && (
                      <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1">
                        <Link
                          href={`/trainer/groups/${group.id}`}
                          className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <span>💪</span> Gérer les tips
                        </Link>
                        <button
                          onClick={() => { setDeletingGroupId(group.id); setOpenMenu(null) }}
                          className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <span>🗑️</span> Supprimer le groupe
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Membres */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {members.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Aucun participant dans ce groupe</p>
                    ) : (
                      <div>
                        {members
                          .sort((a, b) => a.last_name.localeCompare(b.last_name, 'fr'))
                          .map((m, idx) => {
                            const isLastTwo = idx >= members.length - 2

                            return (
                              <div key={m.learner_id}>
                                <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                                  {/* Avatar */}
                                  <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-800 font-semibold flex items-center justify-center text-xs shrink-0">
                                    {m.first_name[0]}{m.last_name[0]}
                                  </div>

                                  {/* Nom cliquable → page apprenants, groupe sélectionné, learner en focus */}
                                  <Link
                                    href={`/trainer/apprenants?group=${group.id}&learner=${m.learner_id}`}
                                    className="flex-1 min-w-0"
                                  >
                                    <p className="text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors truncate">
                                      {m.first_name} {m.last_name}
                                    </p>
                                  </Link>

                                  {/* Pastille tips → cliquable vers gestion tips */}
                                  <Link
                                    href={`/trainer/groups/${group.id}?learner=${m.learner_id}`}
                                    className="flex items-center gap-1 shrink-0"
                                  >
                                    {m.tips_total > 0 ? (
                                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium hover:opacity-80 transition-opacity ${
                                        m.tips_sent > 0
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                                      }`}>
                                        {m.tips_sent}/{m.tips_total}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-400 border border-gray-200">
                                        —
                                      </span>
                                    )}
                                    <span className={`text-base ${m.tips_total > 0 ? '' : 'opacity-25'}`}>💪</span>
                                  </Link>

                                  {/* Menu membre */}
                                  <div className="relative" data-menu>
                                    <button
                                      onClick={() => setOpenMenu(openMenu === m.learner_id ? null : m.learner_id)}
                                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                    >
                                      <MoreVertical size={14} />
                                    </button>
                                    {openMenu === m.learner_id && (
                                      <div className={`absolute right-0 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1 ${
                                        isLastTwo ? 'bottom-full mb-1' : 'top-full mt-1'
                                      }`}>
                                        {/* Réaffecter */}
                                        {groups.filter(g => g.id !== group.id).length > 0 && (
                                          <>
                                            <p className="px-3 py-1.5 text-[11px] text-gray-400 font-medium uppercase tracking-wide">Réaffecter à</p>
                                            {groups
                                              .filter(g => g.id !== group.id)
                                              .map(g => (
                                                <button
                                                  key={g.id}
                                                  disabled={isPending}
                                                  onClick={() => handleReassign(m.learner_id, group.id, g.id)}
                                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                                >
                                                  <span>🔄</span> {g.name}
                                                </button>
                                              ))}
                                            <div className="border-t border-gray-100 my-1" />
                                          </>
                                        )}
                                        <button
                                          onClick={() => openDeleteLearner(m.learner_id, group.id)}
                                          className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                          <span>🗑️</span> Supprimer
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Popup confirmation suppression apprenant */}
      {deletingLearnerId && deletingLearner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full">
            <button onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }} className="absolute top-3 right-3 text-gray-500 hover:text-gray-600">
              <X size={18} />
            </button>
            <div className="p-6 text-center">
              <span className="text-4xl">🗑️</span>
              <h3 className="text-lg font-bold text-gray-800 mt-3">Supprimer ce participant ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Vous allez supprimer définitivement <strong className="text-gray-700">{deletingLearner.first_name} {deletingLearner.last_name}</strong> ainsi que toutes ses données (axes, actions, check-ins).
              </p>
              <p className="text-xs text-red-500 mt-2 font-medium">Cette action est irréversible.</p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button
                  disabled={isPending}
                  onClick={handleDeleteLearner}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup confirmation suppression groupe */}
      {deletingGroupId && deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeletingGroupId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full">
            <button onClick={() => setDeletingGroupId(null)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-600">
              <X size={18} />
            </button>
            <div className="p-6 text-center">
              <span className="text-4xl">🗑️</span>
              <h3 className="text-lg font-bold text-gray-800 mt-3">Supprimer ce groupe ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Le groupe <strong className="text-gray-700">{deletingGroup.name}</strong> sera supprimé. Les participants ne seront pas supprimés.
              </p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setDeletingGroupId(null)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button
                  disabled={isPending}
                  onClick={handleDeleteGroup}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
