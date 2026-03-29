'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function LearnerNav({
  prevUrl,
  nextUrl,
  currentIndex,
  total,
  allUrls = [],
  children,
}: {
  prevUrl: string | null
  nextUrl: string | null
  currentIndex: number
  total: number
  allUrls?: string[]
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
    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) < 50) return
    if (dx > 0 && nextUrl) router.push(nextUrl)
    if (dx < 0 && prevUrl) router.push(prevUrl)
  }

  // Pas de carousel si un seul apprenant
  if (total <= 1) return <>{children}</>

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* Barre de navigation : ← dots → */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => prevUrl && router.push(prevUrl)}
          disabled={!prevUrl}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="flex items-center gap-1.5">
          {total <= 12
            ? Array.from({ length: total }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (allUrls[i] && i !== currentIndex) router.push(allUrls[i])
                  }}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    i === currentIndex
                      ? 'w-6 bg-indigo-500'
                      : 'w-2 bg-gray-300 hover:bg-gray-400 cursor-pointer'
                  }`}
                />
              ))
            : (
              <span className="text-xs font-medium text-gray-500">
                {currentIndex + 1} / {total}
              </span>
            )
          }
        </div>

        <button
          onClick={() => nextUrl && router.push(nextUrl)}
          disabled={!nextUrl}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {children}
    </div>
  )
}
