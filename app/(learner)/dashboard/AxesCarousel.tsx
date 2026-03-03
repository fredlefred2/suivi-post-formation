'use client'

import Link from 'next/link'

type AxeItem = {
  id: string
  index: number
  subject: string
  completedCount: number
  dyn: { label: string; icon: string; color: string }
}

// Niveaux de progression avec seuils
const LEVELS = [
  { label: 'Ancrage',    icon: '📍', min: 0,  max: 0  },
  { label: 'Impulsion',  icon: '👣', min: 1,  max: 2  },
  { label: 'Rythme',     icon: '🥁', min: 3,  max: 5  },
  { label: 'Intensité',  icon: '🔥', min: 6,  max: 8  },
  { label: 'Propulsion', icon: '🚀', min: 9,  max: 99 },
]

function getProgress(count: number) {
  // Propulsion atteinte à 9 actions → 100%
  if (count >= 9) return 100
  return Math.round((count / 9) * 100)
}

function getCurrentLevelIndex(count: number) {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 8) return 3
  return 4
}

export default function AxesCarousel({ axes }: { axes: AxeItem[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
      {axes.map((axe) => {
        const progress = getProgress(axe.completedCount)
        const levelIdx = getCurrentLevelIndex(axe.completedCount)
        const currentLevel = LEVELS[levelIdx]

        return (
          <Link
            key={axe.id}
            href={`/axes?index=${axe.index}`}
            className={`snap-center shrink-0 w-[78vw] max-w-[320px] rounded-2xl border-2 p-5 block hover:shadow-lg transition-all ${axe.dyn.color}`}
          >
            {/* Ligne du haut : numéro d'axe + icône niveau */}
            <div className="flex items-center justify-between">
              <span className="w-8 h-8 rounded-full bg-white/60 border border-current/20 flex items-center justify-center text-sm font-bold">
                {axe.index + 1}
              </span>
              <span className="text-3xl">{currentLevel.icon}</span>
            </div>

            {/* Sujet de l'axe */}
            <p className="font-bold text-base mt-3 leading-snug">{axe.subject}</p>

            {/* Actions + niveau */}
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-semibold">
                {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
              </span>
              <span className="text-sm font-medium opacity-80">
                {currentLevel.label}
              </span>
            </div>

            {/* Barre de progression */}
            <div className="mt-3 relative">
              <div className="h-2.5 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-current opacity-40 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* Marqueurs de niveaux */}
              <div className="flex justify-between mt-1">
                {LEVELS.map((lvl, i) => (
                  <span
                    key={i}
                    className={`text-xs ${i <= levelIdx ? 'opacity-100' : 'opacity-30'}`}
                  >
                    {lvl.icon}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
