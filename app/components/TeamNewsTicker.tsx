'use client'

import { useEffect, useRef, useState } from 'react'

type Props = {
  news: string[]
}

const ITEM_HEIGHT = 40 // slot d'une news (2 lignes × 20px line-height)
const LINE_HEIGHT = 20
const DWELL_MS = 5000
const TRANSITION_MS = 500

/**
 * Bandeau éditorial d'actualités du groupe — card blanche propre avec
 * label "À la une" et news rotative sur 2 lignes. Masqué si aucune news.
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
      className="relative rounded-[18px] overflow-hidden"
      style={{
        background: '#fff',
        border: '2px solid #f0ebe0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05)',
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Barre latérale amber gauche (effet "quote") */}
      <div
        className="absolute left-0 top-0 bottom-0 w-[4px]"
        style={{ background: 'linear-gradient(180deg, #fbbf24, #f59e0b)' }}
      />

      <div className="pl-4 pr-3 py-3">
        {/* Label en haut */}
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-extrabold tracking-[0.12em] uppercase flex items-center gap-1.5" style={{ color: '#92400e' }}>
            <span aria-hidden>📣</span>
            À la une · actus du groupe
          </p>
          {news.length > 1 && (
            <div className="flex gap-1">
              {news.map((_, i) => (
                <span
                  key={i}
                  className="inline-block rounded-full transition-all"
                  style={{
                    width: i === index ? 14 : 4,
                    height: 4,
                    background: i === index ? '#f59e0b' : 'rgba(245,158,11,0.25)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* News rotative sur 2 lignes */}
        <div
          className="relative overflow-hidden"
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
                  fontSize: 13.5,
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
    </div>
  )
}
