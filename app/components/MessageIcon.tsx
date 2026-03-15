'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import dynamic from 'next/dynamic'

// Lazy load les composants de conversation (pas chargés tant qu'on ne clique pas)
const MessagesClient = dynamic(() => import('@/app/(learner)/messages/MessagesClient'), { ssr: false })
const TrainerMessagesClient = dynamic(() => import('@/app/(trainer)/trainer/messages/TrainerMessagesClient'), { ssr: false })

const POLL_INTERVAL = 60_000

type LearnerProps = {
  variant: 'learner'
  currentUserId: string
  trainerId: string
  trainerName: string
  allLearners?: never
}

type TrainerProps = {
  variant: 'trainer'
  currentUserId: string
  trainerId?: never
  trainerName?: never
  allLearners: { id: string; name: string }[]
}

type Props = LearnerProps | TrainerProps

export default function MessageIcon(props: Props) {
  const { variant, currentUserId } = props
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/unread')
      if (!res.ok) return
      const { count } = await res.json()
      setUnreadCount(count ?? 0)
    } catch {
      // Silencieux
    }
  }, [])

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, POLL_INTERVAL)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnread()
    }
    const handleMessagesRead = () => fetchUnread()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('messages-read', handleMessagesRead)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('messages-read', handleMessagesRead)
    }
  }, [fetchUnread])

  const handleClick = () => {
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    // Rafraîchir le badge après fermeture
    fetchUnread()
  }

  return (
    <>
      <button
        onClick={handleClick}
        className="relative text-indigo-200 hover:text-white transition-all p-2 hover:bg-white/15 rounded-lg active:scale-90"
        aria-label="Messages"
      >
        <MessageCircle size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && variant === 'learner' && (
        <MessagesClient
          currentUserId={currentUserId}
          trainerId={props.trainerId}
          trainerName={props.trainerName}
          onClose={handleClose}
        />
      )}

      {open && variant === 'trainer' && (
        <TrainerMessagesClient
          currentUserId={currentUserId}
          initialContact={null}
          allLearners={props.allLearners}
          onClose={handleClose}
        />
      )}
    </>
  )
}
