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

  const inputClass =
    'w-full border border-white/20 rounded-xl px-4 py-2.5 text-sm bg-white/10 backdrop-blur-sm text-white placeholder:text-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 transition-all duration-200'
  const labelClass = 'block text-sm font-medium text-indigo-100 mb-1.5'

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-1/3 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/3 -right-32 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 drop-shadow-lg">🎯</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Créer un compte</h1>
          <p className="text-sm text-indigo-200/70 mt-1.5">Rejoignez le suivi post-formation</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-glass-lg border border-white/20 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="first_name" className={labelClass}>Prénom</label>
                <input id="first_name" name="first_name" type="text" required className={inputClass} placeholder="Marie" />
              </div>
              <div>
                <label htmlFor="last_name" className={labelClass}>Nom</label>
                <input id="last_name" name="last_name" type="text" required className={inputClass} placeholder="Dupont" />
              </div>
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input id="email" name="email" type="email" required autoComplete="email"
                className={inputClass} placeholder="prenom.nom@email.fr" />
            </div>
            <div>
              <label htmlFor="role" className={labelClass}>Je suis</label>
              <select id="role" name="role" required
                className="w-full border border-white/20 rounded-xl px-4 py-2.5 text-sm bg-white/10 backdrop-blur-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 transition-all duration-200 [&>option]:text-gray-900">
                <option value="learner">Apprenant</option>
                <option value="trainer">Formateur</option>
              </select>
            </div>
            <div>
              <label htmlFor="password" className={labelClass}>Mot de passe</label>
              <input id="password" name="password" type="password" required minLength={8}
                autoComplete="new-password" className={inputClass} placeholder="8 caractères minimum" />
            </div>
            <div>
              <label htmlFor="confirm_password" className={labelClass}>Confirmer le mot de passe</label>
              <input id="confirm_password" name="confirm_password" type="password" required
                autoComplete="new-password" className={inputClass} placeholder="••••••••" />
            </div>
            {error && (
              <p className="text-sm text-red-300 bg-red-500/20 backdrop-blur-sm rounded-xl px-3 py-2 border border-red-400/30">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Inscription...' : 'Créer mon compte'}
            </button>
          </form>
          <p className="text-center text-sm text-indigo-200/60 mt-5">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-indigo-300 hover:text-white font-medium transition-colors hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
