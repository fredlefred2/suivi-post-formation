'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '../actions'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 relative overflow-hidden">
      {/* Decorative orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-4 drop-shadow-lg">🚀</div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Progress +</h1>
          <p className="text-sm text-indigo-200/70 mt-1.5">Transformez vos formations en actions concrètes</p>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-glass-lg border border-white/20 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-indigo-100 mb-1.5">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email"
                className="w-full border border-white/20 rounded-xl px-4 py-2.5 text-sm bg-white/10 backdrop-blur-sm text-white placeholder:text-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 transition-all duration-200"
                placeholder="prenom.nom@email.fr" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-indigo-100 mb-1.5">Mot de passe</label>
              <input id="password" name="password" type="password" required autoComplete="current-password"
                className="w-full border border-white/20 rounded-xl px-4 py-2.5 text-sm bg-white/10 backdrop-blur-sm text-white placeholder:text-indigo-300/50 focus:outline-none focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400/50 transition-all duration-200"
                placeholder="••••••••" />
            </div>
            {error && (
              <p className="text-sm text-red-300 bg-red-500/20 backdrop-blur-sm rounded-xl px-3 py-2 border border-red-400/30">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
          <p className="text-center text-sm text-indigo-200/60 mt-5">
            Pas encore de compte ?{' '}
            <Link href="/register" className="text-indigo-300 hover:text-white font-medium transition-colors hover:underline">
              S&apos;inscrire
            </Link>
          </p>
          <p className="text-center text-[11px] text-indigo-300/30 mt-4">V19</p>
        </div>
      </div>
    </div>
  )
}
