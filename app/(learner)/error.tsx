'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'

export default function LearnerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Learner error:', error)
  }, [error])

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
      <div className="text-center max-w-sm">
        <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertCircle className="text-red-500" size={32} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          Oups, une erreur !
        </h2>
        <p className="text-gray-600 text-sm mb-6">
          Quelque chose ne s&apos;est pas pass&eacute; comme pr&eacute;vu. Essaye de recharger la page.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors active:scale-95"
            style={{ background: '#fbbf24', color: '#1a1a2e', padding: '0.625rem 1.25rem' }}
          >
            <RefreshCw size={16} />
            R&eacute;essayer
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            <Home size={16} />
            Retour &agrave; l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  )
}
