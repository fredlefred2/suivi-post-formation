'use client'

import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import type { ActionFeedbackData } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'

type ActionRow = { id: string; description: string; completed: boolean; created_at: string }

type AxeData = {
  id: string
  subject: string
  description: string | null
  difficulty: string
  actions: ActionRow[]
}

type Dynamique = { label: string; icon: string; color: string } | null

function getDynamique(count: number): Dynamique {
  if (count === 0) return null
  if (count <= 2) return { label: 'Impulsion',   icon: '👣', color: 'text-teal-700   bg-teal-50   border-teal-200'   }
  if (count <= 5) return { label: 'Rythme',      icon: '🥁', color: 'text-blue-700   bg-blue-50   border-blue-200'   }
  if (count <= 8) return { label: 'Intensité',   icon: '🔥', color: 'text-orange-700 bg-orange-50 border-orange-200' }
  return               { label: 'Propulsion',  icon: '🚀', color: 'text-purple-700 bg-purple-50 border-purple-200' }
}

function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
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

export default function LearnerAxesSection({ axes, feedbackMap }: Props) {
  return (
    <div className="space-y-4">
      <h2 className="section-title">🎯 Axes de progrès</h2>
      {axes.map((axe) => {
        const actions = [...axe.actions].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
        const dyn = getDynamique(actions.length)

        return (
          <div key={axe.id} className="card">
            {/* En-tête axe */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 text-base">{axe.subject}</h3>
                {axe.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{axe.description}</p>
                )}
                <span
                  className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mt-1.5 ${
                    DIFFICULTY_COLORS[axe.difficulty as keyof typeof DIFFICULTY_COLORS]
                  }`}
                >
                  {DIFFICULTY_LABELS[axe.difficulty as keyof typeof DIFFICULTY_LABELS]}
                </span>
              </div>
              {/* Dynamique */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold shrink-0 ${
                  dyn ? dyn.color : 'bg-gray-50 border-gray-200 text-gray-400'
                }`}
              >
                <span className="text-base leading-none">{dyn ? dyn.icon : '📍'}</span>
                <span>{dyn ? dyn.label : 'Ancrage'}</span>
              </div>
            </div>

            {/* Liste des actions */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Actions menées
                <span className="ml-1.5 text-xs font-normal text-gray-400">({actions.length})</span>
              </p>
              {actions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">Aucune action enregistrée</p>
              ) : (
                <ul className="space-y-2">
                  {actions.map((action) => (
                    <li key={action.id} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-[7px]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{action.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{shortDate(action.created_at)}</span>
                          <ActionFeedback
                            actionId={action.id}
                            feedback={feedbackMap[action.id] ?? emptyFeedback}
                            canInteract={true}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
