'use client'

import { useState } from 'react'
import Link from 'next/link'
import { register } from '../actions'

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

    const result = await register(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎯</div>
          <h1 className="text-2xl font-bold text-gray-900">Créer un compte</h1>
          <p className="text-sm text-gray-500 mt-1">Rejoignez le suivi post-formation</p>
        </div>

        <div className="card">
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
              <select id="role" name="role" required className="input bg-white">
                <option value="learner">Apprenant</option>
                <option value="trainer">Formateur</option>
              </select>
            </div>
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
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Inscription...' : 'Créer mon compte'}
            </button>
          </form>
          <p className="text-center text-sm text-gray-500 mt-4">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-indigo-600 hover:underline font-medium">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
