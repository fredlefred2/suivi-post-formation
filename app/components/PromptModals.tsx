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
  hideClose = false,
}: {
  children: React.ReactNode
  gradient: string
  onClose: () => void
  hideClose?: boolean
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
      {!hideClose && (
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
      )}
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
    example?: string | null
    axe_subject?: string
  } | null
  onRead: () => void
  onSkip: () => void
}

// Décorations warm : 6 étoiles amber qui scintillent en fond de fenêtre coach
function CoachStars() {
  const stars = [
    { top: '12%', left: '8%', size: 10, delay: '0s' },
    { top: '22%', right: '12%', size: 8, delay: '0.8s' },
    { top: '55%', left: '6%', size: 9, delay: '1.6s' },
    { top: '68%', right: '8%', size: 11, delay: '2.4s' },
    { top: '85%', left: '14%', size: 7, delay: '3.2s' },
    { top: '40%', right: '20%', size: 8, delay: '2s' },
  ]
  return (
    <>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute star-twinkle pointer-events-none"
          style={{
            ...s,
            fontSize: s.size,
            color: '#fbbf24',
            opacity: 0.5,
            animationDelay: s.delay,
          }}
          aria-hidden
        >
          ✦
        </span>
      ))}
    </>
  )
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
      gradient="radial-gradient(ellipse at 20% 20%, rgba(251,191,36,0.12) 0%, transparent 40%), radial-gradient(ellipse at 80% 80%, rgba(236,72,153,0.08) 0%, transparent 45%), linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)"
      onClose={onSkip}
      hideClose
    >
      <CoachStars />
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

            {/* L'ampoule — emoji 💡, désaturée + translucide quand éteinte */}
            <div
              className={`relative z-10 leading-none select-none ${opened ? 'bulb-filament' : 'bulb-idle'}`}
              style={{
                fontSize: 140,
                filter: opened
                  ? 'drop-shadow(0 0 18px rgba(251,191,36,0.85)) drop-shadow(0 0 40px rgba(251,191,36,0.5)) saturate(1.2)'
                  : 'grayscale(0.7) brightness(0.75) contrast(0.9)',
                opacity: opened ? 1 : 0.55,
                transition: 'filter 0.4s ease-out, opacity 0.4s ease-out',
              }}
              aria-hidden
            >
              💡
            </div>
          </div>

          <p
            className="text-lg font-extrabold mb-1 text-center transition-colors"
            style={{ color: opened ? '#fbbf24' : 'rgba(255,255,255,0.5)' }}
          >
            {opened ? 'Lumière !' : 'Ton coach, un conseil !'}
          </p>
          <p className="text-white/50 text-sm text-center px-8">
            {opened ? 'Ton conseil arrive...' : 'Touche l\'ampoule pour l\'allumer'}
          </p>
        </>
      ) : (
        <>
          {/* Confettis */}
          <ConfettiRain count={30} />

          {/* Tip révélé — mantra / action / exemple (style warm) */}
          <div className="px-5 max-w-sm w-full prompt-fade-in relative">
            {/* Chip axe */}
            {tip.axe_subject && (
              <div className="text-center mb-4">
                <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold"
                  style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
                  ✨ {tip.axe_subject}
                </span>
              </div>
            )}

            {/* ── BLOC MANTRA ──────────────────────────────── */}
            <div className="relative text-center mb-5 px-2">
              {/* Grands guillemets décoratifs en ambre translucide */}
              <span
                aria-hidden
                className="absolute font-serif font-black pointer-events-none"
                style={{
                  top: -8, left: -4,
                  fontSize: 110, lineHeight: 0.8,
                  color: 'rgba(251,191,36,0.14)',
                  zIndex: 0,
                }}
              >&ldquo;</span>
              <span
                aria-hidden
                className="absolute font-serif font-black pointer-events-none"
                style={{
                  bottom: -40, right: -4,
                  fontSize: 110, lineHeight: 0.8,
                  color: 'rgba(251,191,36,0.14)',
                  zIndex: 0,
                }}
              >&rdquo;</span>

              <p
                className="font-extrabold uppercase tracking-[2px] mb-2.5"
                style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}
              >
                Mantra
              </p>

              {/* Emoji 💡 universel avec halo amber pulsant */}
              <div className="relative inline-block mb-2" style={{ zIndex: 2 }}>
                <div
                  className="absolute mantra-halo-pulse pointer-events-none"
                  style={{
                    inset: -16,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 70%)',
                  }}
                />
                <span className="relative text-[32px] leading-none" aria-hidden>💡</span>
              </div>

              <p
                className="text-white font-bold italic leading-snug relative"
                style={{ fontSize: 20, zIndex: 2 }}
              >
                <span style={{ color: '#fbbf24' }}>«&nbsp;</span>
                {tip.content}
                <span style={{ color: '#fbbf24' }}>&nbsp;»</span>
              </p>
            </div>

            {/* ── BLOC ACTION (amber accent) ────────────────── */}
            {tip.advice && (
              <div
                className="px-4 py-3 mb-3 relative"
                style={{
                  background: 'rgba(251,191,36,0.15)',
                  borderLeft: '3px solid #fbbf24',
                  borderRadius: '0 14px 14px 0',
                  boxShadow: '0 0 24px rgba(251,191,36,0.08)',
                  zIndex: 2,
                }}
              >
                <p
                  className="font-extrabold uppercase mb-1 flex items-center gap-1"
                  style={{ color: '#fbbf24', fontSize: 10, letterSpacing: '1.5px' }}
                >
                  ⚡ Action
                </p>
                <p className="text-white text-[14px] leading-relaxed">{tip.advice}</p>
              </div>
            )}

            {/* ── BLOC EXEMPLE (plus discret) ────────────────── */}
            {tip.example && (
              <div
                className="px-4 py-3 mb-5 relative"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 16,
                  zIndex: 2,
                }}
              >
                <p
                  className="font-extrabold uppercase mb-1 flex items-center gap-1"
                  style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, letterSpacing: '1.5px' }}
                >
                  🎬 Exemple
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  {tip.example}
                </p>
              </div>
            )}

            <button
              onClick={onRead}
              className="w-full py-4 rounded-2xl font-extrabold text-base active:scale-95 transition-transform relative"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#1a1a2e',
                boxShadow: '0 8px 24px rgba(251,191,36,0.35)',
                zIndex: 2,
              }}
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
