'use client'

import { useState, useEffect } from 'react'
import { Send, MessageSquare, X } from 'lucide-react'

type TeamMessage = {
  id: string
  senderId: string
  senderFirstName: string
  senderLastName: string
  content: string
  createdAt: string
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

export default function TrainerTeamMessages({
  groupId,
  currentUserId,
}: {
  groupId: string
  currentUserId: string
}) {
  const [messages, setMessages] = useState<TeamMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMessages()
  }, [groupId])

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/team-messages?groupId=${groupId}&all=true`)
      if (!res.ok) return
      const { messages: msgs } = await res.json()
      // Filter to only trainer messages
      setMessages((msgs ?? []).filter((m: TeamMessage) => m.senderId === currentUserId))
    } catch {
      // Silent
    } finally {
      setLoading(false)
    }
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    const optimistic: TeamMessage = {
      id: `temp-${Date.now()}`,
      senderId: currentUserId,
      senderFirstName: 'Vous',
      senderLastName: '',
      content: text,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/team-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId, content: text }),
      })
      if (res.ok) {
        await fetchMessages()
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(text)
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="section-title">
          <MessageSquare size={16} className="inline mr-1.5 -mt-0.5" />
          Message à la team
        </h2>
        {messages.length > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
          >
            Voir tout ({messages.length})
          </button>
        )}
      </div>

      {/* Last message preview */}
      {loading ? (
        <div className="h-12 rounded-xl bg-gray-100 animate-pulse mb-3" />
      ) : lastMessage ? (
        <div className="bg-gray-50 rounded-xl px-3.5 py-2.5 mb-3">
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-[10px] text-gray-500 font-medium">Dernier message</span>
            <span className="text-[10px] text-gray-500">{timeAgo(lastMessage.createdAt)}</span>
          </div>
          <p className="text-sm text-gray-600 line-clamp-2">{lastMessage.content}</p>
        </div>
      ) : (
        <div className="text-center py-4 mb-3">
          <MessageSquare size={28} className="mx-auto text-gray-300 mb-1.5" />
          <p className="text-sm text-gray-500">Aucun message envoyé</p>
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire à la team…"
          rows={1}
          maxLength={500}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent max-h-20"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="p-2.5 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-90"
        >
          <Send size={16} />
        </button>
      </div>

      {/* Modal: all messages */}
      {showAll && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAll(false)} />
          <div className="relative bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">Messages à la team</h3>
              <button
                onClick={() => setShowAll(false)}
                className="text-gray-500 hover:text-gray-600 transition-colors p-1"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="bg-gray-50 rounded-xl px-4 py-3">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-[10px] text-gray-500 font-medium">
                      {timeAgo(msg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
