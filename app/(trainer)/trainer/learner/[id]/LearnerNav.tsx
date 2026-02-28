'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function LearnerNav({
  prevUrl,
  nextUrl,
  currentIndex,
  total,
  prevName,
  nextName,
  children,
}: {
  prevUrl: string | null
  nextUrl: string | null
  currentIndex: number
  total: number
  prevName?: string
  nextName?: string
  children: React.ReactNode
}) {
  const router = useRouter()
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    // Ignorer si le geste est surtout vertical (scroll)
    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) < 60) return
    if (dx > 0 && nextUrl) router.push(nextUrl)
    if (dx < 0 && prevUrl) router.push(prevUrl)
  }

  // Pas de carousel si un seul apprenant ou contexte inconnu
  if (total <= 1) return <>{children}</>

  const firstName = (full?: string) => full?.split(' ')[0] ?? ''
  const showDots = total <= 8

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* ── Barre de navigation ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 bg-white border border-gray-100 rounded-xl px-3 py-2 shadow-sm">

        {/* Précédent */}
        <button
          onClick={() => prevUrl && router.push(prevUrl)}
          disabled={!prevUrl}
          className={`flex items-center gap-1 flex-1 min-w-0 rounded-lg px-1.5 py-1 transition-colors ${
            prevUrl
              ? 'text-indigo-600 hover:bg-indigo-50 cursor-pointer'
              : 'text-gray-200 cursor-default'
          }`}
        >
          <ChevronLeft size={15} className="shrink-0" />
          {prevUrl && (
            <span className="text-xs font-medium truncate max-w-[70px]">
              {firstName(prevName)}
            </span>
          )}
        </button>

        {/* Indicateur central */}
        <div className="flex items-center justify-center shrink-0">
          {showDots ? (
            <div className="flex items-center gap-1">
              {Array.from({ length: total }).map((_, i) => (
                <span
                  key={i}
                  className={`rounded-full transition-all duration-200 ${
                    i === currentIndex
                      ? 'w-2.5 h-2.5 bg-indigo-500'
                      : 'w-1.5 h-1.5 bg-gray-300'
                  }`}
                />
              ))}
            </div>
          ) : (
            <span className="text-xs font-medium text-gray-500">
              {currentIndex + 1} / {total}
            </span>
          )}
        </div>

        {/* Suivant */}
        <button
          onClick={() => nextUrl && router.push(nextUrl)}
          disabled={!nextUrl}
          className={`flex items-center gap-1 flex-1 min-w-0 justify-end rounded-lg px-1.5 py-1 transition-colors ${
            nextUrl
              ? 'text-indigo-600 hover:bg-indigo-50 cursor-pointer'
              : 'text-gray-200 cursor-default'
          }`}
        >
          {nextUrl && (
            <span className="text-xs font-medium truncate max-w-[70px]">
              {firstName(nextName)}
            </span>
          )}
          <ChevronRight size={15} className="shrink-0" />
        </button>
      </div>

      {children}
    </div>
  )
}
