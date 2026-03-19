'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Position = 'top' | 'bottom'

type Props = {
  targetSelector: string
  title: string
  description: string
  icon?: string
  ctaLabel?: string
  onCta?: () => void
  /** When provided, the target element is made clickable (z-index above overlay) and this fires on click */
  onTargetClick?: () => void
  /** Extra padding around the spotlight cutout (px) */
  padding?: number
}

export default function CoachMark({
  targetSelector,
  title,
  description,
  icon,
  ctaLabel,
  onCta,
  onTargetClick,
  padding = 8,
}: Props) {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [position, setPosition] = useState<Position>('bottom')
  const [visible, setVisible] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const targetElRef = useRef<HTMLElement | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Find the target element with retry logic
  const findTarget = useCallback(() => {
    const el = document.querySelector(targetSelector) as HTMLElement | null
    if (!el) return false

    targetElRef.current = el
    const rect = el.getBoundingClientRect()
    setTargetRect(rect)

    // Auto-detect best position (top vs bottom)
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    setPosition(spaceBelow > spaceAbove ? 'bottom' : 'top')

    // If onTargetClick, make the target clickable above the overlay
    if (onTargetClick) {
      el.style.position = el.style.position || 'relative'
      el.style.zIndex = '60'
      el.style.pointerEvents = 'auto'

      const handler = (e: Event) => {
        e.preventDefault()
        e.stopPropagation()
        onTargetClick()
      }
      el.addEventListener('click', handler, { once: true })

      cleanupRef.current = () => {
        el.style.zIndex = ''
        el.style.pointerEvents = ''
        if (!el.style.position || el.style.position === 'relative') {
          el.style.position = ''
        }
        el.removeEventListener('click', handler)
      }
    }

    setVisible(true)
    return true
  }, [targetSelector, onTargetClick])

  useEffect(() => {
    let attempts = 0
    const maxAttempts = 30 // 3 seconds max
    let timer: ReturnType<typeof setInterval>

    if (!findTarget()) {
      timer = setInterval(() => {
        attempts++
        if (findTarget() || attempts >= maxAttempts) {
          clearInterval(timer)
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
      cleanupRef.current?.()
    }
  }, [findTarget])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  if (!targetRect || !visible) return null

  // Spotlight dimensions (with padding)
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

  const arrowLeft = spot.left + spot.width / 2 - tooltipLeft - 8 // 8 = half arrow width

  const tooltipTop = position === 'bottom'
    ? spot.top + spot.height + 12
    : spot.top - 12

  return (
    <div className="coach-mark-overlay" style={{ position: 'fixed', inset: 0, zIndex: 55, pointerEvents: 'none' }}>
      {/* Dark overlay with spotlight cutout via box-shadow */}
      <div
        className="coach-mark-spotlight"
        style={{
          position: 'fixed',
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)',
          pointerEvents: 'none',
          animation: 'coach-mark-fade-in 0.3s ease-out',
        }}
      />

      {/* Spotlight border pulse */}
      <div
        className="coach-mark-pulse"
        style={{
          position: 'fixed',
          top: spot.top - 2,
          left: spot.left - 2,
          width: spot.width + 4,
          height: spot.height + 4,
          borderRadius: 14,
          border: '2px solid rgba(129, 140, 248, 0.6)',
          pointerEvents: 'none',
          animation: 'coach-mark-pulse 2s ease-in-out infinite',
        }}
      />

      {/* Tooltip bubble */}
      <div
        ref={tooltipRef}
        className="coach-mark-tooltip"
        style={{
          position: 'fixed',
          left: tooltipLeft,
          ...(position === 'bottom'
            ? { top: tooltipTop }
            : { top: 'auto', bottom: window.innerHeight - tooltipTop }
          ),
          width: tooltipMaxWidth,
          pointerEvents: 'auto',
          animation: 'coach-mark-slide-in 0.3s ease-out 0.1s both',
        }}
      >
        {/* Arrow */}
        <div
          style={{
            position: 'absolute',
            left: Math.max(12, Math.min(arrowLeft, tooltipMaxWidth - 28)),
            ...(position === 'bottom'
              ? { top: -8 }
              : { bottom: -8 }
            ),
            width: 16,
            height: 16,
            background: 'white',
            transform: 'rotate(45deg)',
            borderRadius: 2,
            boxShadow: position === 'bottom'
              ? '-2px -2px 4px rgba(0,0,0,0.05)'
              : '2px 2px 4px rgba(0,0,0,0.05)',
          }}
        />

        {/* Content */}
        <div
          style={{
            position: 'relative',
            background: 'white',
            borderRadius: 16,
            padding: '16px 20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
          }}
        >
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
            marginBottom: ctaLabel ? 12 : 0,
          }}>
            {description}
          </p>
          {ctaLabel && onCta && (
            <button
              onClick={onCta}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px 16px',
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
          {onTargetClick && !ctaLabel && (
            <p style={{
              fontSize: 11,
              color: '#a5b4fc',
              textAlign: 'center',
              marginTop: 8,
              fontWeight: 500,
            }}>
              Clique sur l&apos;element en surbrillance
            </p>
          )}
        </div>
      </div>

      {/* CSS animations */}
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
            opacity: 0.6;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }
      `}</style>
    </div>
  )
}
