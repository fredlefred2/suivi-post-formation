'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

// ═══════════════════════════════════════════════════════════════
// Conteneur commun (overlay + fade + bouton fermer)
// ═══════════════════════════════════════════════════════════════

function PromptOverlay({
  children,
  gradient,
  onClose,
}: {
  children: React.ReactNode
  gradient: string
  onClose: () => void
}) {
  // Bloquer le scroll derrière l'overlay
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center prompt-fade-in"
      style={{ background: gradient }}
    >
      <button
        onClick={onClose}
        aria-label="Fermer"
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
        style={{
          background: 'rgba(255,255,255,0.15)',
          color: 'white',
          top: 'max(16px, env(safe-area-inset-top))',
        }}
      >
        <X size={18} />
      </button>
      {children}
    </div>
  )
}

// Pluie de confettis décorative
function ConfettiRain({ count = 30 }: { count?: number }) {
  const colors = ['#fbbf24', '#f59e0b', '#ec4899', '#8b5cf6', '#10b981', '#3b82f6', '#ef4444', '#06b6d4']
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      left: Math.random() * 100,
      color: colors[i % colors.length],
      delay: Math.random() * 0.8,
      dur: 1.5 + Math.random() * 1.5,
      fall: 200 + Math.random() * 300,
      rot: 180 + Math.random() * 540,
      size: 5 + Math.random() * 6,
    }))
  )
  return (
    <>
      {pieces.map((p, i) => (
        <div
          key={i}
          className="prompt-confetti"
          style={{
            left: `${p.left}%`,
            top: '20%',
            background: p.color,
            width: p.size,
            height: p.size,
            '--delay': `${p.delay}s`,
            '--dur': `${p.dur}s`,
            '--fall': `${p.fall}px`,
            '--rot': `${p.rot}deg`,
          } as React.CSSProperties}
        />
      ))}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// 1) Check-in prompt
// ═══════════════════════════════════════════════════════════════

type CheckinPromptProps = {
  open: boolean
  weekLabel: string
  streak: number
  onDoIt: () => void
  onSkip: () => void
}

export function CheckinPrompt({ open, weekLabel, streak, onDoIt, onSkip }: CheckinPromptProps) {
  if (!open) return null

  return (
    <PromptOverlay
      gradient="linear-gradient(180deg, #0f766e 0%, #134e4a 100%)"
      onClose={onSkip}
    >
      <div className="text-center px-6 max-w-sm">
        {streak >= 1 ? (
          <>
            <div className="text-[64px] leading-none mb-2">🔥</div>
            <p className="text-white/70 text-sm font-semibold mb-1">
              Tu es sur <span className="text-amber-400 text-lg font-extrabold">{streak}</span> semaine{streak > 1 ? 's' : ''} d&apos;affilée
            </p>
          </>
        ) : (
          <div className="text-[64px] leading-none mb-3">📋</div>
        )}
        <h2 className="text-white text-2xl font-extrabold mb-2">
          C&apos;est le moment !
        </h2>
        <p className="text-white/60 text-sm mb-8">
          Check-in de {weekLabel} — ça prend 2 minutes
        </p>

        <button
          onClick={onDoIt}
          className="w-full py-4 rounded-2xl font-extrabold text-base active:scale-95 transition-transform mb-3"
          style={{ background: '#fbbf24', color: '#0f766e' }}
        >
          Faire mon check-in 📋
        </button>
        <button
          onClick={onSkip}
          className="w-full py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
        >
          Plus tard
        </button>
      </div>
    </PromptOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════
// 2) Coach gift prompt (cadeau qui s'ouvre → tip révélé)
// ═══════════════════════════════════════════════════════════════

type CoachGiftPromptProps = {
  open: boolean
  tip: {
    id: string
    content: string
    advice: string | null
    axe_subject?: string
  } | null
  onRead: () => void
  onSkip: () => void
}

export function CoachGiftPrompt({ open, tip, onRead, onSkip }: CoachGiftPromptProps) {
  const [opened, setOpened] = useState(false)
  const [showTip, setShowTip] = useState(false)

  useEffect(() => {
    if (!open) {
      setOpened(false)
      setShowTip(false)
    }
  }, [open])

  function handleOpenGift() {
    setOpened(true)
    setTimeout(() => setShowTip(true), 500)
  }

  if (!open || !tip) return null

  return (
    <PromptOverlay
      gradient="linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)"
      onClose={onSkip}
    >
      {!showTip ? (
        <>
          {/* Cadeau à ouvrir */}
          <div
            onClick={handleOpenGift}
            className={`relative mb-6 cursor-pointer ${!opened ? 'gift-bounce' : ''}`}
            style={{ width: 200, height: 200 }}
          >
            {/* Boîte body */}
            <div
              className="absolute bottom-0 left-5 rounded-2xl"
              style={{
                width: 160,
                height: 120,
                background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
                boxShadow: '0 8px 32px rgba(251,191,36,0.3)',
              }}
            />
            {/* Ruban vertical */}
            <div
              className="absolute bottom-0"
              style={{
                width: 20, height: 120,
                left: 90,
                background: '#ef4444',
              }}
            />
            {/* Ruban horizontal */}
            <div
              className="absolute"
              style={{
                width: 160, height: 20,
                bottom: 50, left: 20,
                background: '#ef4444',
              }}
            />
            {/* Couvercle */}
            <div
              className={opened ? 'gift-lid-opened' : ''}
              style={{
                position: 'absolute',
                bottom: 110,
                left: 10,
                width: 180,
                height: 40,
                background: 'linear-gradient(135deg, #d97706, #f59e0b)',
                borderRadius: '12px 12px 4px 4px',
              }}
            />
            {/* Nœud */}
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 z-10"
              style={{ fontSize: 40 }}
            >
              🎀
            </div>
          </div>

          <p className="text-amber-400 text-lg font-extrabold mb-1 text-center">
            Ton coach a un message !
          </p>
          <p className="text-white/50 text-sm text-center px-8">
            Touche le cadeau pour découvrir
          </p>
        </>
      ) : (
        <>
          {/* Confettis */}
          <ConfettiRain count={30} />

          {/* Tip révélé */}
          <div className="px-6 max-w-sm w-full prompt-fade-in relative">
            {tip.axe_subject && (
              <div className="text-center mb-3">
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                  ✨ {tip.axe_subject}
                </span>
              </div>
            )}

            <p className="text-white text-lg font-bold leading-snug mb-4 text-center">
              {tip.content}
            </p>

            {tip.advice && (
              <div
                className="text-white/70 text-sm leading-relaxed p-4 rounded-2xl mb-6"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderLeft: '3px solid #fbbf24',
                }}
              >
                {tip.advice}
              </div>
            )}

            <button
              onClick={onRead}
              className="w-full py-4 rounded-2xl font-extrabold text-base active:scale-95 transition-transform"
              style={{ background: '#fbbf24', color: '#1a1a2e' }}
            >
              Compris 👍
            </button>
          </div>
        </>
      )}
    </PromptOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════
// 3) Action prompt (relance 10j sans action)
// ═══════════════════════════════════════════════════════════════

type ActionPromptProps = {
  open: boolean
  daysSince: number
  firstName: string
  onDoIt: () => void
  onSkip: () => void
}

export function ActionPrompt({ open, daysSince, firstName, onDoIt, onSkip }: ActionPromptProps) {
  if (!open) return null

  return (
    <PromptOverlay
      gradient="linear-gradient(180deg, #7c2d12 0%, #431407 100%)"
      onClose={onSkip}
    >
      <div className="text-center px-6 max-w-sm">
        <div className="text-[64px] leading-none mb-4">👀</div>

        <h2 className="text-white text-2xl font-extrabold mb-3">
          Coucou {firstName} !
        </h2>

        <p className="text-white/70 text-base leading-relaxed mb-2">
          Ça fait <span className="text-amber-400 font-extrabold">{daysSince} jours</span> qu&apos;on ne s&apos;est pas vus...
        </p>
        <p className="text-white/50 text-sm mb-8">
          T&apos;as tenté un truc qu&apos;on pourrait noter ?
        </p>

        <button
          onClick={onDoIt}
          className="w-full py-4 rounded-2xl font-extrabold text-base active:scale-95 transition-transform mb-3"
          style={{ background: '#fbbf24', color: '#7c2d12' }}
        >
          C&apos;est parti ! ⚡
        </button>
        <button
          onClick={onSkip}
          className="w-full py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
        >
          Plus tard
        </button>
      </div>
    </PromptOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════
// 4) Quiz prompt (placeholder pour phase 2)
// ═══════════════════════════════════════════════════════════════

type QuizPromptProps = {
  open: boolean
  onDoIt: () => void
  onSkip: () => void
}

export function QuizPrompt({ open, onDoIt, onSkip }: QuizPromptProps) {
  if (!open) return null

  return (
    <PromptOverlay
      gradient="linear-gradient(180deg, #4c1d95 0%, #2e1065 100%)"
      onClose={onSkip}
    >
      <div className="text-center px-6 max-w-sm">
        <div
          className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center"
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '3px solid rgba(255,255,255,0.2)',
            fontSize: 44,
          }}
        >
          🧠
        </div>

        <h2 className="text-white text-2xl font-extrabold mb-2">
          Quiz de la semaine
        </h2>
        <p className="text-white/60 text-sm mb-8">
          3 questions, 1 minute, 1 badge à gagner
        </p>

        <button
          onClick={onDoIt}
          className="w-full py-4 rounded-2xl font-extrabold text-base active:scale-95 transition-transform mb-3"
          style={{ background: '#fbbf24', color: '#4c1d95' }}
        >
          Jouer 🎯
        </button>
        <button
          onClick={onSkip}
          className="w-full py-3 rounded-2xl font-semibold text-sm active:scale-95 transition-transform"
          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
        >
          Plus tard
        </button>
      </div>
    </PromptOverlay>
  )
}
