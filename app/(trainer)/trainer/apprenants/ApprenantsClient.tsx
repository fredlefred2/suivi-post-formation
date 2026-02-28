'use client'

import { useState, useTransition } from 'react'
import { UserCheck, UserMinus } from 'lucide-react'
import { assignToGroup, removeFromGroup } from './actions'

type Learner = {
  id: string
  first_name: string
  last_name: string
  groupId: string | null
  groupName: string | null
}

type Group = {
  id: string
  name: string
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
      if (result?.error) setMsg({ type: 'error', text: result.error })
      else setMsg({ type: 'ok', text: 'Affecté !' })
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
      <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-sm shrink-0">
        {learner.first_name[0]}{learner.last_name[0]}
      </div>

      {/* Nom */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-900">{learner.first_name} {learner.last_name}</p>
        {msg && (
          <p className={`text-xs mt-0.5 ${msg.type === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
            {msg.text}
          </p>
        )}
      </div>

      {/* Action selon l'état */}
      {learner.groupId ? (
        // Déjà dans un groupe du formateur
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-1 rounded-full">
            {learner.groupName}
          </span>
          <button
            onClick={handleRemove}
            disabled={isPending}
            title="Retirer du groupe"
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
          >
            <UserMinus size={16} />
          </button>
        </div>
      ) : (
        // Sans groupe — afficher le sélecteur
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-full">
            Sans groupe
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
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-40"
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
}: {
  learners: Learner[]
  groups: Group[]
}) {
  const unassigned = learners.filter((l) => !l.groupId)
  const assigned = learners.filter((l) => l.groupId)

  return (
    <div className="space-y-6 pb-4">
      <h1 className="page-title">Apprenants</h1>

      {learners.length === 0 ? (
        <div className="card text-center py-10 text-gray-400 text-sm">
          Aucun apprenant inscrit pour l'instant.
        </div>
      ) : (
        <>
          {/* Sans groupe */}
          {unassigned.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-3">
                En attente d'affectation
                <span className="ml-2 text-xs font-normal bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                  {unassigned.length}
                </span>
              </h2>
              {groups.length === 0 && (
                <p className="text-xs text-gray-400 mb-3">
                  Créez d'abord un groupe pour pouvoir affecter des apprenants.
                </p>
              )}
              <div className="space-y-2">
                {unassigned.map((l) => (
                  <LearnerRow key={l.id} learner={l} groups={groups} />
                ))}
              </div>
            </div>
          )}

          {/* Déjà affectés */}
          {assigned.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-3">
                Dans vos groupes
                <span className="ml-2 text-xs font-normal bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                  {assigned.length}
                </span>
              </h2>
              <div className="space-y-2">
                {assigned.map((l) => (
                  <LearnerRow key={l.id} learner={l} groups={groups} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
