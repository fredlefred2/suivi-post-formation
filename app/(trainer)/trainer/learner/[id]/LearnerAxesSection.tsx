'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ActionFeedbackData } from '@/lib/types'
import ActionItem from '@/app/components/ui/ActionItem'
import LevelAvatar from '@/app/components/ui/LevelAvatar'
import Chip from '@/app/components/ui/Chip'
import {
  getDynamique,
  getCurrentLevelIndex,
  getProgress,
  getNextLevel,
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

// Couleurs des barres de progression par niveau (aligné sur design system v1.30)
const LEVEL_BAR_COLORS = ['#a0937c', '#38bdf8', '#10b981', '#f59e0b', '#fb7185']
const LEVEL_CHIP_VARIANTS = ['muted', 'sky', 'emerald', 'amber', 'coral'] as const

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
    <div className="space-y-3">
      <h2 className="section-title">🎯 Axes de progrès</h2>

      {axes.map((axe) => {
        const actionsCount = axe.actions.length
        const dyn = getDynamique(actionsCount)
        const progress = getProgress(actionsCount)
        const levelIdx = getCurrentLevelIndex(actionsCount)
        const next = getNextLevel(actionsCount)
        const isExpanded = expandedAxes.has(axe.id)

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
            className="rounded-[20px] bg-white p-4"
            style={{
              border: '2px solid #f0ebe0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.05)',
            }}
          >
            {/* Header axe : avatar niveau + titre + chip niveau */}
            <div className="flex items-start gap-3">
              <LevelAvatar actionCount={actionsCount} size={44} />
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-[14px] leading-snug" style={{ color: '#1a1a2e' }}>
                  {axe.subject}
                </p>
                {axe.description && (
                  <p className="text-[11.5px] mt-0.5 line-clamp-2" style={{ color: '#5f5b55' }}>
                    {axe.description}
                  </p>
                )}
              </div>
              <Chip variant={LEVEL_CHIP_VARIANTS[levelIdx] ?? 'muted'} size="sm">
                {dyn.icon} {dyn.label}
              </Chip>
            </div>

            {/* Barre de progression */}
            <div className="mt-3">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f4efe3' }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${progress}%`,
                    background: LEVEL_BAR_COLORS[levelIdx] ?? LEVEL_BAR_COLORS[0],
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5 text-[11px]">
                <span style={{ color: '#a0937c' }}>
                  {actionsCount} action{actionsCount !== 1 ? 's' : ''}
                </span>
                {next ? (
                  <span className="font-bold" style={{ color: '#92400e' }}>
                    +{next.delta} pour {next.icon} {next.label}
                  </span>
                ) : (
                  <span className="font-extrabold" style={{ color: '#9f1239' }}>
                    👑 niveau max atteint
                  </span>
                )}
              </div>
            </div>

            {/* Actions menées */}
            <div className="pt-3 mt-3" style={{ borderTop: '1px solid #f0ebe0' }}>
              <p className="text-[11px] font-extrabold tracking-wider uppercase mb-1" style={{ color: '#a0937c' }}>
                Actions menées · {actionsCount}
              </p>

              {actionsCount === 0 ? (
                <p className="text-xs italic mt-2" style={{ color: '#a0937c' }}>Aucune action enregistrée</p>
              ) : (
                <>
                  <div>
                    {visibleActions.map((action) => (
                      <ActionItem
                        key={action.id}
                        action={{
                          id: action.id,
                          description: action.description,
                          created_at: action.created_at,
                          axe_subject: axe.subject,
                          axe_action_count: actionsCount,
                        }}
                        feedback={feedbackMap[action.id]}
                        showAuthor={false}
                        showAxe={false}
                        lineClamp={3}
                        avatarSize={32}
                      />
                    ))}
                  </div>

                  {hiddenCount > 0 && (
                    <button
                      onClick={() => toggleExpand(axe.id)}
                      className="flex items-center gap-1 text-[12px] font-bold mt-2 mx-auto transition-colors hover:underline"
                      style={{ color: '#92400e' }}
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
