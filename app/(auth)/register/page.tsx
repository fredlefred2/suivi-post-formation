'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { register, getTrainers } from '../actions'

type Trainer = { id: string; first_name: string; last_name: string }

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [role, setRole] = useState('learner')
  const [trainers, setTrainers] = useState<Trainer[]>([])

  useEffect(() => {
    if (role === 'learner') {
      getTrainers().then((r) => setTrainers(r.trainers))
    }
  }, [role])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)

    const password = formData.get('password') as string
    const confirm = formData.get('confirm_password') as string
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.')
      setLoading(false)
      return
    }

    // Validation clé formateur côté client
    if (role === 'trainer') {
      const key = (formData.get('trainer_key') as string ?? '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      if (key !== 'theatre') {
        setError('Clé formateur incorrecte.')
        setLoading(false)
        return
      }
    }

    const result = await register(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 relative overflow-hidden" style={{ background: '#faf8f4' }}>
      {/* Decorative circles */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full" style={{ background: 'rgba(251,191,36,0.1)' }} />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full" style={{ background: 'rgba(26,26,46,0.05)' }} />

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <img src="/yapluka-symbol.png" alt="YAPLUKA" className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
          <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: '#1a1a2e' }}>Créer un compte</h1>
          <p className="text-sm mt-1.5" style={{ color: '#a0937c' }}>Rejoignez YAPLUKA et passez à l&apos;action</p>
        </div>

        <div className="bg-white rounded-[28px] p-6" style={{ border: '2px solid #f0ebe0', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className="label">Prénom</label>
                <input id="first_name" name="first_name" type="text" required className="input" placeholder="Marie" />
              </div>
              <div>
                <label htmlFor="last_name" className="label">Nom</label>
                <input id="last_name" name="last_name" type="text" required className="input" placeholder="Dupont" />
              </div>
            </div>
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email"
                className="input" placeholder="prenom.nom@email.fr" />
            </div>
            <div>
              <label htmlFor="role" className="label">Je suis</label>
              <select id="role" name="role" required value={role} onChange={(e) => setRole(e.target.value)}
                className="input" style={{ appearance: 'auto' }}>
                <option value="learner">Participant</option>
                <option value="trainer">Formateur</option>
              </select>
            </div>

            {/* Clé formateur */}
            {role === 'trainer' && (
              <div>
                <label htmlFor="trainer_key" className="label">Clé formateur *</label>
                <input id="trainer_key" name="trainer_key" type="text" required
                  className="input" placeholder="Entrez la clé d'accès formateur" />
              </div>
            )}

            {/* Choix du formateur (apprenants) */}
            {role === 'learner' && trainers.length > 0 && (
              <div>
                <label htmlFor="trainer_id" className="label">Votre formateur</label>
                <select id="trainer_id" name="trainer_id" className="input" style={{ appearance: 'auto' }}>
                  <option value="">— Choisissez votre formateur —</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.first_name} {t.last_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="password" className="label">Mot de passe</label>
              <input id="password" name="password" type="password" required minLength={8}
                autoComplete="new-password" className="input" placeholder="8 caractères minimum" />
            </div>
            <div>
              <label htmlFor="confirm_password" className="label">Confirmer le mot de passe</label>
              <input id="confirm_password" name="confirm_password" type="password" required
                autoComplete="new-password" className="input" placeholder="••••••••" />
            </div>
            {error && (
              <p className="text-sm text-red-800 bg-red-50 rounded-xl px-3 py-2" style={{ border: '2px solid #fca5a5' }}>
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}
              className="btn-primary w-full py-3 text-[15px]">
              {loading ? 'Inscription...' : 'Créer mon compte'}
            </button>
          </form>
          <p className="text-center text-sm mt-5" style={{ color: '#a0937c' }}>
            Déjà un compte ?{' '}
            <Link href="/login" className="font-bold transition-colors hover:underline" style={{ color: '#1a1a2e' }}>
              Se connecter
            </Link>
          </p>
          <p className="text-center text-[11px] mt-4" style={{ color: '#c4b99a' }}>V1.31</p>
        </div>
      </div>
    </div>
  )
}
