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
          {/* Ampoule — éteinte puis allumée au clic */}
          <div
            onClick={handleOpenGift}
            className="relative mb-8 cursor-pointer flex items-center justify-center"
            style={{ width: 220, height: 220 }}
          >
            {/* Halo doré (visible quand allumée) */}
            {opened && (
              <>
                <div
                  className="absolute rounded-full bulb-halo"
                  style={{
                    width: 220, height: 220,
                    background: 'radial-gradient(circle, rgba(251,191,36,0.6) 0%, rgba(251,191,36,0) 70%)',
                  }}
                />
                {/* Second halo décalé pour effet pulse continu */}
                <div
                  className="absolute rounded-full bulb-halo"
                  style={{
                    width: 220, height: 220,
                    background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(251,191,36,0) 70%)',
                    animationDelay: '0.75s',
                  }}
                />
                {/* Flash d'allumage */}
                <div
                  className="absolute rounded-full bulb-flash"
                  style={{
                    width: 100, height: 100,
                    background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(251,191,36,0) 70%)',
                  }}
                />
                {/* Rayons rotatifs */}
                <div
                  className="absolute rounded-full bulb-rays"
                  style={{
                    width: 280, height: 280,
                    background: `conic-gradient(
                      from 0deg,
                      transparent 0deg, rgba(251,191,36,0.25) 10deg, transparent 20deg,
                      transparent 45deg, rgba(251,191,36,0.2) 55deg, transparent 65deg,
                      transparent 90deg, rgba(251,191,36,0.25) 100deg, transparent 110deg,
                      transparent 135deg, rgba(251,191,36,0.2) 145deg, transparent 155deg,
                      transparent 180deg, rgba(251,191,36,0.25) 190deg, transparent 200deg,
                      transparent 225deg, rgba(251,191,36,0.2) 235deg, transparent 245deg,
                      transparent 270deg, rgba(251,191,36,0.25) 280deg, transparent 290deg,
                      transparent 315deg, rgba(251,191,36,0.2) 325deg, transparent 335deg,
                      transparent 360deg
                    )`,
                  }}
                />
              </>
            )}

            {/* L'ampoule SVG */}
            <svg
              viewBox="0 0 100 120"
              className={`relative z-10 ${opened ? 'bulb-filament' : 'bulb-idle'}`}
              style={{ width: 120, height: 144 }}
            >
              {/* Base / culot de l'ampoule */}
              <rect x="38" y="88" width="24" height="8" rx="2"
                fill={opened ? '#78716c' : '#52525b'}/>
              <rect x="35" y="96" width="30" height="6" rx="1"
                fill={opened ? '#a8a29e' : '#71717a'}/>
              <rect x="38" y="102" width="24" height="5" rx="1"
                fill={opened ? '#78716c' : '#52525b'}/>
              <path d="M 42 107 L 58 107 L 54 116 L 46 116 Z"
                fill={opened ? '#a8a29e' : '#71717a'}/>

              {/* Verre de l'ampoule */}
              <path
                d="M 30 45 Q 30 15 50 15 Q 70 15 70 45 Q 70 65 60 75 Q 58 80 60 88 L 40 88 Q 42 80 40 75 Q 30 65 30 45 Z"
                fill={opened ? 'rgba(254, 243, 199, 0.9)' : 'rgba(148, 163, 184, 0.25)'}
                stroke={opened ? '#fbbf24' : '#64748b'}
                strokeWidth="2"
              />

              {/* Glow intérieur si allumée */}
              {opened && (
                <circle
                  cx="50" cy="45" r="20"
                  fill="url(#bulbGlow)"
                />
              )}

              {/* Filament — allumé */}
              {opened ? (
                <g stroke="#fbbf24" strokeWidth="2" fill="none" strokeLinecap="round">
                  <path d="M 44 60 Q 46 45 50 50 Q 54 55 56 40 Q 54 50 50 50 Q 46 50 44 60 Z" fill="#fef3c7" />
                  <line x1="42" y1="72" x2="44" y2="65" />
                  <line x1="58" y1="72" x2="56" y2="65" />
                </g>
              ) : (
                <g stroke="#94a3b8" strokeWidth="1.5" fill="none" strokeLinecap="round">
                  <path d="M 44 60 Q 46 45 50 50 Q 54 55 56 40" />
                  <line x1="42" y1="72" x2="44" y2="65" />
                  <line x1="58" y1="72" x2="56" y2="65" />
                </g>
              )}

              <defs>
                <radialGradient id="bulbGlow">
                  <stop offset="0%" stopColor="rgba(254, 240, 138, 0.8)" />
                  <stop offset="100%" stopColor="rgba(251, 191, 36, 0)" />
                </radialGradient>
              </defs>
            </svg>
          </div>

          <p
            className="text-lg font-extrabold mb-1 text-center transition-colors"
            style={{ color: opened ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}
          >
            {opened ? 'Lumière !' : 'Ton coach a une idée'}
          </p>
          <p className="text-white/50 text-sm text-center px-8">
            {opened ? 'Ton conseil arrive...' : 'Touche l\'ampoule pour l\'allumer'}
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
