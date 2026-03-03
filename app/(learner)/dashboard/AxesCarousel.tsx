'use client'

import Link from 'next/link'

type AxeItem = {
  id: string
  index: number
  subject: string
  completedCount: number
  dyn: { label: string; icon: string; color: string }
}

export default function AxesCarousel({ axes }: { axes: AxeItem[] }) {
  return (
    <div
      className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
    >
      {axes.map((axe) => (
        <Link
          key={axe.id}
          href={`/axes?index=${axe.index}`}
          className={`snap-center shrink-0 w-[75vw] max-w-[300px] rounded-2xl border-2 p-5 text-center block hover:shadow-lg transition-all ${axe.dyn.color}`}
        >
          <p className="text-xs font-semibold opacity-60 uppercase tracking-wide">
            Axe {axe.index + 1}
          </p>
          <p className="font-bold text-base mt-1.5 leading-snug">{axe.subject}</p>
          <p className="text-sm mt-2 font-semibold">
            {axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}
          </p>
          <p className="text-sm mt-1.5 font-medium">
            {axe.dyn.icon} {axe.dyn.label}
          </p>
        </Link>
      ))}
    </div>
  )
}
