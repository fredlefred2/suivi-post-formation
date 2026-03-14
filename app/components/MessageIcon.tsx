'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

const POLL_INTERVAL = 60_000

export default function MessageIcon({ variant }: { variant: 'learner' | 'trainer' }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const router = useRouter()

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
    router.push(variant === 'trainer' ? '/trainer/messages' : '/messages')
  }

  return (
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
  )
}
