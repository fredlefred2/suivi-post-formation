'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2, Pencil, UserPlus, X } from 'lucide-react'
import { createGroup, deleteGroup, removeLearnerFromGroup } from './actions'
import { assignToGroup, deleteLearner } from '@/app/(trainer)/trainer/apprenants/actions'

type Group = {
  id: string
  name: string
  created_at: string
  group_members: Array<{ count: number }>
}

type MemberInfo = {
  learner_id: string
  first_name: string
  last_name: string
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
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null)
  const [reassigningLearnerId, setReassigningLearnerId] = useState<string | null>(null)
  const [deletingLearnerId, setDeletingLearnerId] = useState<string | null>(null)
  const [deletingLearnerGroupId, setDeletingLearnerGroupId] = useState<string | null>(null)

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
    startTransition(async () => {
      await removeLearnerFromGroup(fromGroupId, learnerId)
      await assignToGroup(learnerId, toGroupId)
      setReassigningLearnerId(null)
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

  // Trouver le nom de l'apprenant en cours de suppression
  const deletingLearner = deletingLearnerId && deletingLearnerGroupId
    ? membersMap[deletingLearnerGroupId]?.find((m) => m.learner_id === deletingLearnerId)
    : null

  return (
    <div className="space-y-4">
      {/* Formulaire de création */}
      {showForm ? (
        <div className="card border-2 border-indigo-100">
          <h2 className="section-title mb-4">Nouveau groupe</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label">Nom du groupe *</label>
              <input name="name" required className="input" placeholder="Ex: Management niveau 1 — Octobre 2024" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? 'Création...' : 'Créer le groupe'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Annuler
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> Créer un groupe
        </button>
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
            const isExpanded = expandedGroupId === group.id

            return (
              <div key={group.id}>
                <div className="card flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{group.name}</p>
                    <p className="text-sm text-gray-500">{memberCount} participant{memberCount > 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
                    className={`px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                      isExpanded
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-200 hover:text-indigo-600'
                    }`}
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Supprimer le groupe "${group.name}" ?`)) {
                        startTransition(() => deleteGroup(group.id))
                      }
                    }}
                    className="btn-danger px-3 py-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Panneau membres expandé */}
                {isExpanded && (
                  <div className="mt-1 ml-2 mr-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    {members.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-3">Aucun participant dans ce groupe</p>
                    ) : (
                      <div className="space-y-2">
                        {members
                          .sort((a, b) => a.last_name.localeCompare(b.last_name, 'fr'))
                          .map((m) => (
                          <div key={m.learner_id}>
                            <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-gray-100">
                              <span className="text-sm font-medium text-gray-800 flex-1">
                                {m.first_name} {m.last_name}
                              </span>
                              <button
                                onClick={() => setReassigningLearnerId(
                                  reassigningLearnerId === m.learner_id ? null : m.learner_id
                                )}
                                disabled={isPending}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-800 bg-indigo-100 border border-indigo-300 rounded-lg hover:bg-indigo-200 transition-colors disabled:opacity-50"
                              >
                                <UserPlus size={14} />
                                Affecter
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingLearnerId(m.learner_id)
                                  setDeletingLearnerGroupId(group.id)
                                }}
                                disabled={isPending}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-100 border border-red-300 rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50"
                              >
                                <Trash2 size={14} />
                                Supprimer
                              </button>
                            </div>

                            {/* Dropdown réaffectation : autres groupes */}
                            {reassigningLearnerId === m.learner_id && (
                              <div className="mt-1 ml-4 p-2 bg-white border border-indigo-100 rounded-lg shadow-sm">
                                <p className="text-xs text-gray-500 mb-1.5 font-medium">Réaffecter à :</p>
                                <div className="space-y-1">
                                  {groups
                                    .filter((g) => g.id !== group.id)
                                    .map((g) => (
                                      <button
                                        key={g.id}
                                        disabled={isPending}
                                        onClick={() => handleReassign(m.learner_id, group.id, g.id)}
                                        className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 transition-colors disabled:opacity-50"
                                      >
                                        {g.name}
                                      </button>
                                    ))}
                                  {groups.filter((g) => g.id !== group.id).length === 0 && (
                                    <p className="text-xs text-gray-500 px-3 py-2">Aucun autre groupe disponible</p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
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
    </div>
  )
}
