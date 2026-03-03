'use client'

import { useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'

type AxeItem = {
  id: string
  index: number
  subject: string
  completedCount: number
  dyn: { label: string; icon: string; color: string }
}

export default function AxesCarousel({ axes }: { axes: AxeItem[] }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isJumping = useRef(false)

  // On triple les items pour l'effet de boucle infinie
  // [copy1] [original] [copy2]
  const items = [...axes, ...axes, ...axes]
  const count = axes.length

  // Scroll vers le set du milieu au montage
  useEffect(() => {
    const el = scrollRef.current
    if (!el || count === 0) return
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 0
    const gap = 16
    // Positionner sur le premier item du set central
    el.scrollLeft = count * (cardWidth + gap)
  }, [count])

  // Détection de fin de scroll → reboucle
  const handleScroll = useCallback(() => {
    if (isJumping.current) return
    const el = scrollRef.current
    if (!el || count === 0) return

    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 0
    const gap = 16
    const setWidth = count * (cardWidth + gap)

    // Si on a scrollé dans le 3e set → sauter au set central
    if (el.scrollLeft >= setWidth * 2) {
      isJumping.current = true
      el.style.scrollBehavior = 'auto'
      el.scrollLeft -= setWidth
      el.style.scrollBehavior = ''
      requestAnimationFrame(() => { isJumping.current = false })
    }
    // Si on a scrollé dans le 1er set → sauter au set central
    else if (el.scrollLeft < setWidth * 0.3) {
      isJumping.current = true
      el.style.scrollBehavior = 'auto'
      el.scrollLeft += setWidth
      el.style.scrollBehavior = ''
      requestAnimationFrame(() => { isJumping.current = false })
    }
  }, [count])

  // Debounce du scroll end
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let timer: ReturnType<typeof setTimeout>
    function onScroll() {
      clearTimeout(timer)
      timer = setTimeout(handleScroll, 80)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      clearTimeout(timer)
    }
  }, [handleScroll])

  // Indicateurs (dots) : quel axe original est actuellement centré
  const getDotIndex = useCallback(() => {
    const el = scrollRef.current
    if (!el || count === 0) return 0
    const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 0
    const gap = 16
    const centerOffset = el.scrollLeft + el.clientWidth / 2
    const idx = Math.round(centerOffset / (cardWidth + gap)) % count
    return idx < 0 ? idx + count : idx
  }, [count])

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {items.map((axe, i) => (
          <Link
            key={`${axe.id}-${i}`}
            href={`/axes?index=${axe.index}`}
            className={`snap-center shrink-0 w-[75vw] max-w-[300px] rounded-2xl border-2 p-5 text-center block hover:shadow-lg transition-all ${axe.dyn.color}`}
          >
            <span className="text-5xl block">{axe.dyn.icon}</span>
            <p className="font-bold text-base mt-3 leading-snug">{axe.subject}</p>
            <p className="text-sm mt-2 font-semibold">
              {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
            </p>
            <p className="text-sm mt-1 opacity-70 font-medium">
              {axe.dyn.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Dots de pagination */}
      {count > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {axes.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                const el = scrollRef.current
                if (!el) return
                const cardWidth = el.firstElementChild?.getBoundingClientRect().width ?? 0
                const gap = 16
                el.scrollTo({
                  left: (count + i) * (cardWidth + gap) - (el.clientWidth - cardWidth) / 2,
                  behavior: 'smooth',
                })
              }}
              className="w-2 h-2 rounded-full bg-gray-300 hover:bg-indigo-400 transition-colors"
              aria-label={`Axe ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
