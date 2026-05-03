'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login, sendLoginMagicLink } from '../actions'

type Mode = 'password' | 'magiclink'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('password')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [magicEmail, setMagicEmail] = useState('')

  async function handlePasswordSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    const formData = new FormData(e.currentTarget)
    const result = await login(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  async function handleMagicLinkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    const result = await sendLoginMagicLink(magicEmail)
    setLoading(false)
    if (result?.error) setError(result.error)
    else setSuccess('Si un compte existe avec cet email, un lien de connexion vient d\'être envoyé. Vérifie ta boîte mail (et tes spams).')
  }

  function switchMode(next: Mode) {
    setMode(next); setError(null); setSuccess(null)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: '#faf8f4' }}>
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full" style={{ background: 'rgba(251,191,36,0.1)' }} />
      <div className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full" style={{ background: 'rgba(26,26,46,0.05)' }} />

      <div className="w-full max-w-sm relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <img src="/yapluka-symbol.png" alt="YAPLUKA" className="w-16 h-16 mx-auto mb-3 drop-shadow-lg" />
          <h1 className="font-display text-3xl font-bold tracking-tight" style={{ color: '#1a1a2e' }}>
            YAPL<span style={{ color: '#fbbf24' }}>UKA</span>
          </h1>
          <p className="text-sm mt-1.5" style={{ color: '#a0937c' }}>Transformez vos formations en actions concrètes</p>
        </div>

        <div className="bg-white rounded-[28px] p-6" style={{ border: '2px solid #f0ebe0', boxShadow: '0 4px 30px rgba(0,0,0,0.06)' }}>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-bold mb-1.5" style={{ color: '#1a1a2e' }}>Email</label>
                <input id="email" name="email" type="email" required autoComplete="email"
                  className="input" placeholder="prenom.nom@email.fr" />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-bold mb-1.5" style={{ color: '#1a1a2e' }}>Mot de passe</label>
                <input id="password" name="password" type="password" required autoComplete="current-password"
                  className="input" placeholder="••••••••" />
              </div>
              {error && (
                <p className="text-sm text-red-800 bg-red-50 rounded-xl px-3 py-2" style={{ border: '2px solid #fca5a5' }}>{error}</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px]">
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>

              <button type="button" onClick={() => switchMode('magiclink')}
                className="w-full text-center text-sm font-semibold py-2 transition-colors"
                style={{ color: '#1a1a2e' }}>
                🔑 Pas de mot de passe ? Recevoir un lien par email
              </button>
            </form>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm font-bold" style={{ color: '#1a1a2e' }}>Connexion par lien email</p>
                <p className="text-xs mt-1" style={{ color: '#a0937c' }}>Saisis ton email, tu recevras un lien de connexion. Pas besoin de mot de passe.</p>
              </div>
              <div>
                <label htmlFor="magic_email" className="block text-sm font-bold mb-1.5" style={{ color: '#1a1a2e' }}>Email</label>
                <input id="magic_email" type="email" required autoComplete="email"
                  value={magicEmail} onChange={e => setMagicEmail(e.target.value)}
                  className="input" placeholder="prenom.nom@email.fr" />
              </div>
              {error && (
                <p className="text-sm text-red-800 bg-red-50 rounded-xl px-3 py-2" style={{ border: '2px solid #fca5a5' }}>{error}</p>
              )}
              {success && (
                <p className="text-sm text-emerald-800 bg-emerald-50 rounded-xl px-3 py-2" style={{ border: '2px solid #86efac' }}>{success}</p>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-[15px]">
                {loading ? 'Envoi...' : 'Recevoir mon lien'}
              </button>

              <button type="button" onClick={() => switchMode('password')}
                className="w-full text-center text-sm font-semibold py-2 transition-colors"
                style={{ color: '#1a1a2e' }}>
                ← Retour à la connexion par mot de passe
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <p className="text-sm mb-3" style={{ color: '#a0937c' }}>Pas encore de compte ?</p>
            <Link href="/register"
              className="btn-secondary w-full inline-block text-center py-2.5">
              S&apos;inscrire
            </Link>
          </div>
          <p className="text-center text-[11px] mt-4" style={{ color: '#c4b99a' }}>V1.30.5</p>
        </div>
      </div>
    </div>
  )
}
