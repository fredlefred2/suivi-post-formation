'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Heart, MessageCircle, Send, X } from 'lucide-react'
import { toggleLike, createComment } from '@/app/actions/feedback'
import type { ActionFeedbackData } from '@/lib/types'

type Props = {
  actionId: string
  feedback: ActionFeedbackData
  canInteract: boolean // true = formateur, false = apprenant (lecture seule)
}

function FeedbackModal({ open, onClose, children }: { open: boolean, onClose: () => void, children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        ref={ref}
        className="relative bg-white w-full sm:w-auto sm:min-w-[280px] sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-xl pb-[max(0px,env(safe-area-inset-bottom))]"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>
        <div className="p-5">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ActionFeedback({ actionId, feedback, canInteract }: Props) {
  const [showLikers, setShowLikers] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')

  // Optimistic state — mise à jour visuelle INSTANTANÉE
  const [optimisticLiked, setOptimisticLiked] = useState(feedback.liked_by_me)
  const [optimisticLikesCount, setOptimisticLikesCount] = useState(feedback.likes_count)
  const [optimisticCommentsCount, setOptimisticCommentsCount] = useState(feedback.comments_count)
  const [likePop, setLikePop] = useState(false)
  const [commentPop, setCommentPop] = useState(false)

  // Sync avec les données serveur quand les props changent
  useEffect(() => {
    setOptimisticLiked(feedback.liked_by_me)
    setOptimisticLikesCount(feedback.likes_count)
    setOptimisticCommentsCount(feedback.comments_count)
  }, [feedback.liked_by_me, feedback.likes_count, feedback.comments_count])

  const triggerPop = useCallback((setter: (v: boolean) => void) => {
    setter(true)
    setTimeout(() => setter(false), 350)
  }, [])

  function handleToggleLike() {
    if (!canInteract) return

    // Optimistic update IMMÉDIAT — pas de useTransition
    const wasLiked = optimisticLiked
    setOptimisticLiked(!wasLiked)
    setOptimisticLikesCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1)
    triggerPop(setLikePop)

    // Fire and forget
    toggleLike(actionId).catch(() => {
      // Rollback en cas d'erreur
      setOptimisticLiked(wasLiked)
      setOptimisticLikesCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1))
    })
  }

  function handleSubmitComment() {
    if (!canInteract || !commentText.trim()) return
    const text = commentText

    // Optimistic update IMMÉDIAT
    setOptimisticCommentsCount(prev => prev + 1)
    triggerPop(setCommentPop)
    setShowComments(false)
    setCommentText('')

    // Fire and forget
    createComment(actionId, text).catch(() => {
      setOptimisticCommentsCount(prev => Math.max(0, prev - 1))
    })
  }

  const hasLikes = optimisticLikesCount > 0
  const hasComments = optimisticCommentsCount > 0

  return (
    <div className="flex items-center gap-3" onClick={(e) => { e.stopPropagation(); e.preventDefault() }}>
      {/* ── Coeur / Like ── */}
      <button
        onClick={() => {
          if (canInteract) {
            handleToggleLike()
          } else if (hasLikes) {
            setShowLikers(!showLikers)
          }
        }}
        className={`flex items-center gap-1.5 transition-colors duration-150 ${
          optimisticLiked || hasLikes
            ? 'text-pink-500'
            : canInteract
              ? 'text-pink-200 hover:text-pink-400'
              : 'text-pink-200'
        }`}
        title={canInteract ? (optimisticLiked ? 'Retirer le like' : 'Liker') : 'Voir qui a aimé'}
      >
        <Heart
          size={18}
          className={likePop ? 'feedback-pop' : ''}
          fill="currentColor"
          strokeWidth={0}
        />
        {hasLikes && <span className="text-sm font-medium">{optimisticLikesCount}</span>}
      </button>

      {/* Modale likers */}
      <FeedbackModal open={showLikers} onClose={() => setShowLikers(false)}>
        <p className="text-sm font-semibold text-gray-700 mb-3">❤️ Aimé par</p>
        {feedback.likers.length === 0 ? (
          <p className="text-sm text-gray-500 italic">Personne encore</p>
        ) : (
          <ul className="space-y-1.5">
            {feedback.likers.map((l, i) => (
              <li key={i} className="text-sm text-gray-600">
                {l.first_name} {l.last_name}
              </li>
            ))}
          </ul>
        )}
      </FeedbackModal>

      {/* ── Bulle / Commentaires ── */}
      <button
        onClick={() => {
          if (canInteract || hasComments) {
            setShowComments(!showComments)
          }
        }}
        className={`flex items-center gap-1.5 transition-colors duration-150 ${
          hasComments
            ? 'text-[#1a1a2e]'
            : canInteract
              ? 'text-[#c4b99a] hover:text-[#a0937c]'
              : 'text-[#c4b99a]'
        }`}
        title={canInteract ? 'Commenter' : 'Voir les commentaires'}
      >
        <MessageCircle
          size={18}
          className={commentPop ? 'feedback-pop' : ''}
          fill="currentColor"
          strokeWidth={0}
        />
        {hasComments && <span className="text-sm font-medium">{optimisticCommentsCount}</span>}
      </button>

      {/* Modale commentaires */}
      <FeedbackModal open={showComments} onClose={() => setShowComments(false)}>
        <p className="text-sm font-semibold text-gray-700 mb-3">💬 Commentaires</p>

        {feedback.comments.length === 0 && !canInteract && (
          <p className="text-sm text-gray-500 italic">Aucun commentaire</p>
        )}

        {feedback.comments.length > 0 && (
          <ul className="space-y-3 mb-3 max-h-48 overflow-y-auto">
            {feedback.comments.map((c) => (
              <li key={c.id}>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-gray-700">
                    {c.trainer_first_name} {c.trainer_last_name}
                  </span>
                  <span className="text-gray-300">·</span>
                  <span className="text-xs text-gray-500">
                    {new Date(c.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5 leading-relaxed">{c.content}</p>
              </li>
            ))}
          </ul>
        )}

        {canInteract && (
          <div className="border-t border-gray-100 pt-3 mt-1 space-y-3">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmitComment()
                }
              }}
              placeholder="Votre commentaire..."
              className="w-full text-sm px-3 py-2.5 border border-gray-200 rounded-lg h-20 resize-none
                         focus:outline-none focus:border-[#fbbf24] focus:ring-1 focus:ring-[#fbbf24]/20
                         transition-all"
              maxLength={500}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setCommentText(''); setShowComments(false) }}
                className="btn-secondary px-4 py-2 text-sm"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                className="btn-primary px-4 py-2 text-sm flex items-center gap-1.5 disabled:opacity-40"
              >
                <Send size={15} />
                Envoyer
              </button>
            </div>
          </div>
        )}
      </FeedbackModal>
    </div>
  )
}
