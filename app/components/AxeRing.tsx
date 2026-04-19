'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { getCurrentLevel, getCurrentLevelIndex, getNextLevel, getProgress } from '@/lib/axeHelpers'

type Props = {
  axeId: string
  axeIndex: number
  subject: string
  completedCount: number
  likesCount?: number
  commentsCount?: number
}

// Couleurs d'anneau par niveau (index dans MARKERS : 0=Intention ... 4=Maîtrise)
const RING_COLORS = ['#94a3b8', '#0ea5e9', '#10b981', '#f59e0b', '#fb7185']

/**
 * Un axe présenté en format "hybride" :
 * - Cercle progressif à gauche (anneau qui se remplit) avec icône du niveau au centre
 * - Nom + méta (niveau · nb actions · prochain palier) à droite
 * - Chevron indiquant le clic vers le détail
 */
export default function AxeRing({ axeId, axeIndex, subject, completedCount, likesCount = 0, commentsCount = 0 }: Props) {
  const level = getCurrentLevel(completedCount)
  const levelIdx = getCurrentLevelIndex(completedCount)
  const next = getNextLevel(completedCount)
  const progress = getProgress(completedCount) // 0-100

  // SVG anneau : r=22 → circonférence = 2*π*22 ≈ 138.23
  const radius = 22
  const circumference = 2 * Math.PI * radius

  // Animation de remplissage au mount : on part de 0% et on remplit vers progress
  // (v1.29.3 — anneaux qui respirent)
  const [animatedProgress, setAnimatedProgress] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setAnimatedProgress(progress), 120)
    return () => clearTimeout(t)
  }, [progress])
  const dashOffset = circumference * (1 - animatedProgress / 100)

  const ringColor = RING_COLORS[levelIdx]

  return (
    <Link
      href={`/axes?index=${axeIndex}`}
      className="axe-ring-float block bg-white rounded-[18px] hover:shadow-sm"
      style={{
        border: '2px solid #f0ebe0',
        animationDelay: `${axeIndex * 0.5}s`,
      }}
      {...(axeIndex === 0 ? { 'data-onboarding': 'progression' } : {})}
    >
      {/* Wrapper intérieur pour porter le active:scale sans conflit
          avec l'animation translateY de .axe-ring-float sur le Link parent */}
      <div className="flex items-center gap-3 p-3 transition-transform active:scale-[0.98]">
      {/* Cercle avec anneau progressif + icône niveau au centre */}
      <div className="relative shrink-0" style={{ width: 52, height: 52 }}>
        <svg
          viewBox="0 0 52 52"
          className="w-full h-full"
          style={{ transform: 'rotate(-90deg)' }}
        >
          {/* Fond */}
          <circle
            cx="26" cy="26" r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="6"
          />
          {/* Remplissage selon progression */}
          {progress > 0 && (
            <circle
              cx="26" cy="26" r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease' }}
            />
          )}
        </svg>
        {/* Icône niveau centrée */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontSize: 20, lineHeight: 1 }}
        >
          {level.icon}
        </div>
      </div>

      {/* Infos de l'axe */}
      <div className="flex-1 min-w-0">
        <p
          className="font-bold text-[13px] leading-tight truncate"
          style={{ color: '#1a1a2e' }}
        >
          {subject}
        </p>
        <p className="text-[11px] font-semibold mt-0.5 truncate" style={{ color: '#a0937c' }}>
          <span style={{ color: '#1a1a2e', fontWeight: 800 }}>{level.label}</span>
          <span> · {completedCount} action{completedCount !== 1 ? 's' : ''}</span>
          {next ? (
            <span style={{ color: '#f59e0b', fontWeight: 700 }}>
              {' · → '}{next.delta} pour {next.icon}
            </span>
          ) : (
            <span style={{ color: '#e11d48', fontWeight: 800 }}>{' · niveau max 🎉'}</span>
          )}
        </p>
        {(likesCount > 0 || commentsCount > 0) && (
          <p className="text-[10px] mt-1 flex items-center gap-2">
            {likesCount > 0 && (
              <span style={{ color: '#e11d48', fontWeight: 600 }}>❤️ {likesCount}</span>
            )}
            {commentsCount > 0 && (
              <span style={{ color: '#a0937c', fontWeight: 600 }}>💬 {commentsCount}</span>
            )}
          </p>
        )}
      </div>

      <ChevronRight size={18} style={{ color: '#a0937c' }} className="shrink-0" />
      </div>
    </Link>
  )
}
