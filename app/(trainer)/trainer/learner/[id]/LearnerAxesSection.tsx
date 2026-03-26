'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ActionFeedbackData } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'
import {
  MARKERS,
  getDynamique,
  getCurrentLevelIndex,
  getProgress,
  getCurrentLevel,
  getActionPhaseIcon,
} from '@/lib/axeHelpers'

function getActionPhaseBg(rank: number) {
  if (rank <= 2) return 'bg-sky-100'
  if (rank <= 5) return 'bg-emerald-100'
  if (rank <= 8) return 'bg-orange-100'
  return 'bg-rose-100'
}

type ActionRow = { id: string; description: string; completed: boolean; created_at: string }

type AxeData = {
  id: string
  index: number
  subject: string
  description: string | null
  difficulty: string
  actions: ActionRow[]
}

type Props = {
  axes: AxeData[]
  feedbackMap: Record<string, ActionFeedbackData>
}

const emptyFeedback: ActionFeedbackData = {
  likes_count: 0,
  comments_count: 0,
  liked_by_me: false,
  likers: [],
  comments: [],
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  })
}

const MAX_VISIBLE_ACTIONS = 3

export default function LearnerAxesSection({ axes, feedbackMap }: Props) {
  const [expandedAxes, setExpandedAxes] = useState<Set<string>>(new Set())

  function toggleExpand(axeId: string) {
    setExpandedAxes((prev) => {
      const next = new Set(prev)
      if (next.has(axeId)) next.delete(axeId)
      else next.add(axeId)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <h2 className="section-title">🎯 Axes de progrès</h2>

      {axes.map((axe) => {
        const actionsCount = axe.actions.length
        const dyn = getDynamique(actionsCount)
        const progress = getProgress(actionsCount)
        const levelIdx = getCurrentLevelIndex(actionsCount)
        const level = getCurrentLevel(actionsCount)
        const isExpanded = expandedAxes.has(axe.id)

        // Tri chronologique pour les rangs, antichrono pour l'affichage
        const chronoSorted = [...axe.actions].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
        const rankMap = new Map(chronoSorted.map((a, i) => [a.id, i + 1]))
        const displaySorted = [...axe.actions].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )

        const visibleActions = isExpanded
          ? displaySorted
          : displaySorted.slice(0, MAX_VISIBLE_ACTIONS)
        const hiddenCount = displaySorted.length - MAX_VISIBLE_ACTIONS

        const cardGradient = levelIdx === 0
          ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
          : levelIdx === 1
          ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)'
          : levelIdx === 2
          ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
          : levelIdx === 3
          ? 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)'
          : 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'

        return (
          <div
            key={axe.id}
            className="rounded-2xl border-2 p-4"
            style={{ background: cardGradient }}
          >
            {/* Titre */}
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold shrink-0">
                {axe.index + 1}
              </span>
              <p className="font-bold text-sm leading-snug line-clamp-1 flex-1">{axe.subject}</p>
            </div>

            {/* Moyens / description */}
            <div className="h-[32px] mt-1">
              {axe.description ? (
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{axe.description}</p>
              ) : (
                <p className="text-xs text-gray-500 italic">—</p>
              )}
            </div>

            {/* Niveau actuel - hero */}
            <div className="flex items-center justify-center h-[40px] gap-2">
              <span className="text-3xl drop-shadow-sm">{level.icon}</span>
              <span className="text-sm font-bold text-gray-700">{level.label}</span>
            </div>

            {/* Piste de progression avec jalons */}
            <div className="relative h-[20px] mx-1">
              <div className="absolute top-[6px] inset-x-0 h-2 bg-white/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: levelIdx === 0
                      ? '#94a3b8'
                      : levelIdx === 1
                      ? '#38bdf8'
                      : levelIdx === 2
                      ? '#34d399'
                      : levelIdx === 3
                      ? '#fb923c'
                      : '#f472b6',
                  }}
                />
              </div>
              <div className="flex justify-between absolute inset-x-0 top-0">
                {MARKERS.map((m, i) => {
                  const reached = i <= levelIdx
                  const isCurrent = i === levelIdx
                  return (
                    <div
                      key={i}
                      className={`flex items-center justify-center rounded-full transition-all ${
                        isCurrent
                          ? 'w-5 h-5 bg-white shadow-md ring-2 ring-current/40 text-sm z-10'
                          : reached
                          ? 'w-4 h-4 mt-0.5 bg-white/90 shadow-sm text-[11px]'
                          : 'w-4 h-4 mt-0.5 bg-white/40 text-[11px]'
                      }`}
                    >
                      <span className={reached ? '' : 'opacity-30 grayscale text-[10px]'}>{m.icon}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Compteur actions + delta */}
            <div className="h-[20px] flex items-center justify-center mt-1">
              <p className="text-center text-xs font-semibold text-gray-600">
                {actionsCount} action{actionsCount !== 1 ? 's' : ''}
                {actionsCount < 9 && (
                  <span className="font-normal text-gray-500"> · encore {9 - actionsCount} pour 🚀</span>
                )}
              </p>
            </div>

            {/* Séparateur + Actions menées */}
            <div className="border-t border-current/10 pt-3 mt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Actions menées
                {actionsCount > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-gray-500">
                    ({actionsCount})
                  </span>
                )}
              </p>

              {actionsCount === 0 ? (
                <p className="text-xs text-gray-500 italic">Aucune action enregistrée</p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {visibleActions.map((action) => {
                      const rank = rankMap.get(action.id) ?? 1
                      return (
                        <li key={action.id} className="flex items-start gap-2">
                          <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm bg-white/60">
                            {getActionPhaseIcon(rank)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700">
                              {action.description}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-500">
                                {formatDate(action.created_at)}
                              </span>
                              <ActionFeedback
                                actionId={action.id}
                                feedback={feedbackMap[action.id] ?? emptyFeedback}
                                canInteract={true}
                              />
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>

                  {/* Bouton Voir plus / Voir moins */}
                  {hiddenCount > 0 && (
                    <button
                      onClick={() => toggleExpand(axe.id)}
                      className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors mt-2 mx-auto"
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                      {isExpanded ? 'Voir moins' : `Voir ${hiddenCount} de plus`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
