'use client'

import { useEffect, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'

type Props = {
  news: string[]
}

const ITEM_HEIGHT = 38 // px — hauteur d'un slot (2 lignes × 19px line-height)
const LINE_HEIGHT = 19
const DWELL_MS = 5000
const TRANSITION_MS = 450

/**
 * Bandeau d'actualités du groupe — affiche une news à la fois (max 2 lignes)
 * avec slide-up toutes les ~5s. Pause au hover. Masqué si aucune news.
 */
export default function TeamNewsTicker({ news }: Props) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (news.length <= 1 || paused) return
    timerRef.current = setTimeout(() => {
      setIndex(i => (i + 1) % news.length)
    }, DWELL_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [index, news.length, paused])

  if (news.length === 0) return null

  return (
    <div
      className="flex items-center rounded-[16px]"
      style={{
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        border: '2px solid #fde68a',
        boxShadow: '0 2px 8px rgba(251,191,36,0.15)',
        padding: '8px 12px',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        className="shrink-0 mr-3 flex items-center justify-center rounded-full"
        style={{
          width: 28,
          height: 28,
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          boxShadow: '0 2px 6px rgba(251,191,36,0.4)',
        }}
      >
        <Megaphone size={14} color="#fff" strokeWidth={2.5} />
      </div>

      <div
        className="relative flex-1 min-w-0 overflow-hidden"
        style={{ height: ITEM_HEIGHT }}
      >
        <div
          style={{
            transform: `translateY(-${index * ITEM_HEIGHT}px)`,
            transition: `transform ${TRANSITION_MS}ms ease`,
          }}
        >
          {news.map((item, i) => (
            <div
              key={i}
              style={{
                height: ITEM_HEIGHT,
                lineHeight: `${LINE_HEIGHT}px`,
                fontSize: 12.5,
                fontWeight: 700,
                color: '#1a1a2e',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
