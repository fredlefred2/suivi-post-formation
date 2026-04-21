'use client'

import { useEffect, useRef, useState } from 'react'
import { Megaphone } from 'lucide-react'

type Props = {
  news: string[]
}

const ITEM_HEIGHT = 18 // px — doit correspondre à la CSS ci-dessous
const DWELL_MS = 4500  // durée d'affichage d'une news
const TRANSITION_MS = 450 // durée d'animation entre 2 news

/**
 * Ticker vertical rotatif — affiche une news à la fois avec slide-up auto
 * toutes les ~4.5s. Pause au hover. Masqué si aucune news.
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
      className="flex items-center overflow-hidden"
      style={{
        background: 'linear-gradient(90deg, rgba(251,191,36,0.14), rgba(251,191,36,0.04))',
        borderTop: '1px solid rgba(251,191,36,0.18)',
        borderBottom: '1px solid rgba(251,191,36,0.18)',
        padding: '8px 14px',
        height: 34,
      }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Megaphone
        size={13}
        className="shrink-0 mr-2"
        style={{ color: '#fbbf24', filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' }}
      />
      <div
        className="relative flex-1 overflow-hidden"
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
                lineHeight: `${ITEM_HEIGHT}px`,
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(255,255,255,0.92)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
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
