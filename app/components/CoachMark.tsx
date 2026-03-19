'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Position = 'top' | 'bottom'

type Props = {
  /** CSS selector for the target element. If omitted, shows a centered informational bubble */
  targetSelector?: string
  title: string
  description: string
  icon?: string
  /** Extra content rendered below description (e.g. illustrations) */
  extra?: React.ReactNode
  ctaLabel?: string
  onCta?: () => void
  /** Extra padding around the spotlight cutout (px) */
  padding?: number
  /** Step indicator (e.g. "3/8") */
  stepLabel?: string
}

export default function CoachMark({
  targetSelector,
  title,
  description,
  icon,
  extra,
  ctaLabel,
  onCta,
  padding = 10,
  stepLabel,
}: Props) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [position, setPosition] = useState<Position>('bottom')
  const [visible, setVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const targetElRef = useRef<HTMLElement | null>(null)

  // Find the target element with retry logic
  const findTarget = useCallback(() => {
    if (!targetSelector) {
      // No target → centered informational bubble
      setVisible(true)
      return true
    }

    const el = document.querySelector(targetSelector) as HTMLElement | null
    if (!el) return false

    targetElRef.current = el
    const rect = el.getBoundingClientRect()
    setTargetRect(rect)

    // Auto-detect best position (top vs bottom)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    setPosition(spaceBelow > spaceAbove ? 'bottom' : 'top')

    setVisible(true)
    return true
  }, [targetSelector])

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 30
    let timer: ReturnType<typeof setInterval>

    if (!findTarget()) {
      timer = setInterval(() => {
        attempts++
        if (findTarget() || attempts >= maxAttempts) {
          clearInterval(timer)
          // If max attempts reached without finding, show centered anyway
          if (attempts >= maxAttempts) setVisible(true)
        }
      }, 100)
    }

    // Update rect on scroll/resize
    const updateRect = () => {
      if (targetElRef.current) {
        const rect = targetElRef.current.getBoundingClientRect()
        setTargetRect(rect)
        const spaceBelow = window.innerHeight - rect.bottom
        const spaceAbove = rect.top
        setPosition(spaceBelow > spaceAbove ? 'bottom' : 'top')
      }
    }

    window.addEventListener('scroll', updateRect, { passive: true })
    window.addEventListener('resize', updateRect, { passive: true })

    return () => {
      clearInterval(timer)
      window.removeEventListener('scroll', updateRect)
      window.removeEventListener('resize', updateRect)
    }
  }, [findTarget])

  if (!visible) return null

  // ── Mode centré (pas de cible) ──
  if (!targetSelector || !targetRect) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 55 }}>
        {/* Overlay translucide */}
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            animation: 'coach-mark-fade-in 0.3s ease-out',
          }}
        />

        {/* Bulle centrée */}
        <div
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 320,
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 56,
            animation: 'coach-mark-scale-in 0.3s ease-out',
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 20,
              padding: '24px',
              boxShadow: '0 12px 48px rgba(0, 0, 0, 0.2)',
              textAlign: 'center',
            }}
          >
            {stepLabel && (
              <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 8 }}>
                Étape {stepLabel}
              </div>
            )}
            {icon && (
              <div style={{ fontSize: 36, marginBottom: 8 }}>{icon}</div>
            )}
            <h3 style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#1f2937',
              marginBottom: 6,
              lineHeight: 1.3,
            }}>
              {title}
            </h3>
            <p style={{
              fontSize: 13,
              color: '#6b7280',
              lineHeight: 1.6,
              marginBottom: extra ? 8 : (ctaLabel ? 16 : 0),
            }}>
              {description}
            </p>
            {extra}
            {ctaLabel && onCta && (
              <button
                onClick={onCta}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '12px 16px',
                  marginTop: extra ? 16 : 0,
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {ctaLabel}
              </button>
            )}
          </div>
        </div>

        <style jsx>{`
          @keyframes coach-mark-fade-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes coach-mark-scale-in {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          }
        `}</style>
      </div>
    )
  }

  // ── Mode spotlight (avec cible) ──
  const spot = {
    top: targetRect.top - padding,
    left: targetRect.left - padding,
    width: targetRect.width + padding * 2,
    height: targetRect.height + padding * 2,
  }

  // Tooltip position — centered horizontally relative to target, clamped to viewport
  const tooltipMaxWidth = 300
  let tooltipLeft = spot.left + spot.width / 2 - tooltipMaxWidth / 2
  tooltipLeft = Math.max(12, Math.min(tooltipLeft, window.innerWidth - tooltipMaxWidth - 12))

  const arrowLeft = spot.left + spot.width / 2 - tooltipLeft - 8

  const tooltipTop = position === 'bottom'
    ? spot.top + spot.height + 14
    : spot.top - 14

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 55 }}>
      {/* Overlay translucide avec découpe spotlight */}
      <div
        style={{
          position: 'fixed',
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          borderRadius: 14,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.4)',
          pointerEvents: 'none',
          animation: 'coach-mark-fade-in 0.3s ease-out',
          zIndex: 55,
        }}
      />

      {/* Bordure pulsante autour du spotlight */}
      <div
        style={{
          position: 'fixed',
          top: spot.top - 2,
          left: spot.left - 2,
          width: spot.width + 4,
          height: spot.height + 4,
          borderRadius: 16,
          border: '2px solid rgba(129, 140, 248, 0.5)',
          pointerEvents: 'none',
          animation: 'coach-mark-pulse 2s ease-in-out infinite',
          zIndex: 55,
        }}
      />

      {/* Bloquer les clics partout (l'overlay est non-interactif) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 54,
        }}
      />

      {/* Bulle tooltip */}
      <div
        ref={tooltipRef}
        style={{
          position: 'fixed',
          left: tooltipLeft,
          ...(position === 'bottom'
            ? { top: tooltipTop }
            : { top: 'auto', bottom: window.innerHeight - tooltipTop }
          ),
          width: tooltipMaxWidth,
          pointerEvents: 'auto',
          zIndex: 56,
          animation: 'coach-mark-slide-in 0.3s ease-out 0.1s both',
        }}
      >
        {/* Flèche */}
        <div
          style={{
            position: 'absolute',
            left: Math.max(12, Math.min(arrowLeft, tooltipMaxWidth - 28)),
            ...(position === 'bottom'
              ? { top: -7 }
              : { bottom: -7 }
            ),
            width: 14,
            height: 14,
            background: 'white',
            transform: 'rotate(45deg)',
            borderRadius: 2,
            boxShadow: position === 'bottom'
              ? '-2px -2px 4px rgba(0,0,0,0.05)'
              : '2px 2px 4px rgba(0,0,0,0.05)',
          }}
        />

        {/* Contenu */}
        <div
          style={{
            position: 'relative',
            background: 'white',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          }}
        >
          {stepLabel && (
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6366f1', marginBottom: 4, textAlign: 'center' }}>
              Étape {stepLabel}
            </div>
          )}
          {icon && (
            <div style={{ fontSize: 28, marginBottom: 6, textAlign: 'center' }}>{icon}</div>
          )}
          <h3 style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#1f2937',
            marginBottom: 4,
            lineHeight: 1.3,
          }}>
            {title}
          </h3>
          <p style={{
            fontSize: 13,
            color: '#6b7280',
            lineHeight: 1.5,
            marginBottom: extra ? 8 : (ctaLabel ? 12 : 0),
          }}>
            {description}
          </p>
          {extra}
          {ctaLabel && onCta && (
            <button
              onClick={onCta}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
                marginTop: extra ? 12 : 0,
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {ctaLabel}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes coach-mark-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes coach-mark-slide-in {
          from {
            opacity: 0;
            transform: translateY(${position === 'bottom' ? '-8px' : '8px'});
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes coach-mark-pulse {
          0%, 100% {
            opacity: 0.5;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.03);
          }
        }
        @keyframes coach-mark-scale-in {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
          to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  )
}
