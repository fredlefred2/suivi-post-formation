'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Send } from 'lucide-react'

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()

  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  if (isYesterday) return `Hier ${time}`
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} ${time}`
}

export default function ChatView({
  userId,
  userName,
  currentUserId,
  onBack,
  hideBackButton = false,
}: {
  userId: string
  userName: string
  currentUserId: string
  onBack?: () => void
  hideBackButton?: boolean
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetchMessages()
    markAsRead()
    const interval = setInterval(fetchMessages, 10_000)
    return () => clearInterval(interval)
  }, [userId])

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/messages?with=${userId}`)
      if (!res.ok) return
      const { messages: msgs } = await res.json()
      setMessages(msgs ?? [])
    } catch {
      // Silencieux
    } finally {
      setLoading(false)
    }
  }

  async function markAsRead() {
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: userId }),
      })
      // Notify MessageIcon to refresh badge immediately
      window.dispatchEvent(new Event('messages-read'))
    } catch {
      // Silencieux
    }
  }

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return

    setSending(true)
    setInput('')

    // Optimistic
    const optimistic: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      receiver_id: userId,
      content: text,
      is_read: false,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: userId, content: text }),
      })
      if (res.ok) {
        const { message } = await res.json()
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? message : m)))
      }
    } catch {
      // Retirer le message optimiste en cas d'erreur
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(text)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
        {onBack && !hideBackButton && (
          <button onClick={onBack} className="text-gray-500 hover:text-gray-700 -ml-1">
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
          {userName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <p className="font-semibold text-sm text-gray-800">{userName}</p>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50"
      >
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div className="h-10 w-40 rounded-2xl bg-gray-200 animate-pulse" />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Démarrez la conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                    isMine
                      ? 'bg-indigo-500 text-white rounded-br-md'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-indigo-200' : 'text-gray-400'}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Votre message…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-90"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
