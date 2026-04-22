'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import ActionFeedback from './ActionFeedback'
import type { ActionFeedbackData } from '@/lib/types'

// Couleurs de niveau (alignées sur l'app)
const LEVEL_BG: Record<number, string> = {
  0: '#94a3b8', // Intention — slate
  1: '#0ea5e9', // Essai — sky
  2: '#10b981', // Habitude — emerald
  3: '#f59e0b', // Réflexe — amber
  4: '#fb7185', // Maîtrise — rose
}

function getLevel(count: number): { icon: string; level: number; label: string } {
  if (count === 0) return { icon: '💡', level: 0, label: 'Intention' }
  if (count <= 2) return { icon: '🧪', level: 1, label: 'Essai' }
  if (count <= 4) return { icon: '🔄', level: 2, label: 'Habitude' }
  if (count <= 6) return { icon: '⚡', level: 3, label: 'Réflexe' }
  return { icon: '👑', level: 4, label: 'Maîtrise' }
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
  /** Nombre d'actions visibles dans le feed avant le bouton Voir tout */
  visibleCount?: number
}

export default function TeamActionsFeed({
  actions,
  feedbackMap,
  deltaThisWeek,
  visibleCount = 2,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setModalOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen])

  if (actions.length === 0) {
    return (
      <div
        className="rounded-[18px] bg-white px-4 py-5 text-center"
        style={{ border: '2px solid #f0ebe0' }}
      >
        <p className="text-[13px]" style={{ color: '#a0937c' }}>
          Aucune action cette semaine. Sois le premier à poster&nbsp;!
        </p>
      </div>
    )
  }

  const visibleActions = actions.slice(0, visibleCount)
  const hasMore = actions.length > visibleCount

  return (
    <>
      <div
        className="rounded-[18px] bg-white"
        style={{ border: '2px solid #f0ebe0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <p className="text-[11px] font-extrabold tracking-wider uppercase" style={{ color: '#a0937c' }}>
            Dernières actions
            {deltaThisWeek > 0 && <span className="ml-2 text-[10px] normal-case" style={{ color: '#92400e', letterSpacing: 0 }}>· {deltaThisWeek} cette sem.</span>}
          </p>
          {hasMore && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-[10.5px] font-extrabold px-2 py-1 rounded-full hover:brightness-95 transition-all"
              style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}
            >
              Voir tout →
            </button>
          )}
        </div>

        {/* Feed — 2 actions visibles par défaut */}
        <div className="px-4 pb-2">
          {visibleActions.map((a, idx) => {
            const dyn = getLevel(a.axe_action_count)
            return (
              <div
                key={a.id}
                className="flex gap-2.5 py-2.5"
                style={{
                  borderTop: idx === 0 ? 'none' : '1px solid #f4efe3',
                }}
              >
                {/* Avatar coloré par niveau */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] shrink-0"
                  style={{
                    background: '#fff',
                    border: `2.5px solid ${LEVEL_BG[dyn.level]}`,
                    boxShadow: `0 0 0 2px ${LEVEL_BG[dyn.level]}22`,
                  }}
                  title={dyn.label}
                >
                  {dyn.icon}
                </div>

                <div className="flex-1 min-w-0">
                  {/* Meta : prénom · axe · time */}
                  <div className="flex items-center gap-1.5 text-[11px] font-bold">
                    <span style={{ color: '#1a1a2e' }}>{a.learner_first_name}</span>
                    <span style={{ color: '#a0937c' }}>·</span>
                    <span className="truncate" style={{ color: '#92400e' }}>{a.axe_subject}</span>
                    <span className="ml-auto font-semibold shrink-0" style={{ color: '#a0937c', fontSize: 10 }}>
                      {formatAge(a.created_at)}
                    </span>
                  </div>

                  {/* Description (2 lignes max) */}
                  <p
                    className="text-[12.5px] mt-0.5"
                    style={{
                      color: '#1a1a2e',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {a.description}
                  </p>

                  {/* Feedback inline — likes + commentaires cliquables */}
                  {feedbackMap[a.id] && (
                    <div className="mt-1">
                      <ActionFeedback
                        actionId={a.id}
                        feedback={feedbackMap[a.id]}
                        canInteract={true}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
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
              {actions.map((a) => {
                const dyn = getLevel(a.axe_action_count)
                return (
                  <div key={a.id} className="py-3" style={{ borderBottom: '1px solid #f0ebe0' }}>
                    <div className="flex items-start gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-[18px] shrink-0"
                        style={{
                          background: '#fff',
                          border: `3px solid ${LEVEL_BG[dyn.level]}`,
                          boxShadow: `0 0 0 2px ${LEVEL_BG[dyn.level]}22`,
                        }}
                        title={dyn.label}
                      >
                        {dyn.icon}
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
                              canInteract={true}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
