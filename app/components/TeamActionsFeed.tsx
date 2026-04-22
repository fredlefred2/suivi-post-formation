'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import type { ActionFeedbackData } from '@/lib/types'
import ActionItem from './ui/ActionItem'
import Chip from './ui/Chip'

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
  /** Nombre d'actions visibles avant le bouton "Voir tout" */
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
            {deltaThisWeek > 0 && (
              <span className="ml-2 text-[10px] normal-case" style={{ color: '#92400e', letterSpacing: 0 }}>
                · {deltaThisWeek} cette sem.
              </span>
            )}
          </p>
          {hasMore && (
            <button
              onClick={() => setModalOpen(true)}
              className="hover:brightness-95 transition-all"
            >
              <Chip variant="amber" size="xs">Voir tout →</Chip>
            </button>
          )}
        </div>

        {/* Feed — 2 actions visibles par défaut avec ActionItem partagé */}
        <div className="px-4 pb-2">
          {visibleActions.map((a, idx) => (
            <div key={a.id} style={{ borderTop: idx === 0 ? 'none' : 'inherit' }}>
              <ActionItem
                action={a}
                feedback={feedbackMap[a.id]}
                showAuthor
                showAxe
                lineClamp={2}
                avatarSize={36}
              />
            </div>
          ))}
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
                <ActionItem
                  key={a.id}
                  action={a}
                  feedback={feedbackMap[a.id]}
                  showAuthor
                  showAxe
                  lineClamp={4}
                  avatarSize={40}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
