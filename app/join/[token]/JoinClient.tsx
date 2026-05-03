'use client'

import { useState } from 'react'
import { joinGroupViaToken } from '@/app/(trainer)/trainer/groups/invite-actions'

export default function JoinClient({ token, groupName }: { token: string; groupName: string }) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const result = await joinGroupViaToken(token, email, firstName, lastName)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }
    if (result.magicLinkUrl) {
      // Redirige vers Supabase qui set la session puis nous renvoie sur /auth/confirm → /dashboard
      window.location.href = result.magicLinkUrl
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden" style={{ background: '#faf8f4' }}>
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full" style={{ background: 'rgba(251,191,36,0.1)' }} />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full" style={{ background: 'rgba(26,26,46,0.05)' }} />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-6">
          <img src="/yapluka-symbol.png" alt="YAPLUKA" className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
          <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: '#1a1a2e' }}>
            Bienvenue !
          </h1>
          <p className="text-sm mt-2" style={{ color: '#a0937c' }}>
            Tu rejoins la formation
          </p>
          <p className="text-base font-bold mt-1" style={{ color: '#1a1a2e' }}>
            {groupName}
          </p>
        </div>

        <div className="bg-white rounded-[28px] p-6" style={{ border: '2px solid #f0ebe0', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="prenom.nom@email.fr"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className="label">Prénom</label>
                <input
                  id="first_name" type="text" required
                  value={firstName} onChange={e => setFirstName(e.target.value)}
                  className="input" placeholder="Marie"
                />
              </div>
              <div>
                <label htmlFor="last_name" className="label">Nom</label>
                <input
                  id="last_name" type="text"
                  value={lastName} onChange={e => setLastName(e.target.value)}
                  className="input" placeholder="Dupont"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-800 bg-red-50 rounded-xl px-3 py-2" style={{ border: '2px solid #fca5a5' }}>
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px]">
              {loading ? 'Connexion...' : 'C\'est parti'}
            </button>
          </form>

          <p className="text-center text-[12px] mt-5" style={{ color: '#a0937c' }}>
            Pas de mot de passe à créer.<br/>
            Tu seras connecté(e) automatiquement.
          </p>
        </div>
      </div>
    </div>
  )
}
