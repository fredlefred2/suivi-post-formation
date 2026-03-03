'use client'

import Link from 'next/link'

type AxeItem = {
  id: string
  index: number
  subject: string
  completedCount: number
  dyn: { label: string; icon: string; color: string }
}

// Positions précises des marqueurs sur la barre (en %)
// 📍=0  👣=1  🥁=3  🔥=6  🚀=9 → normalisé sur 9
const MARKERS = [
  { icon: '📍', pos: 0      },  // 0 actions
  { icon: '👣', pos: 1 / 9  },  // 1 action
  { icon: '🥁', pos: 3 / 9  },  // 3 actions
  { icon: '🔥', pos: 6 / 9  },  // 6 actions
  { icon: '🚀', pos: 1      },  // 9 actions
]

function getCurrentLevelIndex(count: number) {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 8) return 3
  return 4
}

function getProgress(count: number) {
  if (count >= 9) return 100
  return Math.round((count / 9) * 100)
}

function getCurrentLevel(count: number) {
  if (count === 0) return { label: 'Ancrage',    icon: '📍' }
  if (count <= 2) return { label: 'Impulsion',  icon: '👣' }
  if (count <= 5) return { label: 'Rythme',     icon: '🥁' }
  if (count <= 8) return { label: 'Intensité',  icon: '🔥' }
  return              { label: 'Propulsion', icon: '🚀' }
}

export default function AxesCarousel({ axes }: { axes: AxeItem[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2">
      {axes.map((axe) => {
        const progress = getProgress(axe.completedCount)
        const levelIdx = getCurrentLevelIndex(axe.completedCount)
        const level = getCurrentLevel(axe.completedCount)

        return (
          <Link
            key={axe.id}
            href={`/axes?index=${axe.index}`}
            className={`snap-center shrink-0 w-[78vw] max-w-[320px] rounded-2xl border-2 p-4 block hover:shadow-lg transition-all ${axe.dyn.color}`}
          >
            {/* Ligne 1 : numéro + titre (2 lignes max) */}
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-white/60 border border-current/20 flex items-center justify-center text-base font-bold shrink-0 mt-0.5">
                {axe.index + 1}
              </span>
              <p className="font-bold text-base leading-snug line-clamp-2 flex-1">{axe.subject}</p>
            </div>

            {/* Ligne 2 : actions + icône + niveau */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm font-semibold">
                {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
              </span>
              <span className="text-gray-300">·</span>
              <span className="text-lg leading-none">{level.icon}</span>
              <span className="text-sm font-medium opacity-80">
                Niveau {level.label}
              </span>
            </div>

            {/* Barre de progression */}
            <div className="mt-3 relative">
              <div className="h-3 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-current opacity-40 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {/* Marqueurs positionnés précisément */}
              <div className="relative h-5 mt-0.5">
                {MARKERS.map((m, i) => (
                  <span
                    key={i}
                    className={`absolute -translate-x-1/2 text-sm ${i <= levelIdx ? 'opacity-100' : 'opacity-25'}`}
                    style={{ left: `${m.pos * 100}%` }}
                  >
                    {m.icon}
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
