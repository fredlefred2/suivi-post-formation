'use client'

import { useRef, useState, useEffect } from 'react'
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
  const touchStartTime = useRef(0)
  const [slideClass, setSlideClass] = useState('')

  // Prefetch adjacent pages
  useEffect(() => {
    if (prevUrl) router.prefetch(prevUrl)
    if (nextUrl) router.prefetch(nextUrl)
  }, [prevUrl, nextUrl, router])

  // Slide-in animation on mount
  useEffect(() => {
    const dir = sessionStorage.getItem('swipe-direction')
    if (dir === 'next') {
      setSlideClass('animate-slide-from-right')
    } else if (dir === 'prev') {
      setSlideClass('animate-slide-from-left')
    }
    sessionStorage.removeItem('swipe-direction')
  }, [])

  function navigate(url: string, direction: 'prev' | 'next') {
    sessionStorage.setItem('swipe-direction', direction)
    router.push(url)
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    touchStartTime.current = Date.now()
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    const elapsed = Date.now() - touchStartTime.current

    // Ignore vertical scrolls
    if (Math.abs(dy) > Math.abs(dx)) return

    // Quick flick or long drag
    const isFlick = elapsed < 300 && Math.abs(dx) > 30
    const isDrag = Math.abs(dx) > 80

    if (!isFlick && !isDrag) return

    if (dx > 0 && nextUrl) navigate(nextUrl, 'next')
    if (dx < 0 && prevUrl) navigate(prevUrl, 'prev')
  }

  // Pas de carousel si un seul apprenant
  if (total <= 1) return <>{children}</>

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y', overflowX: 'hidden' }}
    >

      {/* Barre de navigation : ← dots → */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => prevUrl && navigate(prevUrl, 'prev')}
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
                    if (allUrls[i] && i !== currentIndex) {
                      navigate(allUrls[i], i > currentIndex ? 'next' : 'prev')
                    }
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
          onClick={() => nextUrl && navigate(nextUrl, 'next')}
          disabled={!nextUrl}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className={slideClass} onAnimationEnd={() => setSlideClass('')}>
        {children}
      </div>
    </div>
  )
}
