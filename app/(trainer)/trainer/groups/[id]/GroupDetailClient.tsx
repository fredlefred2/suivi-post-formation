'use client'

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { addLearnerToGroup, removeLearnerFromGroup } from '../actions'

export default function GroupDetailClient({ groupId }: { groupId: string }) {
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    startTransition(async () => {
      const result = await addLearnerToGroup(groupId, email.trim())
      if (result?.error) {
        setError(result.error)
      } else {
        setSuccess(`${result.name} ajouté(e) avec succès !`)
        setEmail('')
        // Tips generation en arrière-plan (fire-and-forget)
        if (result.learnerId) {
          fetch('/api/tips/generate-for-member', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ learnerId: result.learnerId, groupId }),
          }).catch(() => {})
        }
      }
    })
  }

  return (
    <div>
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary btn-sm">
          <Plus size={14} /> Ajouter
        </button>
      ) : (
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email du participant"
              className="input text-xs py-1.5 w-64"
              required
              autoFocus
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
            {success && <p className="text-xs text-emerald-600 mt-1">{success}</p>}
          </div>
          <button type="submit" disabled={isPending} className="btn-primary btn-sm">
            {isPending ? '...' : 'Ajouter'}
          </button>
          <button type="button" onClick={() => { setShowForm(false); setError(null); setSuccess(null) }} className="btn-secondary btn-sm">
            <X size={14} />
          </button>
        </form>
      )}
    </div>
  )
}
