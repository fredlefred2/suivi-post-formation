'use client'

import { useState, useEffect } from 'react'
import { MessageCircle } from 'lucide-react'

type Conversation = {
  userId: string
  firstName: string
  lastName: string
  lastMessage: string
  lastMessageAt: string
  lastMessageByMe: boolean
  unreadCount: number
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'À l\'instant'
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  if (days < 7) return `${days}j`
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function getInitials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
}

export default function ConversationList({
  onSelect,
  selectedUserId,
}: {
  onSelect: (userId: string, name: string) => void
  selectedUserId?: string
}) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConversations()
  }, [])

  async function fetchConversations() {
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) return
      const { conversations: convs } = await res.json()
      setConversations(convs ?? [])
    } catch {
      // Silencieux
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-24" />
              <div className="h-2.5 bg-gray-100 rounded w-40" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12 px-4">
        <MessageCircle size={40} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">Aucune conversation</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {conversations.map((conv) => (
        <button
          key={conv.userId}
          onClick={() => onSelect(conv.userId, `${conv.firstName} ${conv.lastName}`)}
          className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
            selectedUserId === conv.userId ? 'bg-indigo-50' : ''
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
            {getInitials(conv.firstName, conv.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                {conv.firstName} {conv.lastName}
              </p>
              <span className="text-[10px] text-gray-500 flex-shrink-0 ml-2">
                {timeAgo(conv.lastMessageAt)}
              </span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-500'}`}>
                {conv.lastMessageByMe ? 'Vous : ' : ''}{conv.lastMessage}
              </p>
              {conv.unreadCount > 0 && (
                <span className="ml-2 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-indigo-500 rounded-full px-1 flex-shrink-0">
                  {conv.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  )
}
