'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
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
  const isDragging = useRef(false)
  const isVerticalScroll = useRef(false)
  const [offsetX, setOffsetX] = useState(0)
  const [animate, setAnimate] = useState(false)
  const navigatingRef = useRef(false)

  // Slide-in on mount: check if we arrived via swipe
  useEffect(() => {
    const dir = sessionStorage.getItem('swipe-direction')
    if (dir === 'left' || dir === 'right') {
      sessionStorage.removeItem('swipe-direction')
      // Start off-screen, then animate to 0
      const startOffset = dir === 'left' ? window.innerWidth : -window.innerWidth
      setOffsetX(startOffset)
      setAnimate(false)
      // Next frame: enable animation and slide to 0
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setAnimate(true)
          setOffsetX(0)
        })
      })
    }
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (navigatingRef.current) return
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    isDragging.current = true
    isVerticalScroll.current = false
    setAnimate(false)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || navigatingRef.current) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Lock to vertical scroll on first significant vertical move
    if (!isVerticalScroll.current && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
      isVerticalScroll.current = true
      return
    }
    if (isVerticalScroll.current) return

    // Rubber band effect at edges
    let clampedDx = dx
    if (dx > 0 && !prevUrl) clampedDx = dx * 0.2
    if (dx < 0 && !nextUrl) clampedDx = dx * 0.2

    setOffsetX(clampedDx)
  }, [prevUrl, nextUrl])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current || navigatingRef.current) return
    isDragging.current = false

    if (isVerticalScroll.current) {
      setOffsetX(0)
      return
    }

    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current

    if (Math.abs(dy) > Math.abs(dx)) {
      setAnimate(true)
      setOffsetX(0)
      return
    }

    const threshold = 60

    if (dx < -threshold && nextUrl) {
      // Swipe left → slide out left → next
      navigatingRef.current = true
      setAnimate(true)
      setOffsetX(-window.innerWidth)
      sessionStorage.setItem('swipe-direction', 'left')
      setTimeout(() => router.push(nextUrl), 280)
    } else if (dx > threshold && prevUrl) {
      // Swipe right → slide out right → prev
      navigatingRef.current = true
      setAnimate(true)
      setOffsetX(window.innerWidth)
      sessionStorage.setItem('swipe-direction', 'right')
      setTimeout(() => router.push(prevUrl), 280)
    } else {
      // Spring back
      setAnimate(true)
      setOffsetX(0)
    }
  }, [nextUrl, prevUrl, router])

  // Pas de carousel si un seul apprenant
  if (total <= 1) return <>{children}</>

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: 'pan-y', overflowX: 'hidden' }}
    >

      {/* Barre de navigation : ← dots → */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => {
            if (!prevUrl) return
            sessionStorage.setItem('swipe-direction', 'right')
            router.push(prevUrl)
          }}
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
                      sessionStorage.setItem('swipe-direction', i > currentIndex ? 'left' : 'right')
                      router.push(allUrls[i])
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
          onClick={() => {
            if (!nextUrl) return
            sessionStorage.setItem('swipe-direction', 'left')
            router.push(nextUrl)
          }}
          disabled={!nextUrl}
          className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: animate ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  )
}
