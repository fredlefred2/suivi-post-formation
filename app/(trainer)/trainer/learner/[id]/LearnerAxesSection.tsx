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

        const LEVEL_BORDER_COLORS = ['#94a3b8', '#38bdf8', '#10b981', '#f59e0b', '#fb7185']
        const LEVEL_BAR_COLORS = ['#94a3b8', '#38bdf8', '#34d399', '#fb923c', '#f472b6']
        const borderColor = LEVEL_BORDER_COLORS[levelIdx] ?? LEVEL_BORDER_COLORS[0]

        return (
          <div
            key={axe.id}
            className="rounded-[22px] bg-white p-4"
            style={{ border: `2px solid ${borderColor}` }}
          >
            {/* Titre */}
            <div className="flex items-center gap-2">
              <span className="axe-num shrink-0" style={{ background: borderColor, color: '#fff' }}>
                {axe.index + 1}
              </span>
              <p className="font-bold text-sm leading-snug line-clamp-1 flex-1" style={{ color: '#1a1a2e' }}>{axe.subject}</p>
            </div>

            {/* Description */}
            {axe.description && (
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-1 ml-8">{axe.description}</p>
            )}

            {/* Barre de progression simplifiée */}
            <div className="mt-3 flex items-center gap-2.5">
              <span className="text-lg">{level.icon}</span>
              <div className="flex-1">
                <div className="bar-bg">
                  <div
                    className="bar-fill transition-all duration-700"
                    style={{
                      width: `${progress}%`,
                      background: LEVEL_BAR_COLORS[levelIdx] ?? LEVEL_BAR_COLORS[0],
                    }}
                  />
                </div>
              </div>
              <span className={`text-lg ${levelIdx >= 4 ? '' : 'opacity-30'}`}>🚀</span>
            </div>

            {/* Niveau + compteur sur 1 ligne */}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-[11px] font-bold" style={{ color: '#1a1a2e' }}>{dyn.icon} {dyn.label}</span>
              <span className="text-[11px]" style={{ color: '#a0937c' }}>
                {actionsCount} action{actionsCount !== 1 ? 's' : ''}
                {actionsCount === 0 && (
                  <span className="font-semibold ml-1" style={{ color: '#92400e' }}>· commence !</span>
                )}
                {actionsCount > 0 && actionsCount < 9 && (
                  <span className="font-semibold ml-1" style={{ color: '#92400e' }}>· encore {dyn.delta} pour {MARKERS[levelIdx + 1]?.icon}</span>
                )}
              </span>
            </div>

            {/* Séparateur + Actions menées */}
            <div className="pt-3 mt-2" style={{ borderTop: '2px solid #f0ebe0' }}>
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
                          <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm" style={{ background: '#f5f0e8' }}>
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
