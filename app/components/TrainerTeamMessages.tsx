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
    <div className="rounded-2xl bg-white/80 backdrop-blur-sm px-3.5 py-3" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)' }}>
      {/* Ligne compacte : icône + input + send */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => messages.length > 0 && setShowAll(true)}
          className="relative shrink-0 w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 hover:bg-indigo-100 transition-colors"
          title={lastMessage ? `Dernier message : ${timeAgo(lastMessage.createdAt)}` : 'Messages à la team'}
        >
          <MessageSquare size={16} />
          {messages.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-indigo-500 text-white text-[9px] font-bold flex items-center justify-center">
              {messages.length}
            </span>
          )}
        </button>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message à la team…"
          maxLength={500}
          className="flex-1 min-w-0 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent bg-white"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="shrink-0 p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-90"
        >
          <Send size={16} />
        </button>
      </div>
      {/* Hint dernier message */}
      {!loading && lastMessage && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-1.5 text-[10px] text-gray-400 hover:text-indigo-500 transition-colors truncate block w-full text-left pl-11"
        >
          Dernier : &ldquo;{lastMessage.content.slice(0, 50)}{lastMessage.content.length > 50 ? '…' : ''}&rdquo; · {timeAgo(lastMessage.createdAt)}
        </button>
      )}

      {/* Modal: all messages */}
      {showAll && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowAll(false)} />
          <div className="relative bg-white w-full sm:max-w-lg max-h-[85vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col pb-[max(0px,env(safe-area-inset-bottom))]">
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
