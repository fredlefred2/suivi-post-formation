'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Plus, Trash2, ChevronRight } from 'lucide-react'
import { createGroup, deleteGroup } from './actions'

type Group = {
  id: string
  name: string
  created_at: string
  group_members: Array<{ count: number }>
}

export default function GroupsClient({ groups }: { groups: Group[] }) {
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

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
          <p className="text-gray-400">Aucun groupe pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const memberCount = group.group_members[0]?.count ?? 0
            return (
              <div key={group.id} className="card flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{group.name}</p>
                  <p className="text-sm text-gray-400">{memberCount} apprenant{memberCount > 1 ? 's' : ''}</p>
                </div>
                <Link
                  href={`/trainer/groups/${group.id}`}
                  className="btn-secondary px-3 py-2"
                >
                  <ChevronRight size={16} />
                </Link>
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
            )
          })}
        </div>
      )}
    </div>
  )
}
