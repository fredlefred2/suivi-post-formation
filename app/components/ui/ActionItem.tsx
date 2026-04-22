'use client'

import type { ActionFeedbackData } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'
import LevelAvatar from './LevelAvatar'

type Props = {
  action: {
    id: string
    description: string
    created_at: string
    axe_subject: string
    axe_action_count: number
    learner_first_name?: string
    learner_last_name?: string
  }
  feedback?: ActionFeedbackData
  /** Montrer le nom de l'auteur (team / dashboard formateur) ou pas (fiche axe individuel) */
  showAuthor?: boolean
  /** Montrer le nom de l'axe (contexte multi-axe) */
  showAxe?: boolean
  /** Nombre de lignes max pour la description (default 3) */
  lineClamp?: number
  /** Taille de l'avatar (default 36) */
  avatarSize?: number
}

function formatAge(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'à l\'instant'
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.round(hours / 24)
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} j`
  // >= 7j : date courte
  const d = new Date(iso)
  const months = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${d.getDate()} ${months[d.getMonth()]}`
}

/**
 * ActionItem — composant unifié pour afficher UNE action de progrès.
 * Utilisé partout : dashboard apprenant, team, feed, fiche apprenant formateur.
 * Format stable : [avatar niveau] [meta auteur/axe/date] [description] [feedback interactif]
 */
export default function ActionItem({
  action,
  feedback,
  showAuthor = true,
  showAxe = true,
  lineClamp = 3,
  avatarSize = 36,
}: Props) {
  return (
    <div className="flex gap-2.5 py-2.5" style={{ borderBottom: '1px solid #f4efe3' }}>
      <LevelAvatar actionCount={action.axe_action_count} size={avatarSize} />

      <div className="flex-1 min-w-0">
        {/* Meta : auteur · axe · date */}
        <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
          {showAuthor && action.learner_first_name && (
            <>
              <span style={{ color: '#1a1a2e' }}>{action.learner_first_name}</span>
              {showAxe && <span style={{ color: '#a0937c' }}>·</span>}
            </>
          )}
          {showAxe && (
            <span className="truncate" style={{ color: '#92400e' }}>{action.axe_subject}</span>
          )}
          <span className="ml-auto shrink-0 font-semibold" style={{ color: '#a0937c', fontSize: 10 }}>
            {formatAge(action.created_at)}
          </span>
        </div>

        {/* Description */}
        <p
          className="text-[12.5px] mt-0.5"
          style={{
            color: '#1a1a2e',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: lineClamp,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {action.description}
        </p>

        {/* Feedback — TOUJOURS interactif (apprenant + formateur) */}
        {feedback && (
          <div className="mt-1">
            <ActionFeedback
              actionId={action.id}
              feedback={feedback}
              canInteract={true}
            />
          </div>
        )}
      </div>
    </div>
  )
}
