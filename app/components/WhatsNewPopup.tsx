'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles } from 'lucide-react'

const CURRENT_VERSION = '25.8.3'
const STORAGE_KEY = 'whats_new_seen'

type Update = {
  icon: string
  title: string
  description: string
}

const updates: Update[] = [
  {
    icon: '💬',
    title: 'Échange avec ton formateur',
    description: 'Tu peux maintenant lui envoyer un message privé directement depuis l\'appli. Clique sur l\'icône message en haut à droite.',
  },
  {
    icon: '📢',
    title: 'Messages de ton formateur',
    description: 'Ton formateur peut t\'envoyer un message à toi et à tout le groupe. Il apparaîtra automatiquement quand tu ouvres l\'appli.',
  },
  {
    icon: '🔥',
    title: 'Ta série de check-ins',
    description: 'Plus tu fais tes check-ins chaque semaine sans en rater, plus ta série grandit ! Tu verras aussi ta place dans le classement de ton groupe.',
  },
  {
    icon: '🚀',
    title: 'Monte en puissance',
    description: 'Chaque action que tu ajoutes te fait progresser : Veille → Impulsion → Rythme → Intensité → Propulsion. À toi de jouer !',
  },
  {
    icon: '❤️',
    title: 'Encouragements',
    description: 'Ton formateur peut liker tes actions et te laisser des commentaires pour t\'encourager.',
  },
  {
    icon: '📅',
    title: 'Check-in du vendredi au lundi',
    description: 'Chaque vendredi, fais le point sur ta semaine. Tu as jusqu\'au lundi pour le compléter.',
  },
]

export default function WhatsNewPopup() {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen !== CURRENT_VERSION) {
      // Petit délai pour laisser la page charger
      setTimeout(() => {
        setVisible(true)
        requestAnimationFrame(() => setAnimating(true))
      }, 800)
    }
  }, [])

  function handleDismiss() {
    setAnimating(false)
    setTimeout(() => {
      setVisible(false)
      localStorage.setItem(STORAGE_KEY, CURRENT_VERSION)
    }, 300)
  }

  if (!visible) return null

  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center bg-black/50 px-4 transition-opacity duration-300 ${animating ? 'opacity-100' : 'opacity-0'}`}>
      <div className={`bg-white rounded-2xl shadow-2xl max-w-sm w-full max-h-[85vh] flex flex-col overflow-hidden transition-all duration-300 ${animating ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}`}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center shrink-0" style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
        }}>
          <div className="flex justify-end -mt-2 -mr-2">
            <button
              onClick={handleDismiss}
              className="p-1.5 rounded-full text-white/60 hover:text-white hover:bg-white/20 transition-colors"
              aria-label="Fermer"
            >
              <X size={18} />
            </button>
          </div>
          <div className="flex items-center justify-center gap-2 -mt-2">
            <Sparkles size={22} className="text-amber-300" />
            <h2 className="text-lg font-bold text-white">Quoi de neuf ?</h2>
            <Sparkles size={22} className="text-amber-300" />
          </div>
          <p className="text-xs text-indigo-200 mt-1">Ton appli a évolué !</p>
        </div>

        {/* Updates list — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {updates.map((update, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <span className="text-xl shrink-0 mt-0.5">{update.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900">{update.title}</p>
                <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{update.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={handleDismiss}
            className="btn-primary w-full py-2.5 text-sm font-semibold"
          >
            C&apos;est parti ! 🎉
          </button>
        </div>
      </div>
    </div>
  )
}
