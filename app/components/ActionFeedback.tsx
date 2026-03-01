'use client'

import { useState, useTransition, useCallback } from 'react'
import { Heart, MessageCircle, Send } from 'lucide-react'
import { toggleLike, createComment } from '@/app/(trainer)/trainer/feedback/actions'
import Popover from './Popover'
import type { ActionFeedbackData } from '@/lib/types'

type Props = {
  actionId: string
  feedback: ActionFeedbackData
  canInteract: boolean // true = formateur, false = apprenant (lecture seule)
}

export default function ActionFeedback({ actionId, feedback, canInteract }: Props) {
  const [showLikers, setShowLikers] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleToggleLike = useCallback(() => {
    if (!canInteract) return
    startTransition(() => toggleLike(actionId))
  }, [canInteract, actionId, startTransition])

  const handleSubmitComment = useCallback(() => {
    if (!canInteract || !commentText.trim()) return
    startTransition(async () => {
      await createComment(actionId, commentText)
      setCommentText('')
    })
  }, [canInteract, actionId, commentText, startTransition])

  const hasLikes = feedback.likes_count > 0
  const hasComments = feedback.comments_count > 0

  return (
    <div className="flex items-center gap-2.5 relative">
      {/* ── Coeur / Like ── */}
      <div className="relative">
        <button
          onClick={() => {
            if (canInteract) {
              handleToggleLike()
            } else if (hasLikes) {
              setShowLikers(!showLikers)
            }
          }}
          disabled={isPending}
          className={`flex items-center gap-1 text-xs transition-all duration-200 ${
            feedback.liked_by_me
              ? 'text-pink-500'
              : canInteract
                ? 'text-gray-300 hover:text-pink-500'
                : hasLikes
                  ? 'text-pink-400 cursor-pointer'
                  : 'text-gray-300'
          } ${isPending ? 'opacity-50' : ''}`}
          title={canInteract ? (feedback.liked_by_me ? 'Retirer le like' : 'Liker') : 'Voir qui a aimé'}
        >
          <Heart
            size={14}
            fill={feedback.liked_by_me ? 'currentColor' : 'none'}
            className={feedback.liked_by_me ? 'drop-shadow-sm' : ''}
          />
          {hasLikes && <span>{feedback.likes_count}</span>}
        </button>

        {/* Popover likers */}
        <Popover
          open={showLikers}
          onClose={() => setShowLikers(false)}
          className="bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 w-48"
        >
          <p className="text-xs font-semibold text-gray-700 mb-2">❤️ Aimé par</p>
          {feedback.likers.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Personne encore</p>
          ) : (
            <ul className="space-y-1">
              {feedback.likers.map((l, i) => (
                <li key={i} className="text-xs text-gray-600">
                  {l.first_name} {l.last_name}
                </li>
              ))}
            </ul>
          )}
        </Popover>
      </div>

      {/* ── Bulle / Commentaires ── */}
      <div className="relative">
        <button
          onClick={() => {
            if (canInteract || hasComments) {
              setShowComments(!showComments)
            }
          }}
          className={`flex items-center gap-1 text-xs transition-all duration-200 ${
            hasComments
              ? 'text-indigo-400 hover:text-indigo-600'
              : canInteract
                ? 'text-gray-300 hover:text-indigo-500'
                : 'text-gray-300'
          }`}
          title={canInteract ? 'Commenter' : 'Voir les commentaires'}
        >
          <MessageCircle size={14} />
          {hasComments && <span>{feedback.comments_count}</span>}
        </button>

        {/* Popover commentaires */}
        <Popover
          open={showComments}
          onClose={() => setShowComments(false)}
          className="bottom-full left-1/2 -translate-x-1/2 mb-2 p-3 w-72 max-h-64 overflow-y-auto"
        >
          <p className="text-xs font-semibold text-gray-700 mb-2">💬 Commentaires</p>

          {feedback.comments.length === 0 && !canInteract && (
            <p className="text-xs text-gray-400 italic">Aucun commentaire</p>
          )}

          {feedback.comments.length > 0 && (
            <ul className="space-y-2.5 mb-2">
              {feedback.comments.map((c) => (
                <li key={c.id} className="text-xs">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-semibold text-gray-700">
                      {c.trainer_first_name} {c.trainer_last_name}
                    </span>
                    <span className="text-gray-300">·</span>
                    <span className="text-gray-400">
                      {new Date(c.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-0.5 leading-relaxed">{c.content}</p>
                </li>
              ))}
            </ul>
          )}

          {canInteract && (
            <div className="flex gap-1.5 border-t border-gray-100 pt-2 mt-1">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSubmitComment()
                  }
                }}
                placeholder="Votre commentaire..."
                className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg
                           focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20
                           transition-all"
                maxLength={500}
              />
              <button
                onClick={handleSubmitComment}
                disabled={isPending || !commentText.trim()}
                className="text-indigo-500 hover:text-indigo-700 disabled:text-gray-300 p-1.5 transition-colors"
              >
                <Send size={14} />
              </button>
            </div>
          )}
        </Popover>
      </div>
    </div>
  )
}
