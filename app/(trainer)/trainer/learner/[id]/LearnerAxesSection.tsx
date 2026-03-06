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

        return (
          <div
            key={axe.id}
            className={`rounded-2xl border-2 p-4 ${dyn.color}`}
          >
            {/* Ligne 1 : numéro + titre */}
            <div className="flex items-start gap-3">
              <span className="w-9 h-9 rounded-full bg-white/60 border border-current/20 flex items-center justify-center text-base font-bold shrink-0 mt-0.5">
                {axe.index + 1}
              </span>
              <p className="font-bold text-base leading-snug line-clamp-2 flex-1">
                {axe.subject}
              </p>
            </div>

            {/* Ligne 2 : actions + niveau */}
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm font-semibold">
                {actionsCount} action{actionsCount !== 1 ? 's' : ''}
              </span>
              <span className="opacity-30">·</span>
              <span className="text-lg leading-none">{level.icon}</span>
              <span className="text-sm font-medium opacity-80">
                Niveau {level.label}
              </span>
            </div>

            {/* Barre de progression */}
            <div className="mt-3 relative">
              <div className="h-3 bg-white/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-current opacity-60 transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="relative h-5 mt-0.5">
                {MARKERS.map((m, i) => (
                  <span
                    key={i}
                    className={`absolute -translate-x-1/2 text-sm ${i <= levelIdx ? 'opacity-100' : 'opacity-25'}`}
                    style={{ left: `${m.pos * 100}%` }}
                  >
                    {m.icon}
                  </span>
                ))}
              </div>
            </div>

            {/* Séparateur + Actions menées */}
            <div className="border-t border-current/10 pt-3 mt-2">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Actions menées
                {actionsCount > 0 && (
                  <span className="ml-1.5 text-xs font-normal text-gray-400">
                    ({actionsCount})
                  </span>
                )}
              </p>

              {actionsCount === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucune action enregistrée</p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {visibleActions.map((action) => {
                      const rank = rankMap.get(action.id) ?? 1
                      return (
                        <li key={action.id} className="flex items-start gap-2">
                          <span className="shrink-0 mt-0.5 text-base">
                            {getActionPhaseIcon(rank)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm text-gray-700">
                              {action.description}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-gray-400">
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
