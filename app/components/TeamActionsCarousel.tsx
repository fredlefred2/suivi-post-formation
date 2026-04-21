'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import ActionFeedback from './ActionFeedback'
import type { ActionFeedbackData } from '@/lib/types'

type Action = {
  id: string
  description: string
  created_at: string
  axe_subject: string
  axe_action_count: number
  learner_first_name: string
  learner_last_name: string
}

type Props = {
  actions: Action[]
  feedbackMap: Record<string, ActionFeedbackData>
  deltaThisWeek: number
}

function getInitials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase()
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 60) return `il y a ${Math.max(1, minutes)} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'hier'
  return `il y a ${days} j`
}

export default function TeamActionsCarousel({ actions, feedbackMap, deltaThisWeek }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  // Escape pour fermer la modale
  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen])

  if (actions.length === 0) {
    return (
      <div
        className="rounded-[22px] p-4 text-center"
        style={{ background: '#fff', border: '2px solid #f0ebe0' }}
      >
        <p className="text-[13px]" style={{ color: '#a0937c' }}>
          Aucune action cette semaine. Tu peux être le premier à poster&nbsp;!
        </p>
      </div>
    )
  }

  // Doubler pour loop infini du carrousel
  const looped = [...actions, ...actions]

  return (
    <>
      <div
        className="rounded-[22px] py-3"
        style={{ background: '#fff', border: '2px solid #f0ebe0' }}
      >
        <div className="flex items-center justify-between mb-2 px-4">
          <p className="text-[11px] font-extrabold tracking-wider uppercase" style={{ color: '#a0937c' }}>
            Actions récentes
            {deltaThisWeek > 0 && <span className="ml-2 text-[10px] normal-case" style={{ color: '#92400e', letterSpacing: 0 }}>· {deltaThisWeek} cette sem.</span>}
          </p>
          <button
            onClick={() => setModalOpen(true)}
            className="text-[11px] font-extrabold px-2.5 py-1 rounded-full transition-colors hover:brightness-95"
            style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}
          >
            Voir tout →
          </button>
        </div>

        <div
          className="overflow-hidden relative"
          style={{
            WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
            maskImage: 'linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)',
          }}
        >
          <div
            className="team-carousel-track flex gap-2.5"
            style={{
              width: 'max-content',
              animationDuration: `${Math.max(20, actions.length * 6)}s`,
            }}
          >
            {looped.map((a, idx) => (
              <div
                key={`${a.id}-${idx}`}
                className="shrink-0 rounded-2xl px-3 py-2.5"
                style={{
                  width: 220,
                  background: 'linear-gradient(180deg, #ffffff 0%, #fffbf0 100%)',
                  border: '1.5px solid #f0ebe0',
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-extrabold"
                    style={{ background: '#1a1a2e', color: '#fbbf24' }}
                  >
                    {getInitials(a.learner_first_name, a.learner_last_name)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[11px] font-extrabold truncate" style={{ color: '#1a1a2e' }}>
                      {a.learner_first_name}
                    </div>
                    <div className="text-[10px] font-bold truncate" style={{ color: '#92400e' }}>
                      {a.axe_subject}
                    </div>
                  </div>
                </div>
                <p
                  className="text-[12px] leading-snug mt-1"
                  style={{
                    color: '#1a1a2e',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {a.description}
                </p>
                <p className="text-[10px] font-semibold mt-1.5" style={{ color: '#a0937c' }}>
                  {formatAge(a.created_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modale "Voir tout" */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div
            className="relative w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-[28px] sm:rounded-[28px]"
            style={{ background: '#faf8f4' }}
          >
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f0ebe0' }}>
              <div>
                <p className="text-[11px] font-extrabold tracking-wider uppercase" style={{ color: '#a0937c' }}>
                  Toutes les actions récentes
                </p>
                <p className="text-[14px] font-extrabold mt-0.5" style={{ color: '#1a1a2e' }}>
                  {actions.length} action{actions.length > 1 ? 's' : ''} sur 7 jours
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white"
                style={{ background: '#f0ebe0', color: '#1a1a2e' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-2">
              {actions.map((a) => (
                <div key={a.id} className="py-3" style={{ borderBottom: '1px solid #f0ebe0' }}>
                  <div className="flex items-start gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-extrabold shrink-0"
                      style={{ background: '#1a1a2e', color: '#fbbf24' }}
                    >
                      {getInitials(a.learner_first_name, a.learner_last_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-extrabold">
                        {a.learner_first_name} {a.learner_last_name}
                        <span className="ml-1 font-bold" style={{ color: '#92400e' }}>
                          · {a.axe_subject}
                        </span>
                      </p>
                      <p className="text-[13px] mt-0.5" style={{ color: '#1a1a2e' }}>
                        {a.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px]" style={{ color: '#a0937c' }}>
                          {formatAge(a.created_at)}
                        </span>
                        {feedbackMap[a.id] && (
                          <ActionFeedback
                            actionId={a.id}
                            feedback={feedbackMap[a.id]}
                            canInteract={false}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Animation du carrousel */}
      <style jsx>{`
        @keyframes team-carousel-slide {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .team-carousel-track {
          animation-name: team-carousel-slide;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .team-carousel-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </>
  )
}
