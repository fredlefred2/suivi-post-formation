'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send } from 'lucide-react'

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

type Props = {
  currentUserId: string
  trainerId: string
  trainerName: string
  onClose?: () => void
}

export default function MessagesClient({ currentUserId, trainerId, trainerName, onClose }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  // ── Adapter la taille au clavier virtuel iOS/Android ──
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function updateSize() {
      const container = containerRef.current
      if (!container) return
      const vv = window.visualViewport
      if (vv) {
        container.style.height = `${vv.height}px`
        container.style.top = `${vv.offsetTop}px`
      } else {
        container.style.height = '100vh'
        container.style.top = '0px'
      }
      // Scroll to bottom après resize (clavier ouvert/fermé)
      scrollToBottom()
    }

    updateSize()
    window.visualViewport?.addEventListener('resize', updateSize)
    window.visualViewport?.addEventListener('scroll', updateSize)

    return () => {
      document.body.style.overflow = original
      window.visualViewport?.removeEventListener('resize', updateSize)
      window.visualViewport?.removeEventListener('scroll', updateSize)
    }
  }, [scrollToBottom])

  useEffect(() => {
    fetchMessages()
    markAsRead()
    const interval = setInterval(fetchMessages, 10_000)
    return () => clearInterval(interval)
  }, [])

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/messages?with=${trainerId}`)
      if (!res.ok) return
      const { messages: msgs } = await res.json()
      setMessages(msgs ?? [])
    } catch { /* silencieux */ } finally { setLoading(false) }
  }

  async function markAsRead() {
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: trainerId }),
      })
      window.dispatchEvent(new Event('messages-read'))
    } catch { /* silencieux */ }
  }

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  async function handleSend() {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    const optimistic: Message = {
      id: `temp-${Date.now()}`, sender_id: currentUserId, receiver_id: trainerId,
      content: text, is_read: false, created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: trainerId, content: text }),
      })
      if (res.ok) {
        const { message } = await res.json()
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? message : m)))
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setInput(text)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-white flex flex-col overflow-hidden"
      style={{ top: 0, height: '100vh' }}
    >
      {/* ── Header ── TOUJOURS visible */}
      <div className="flex-none flex items-center gap-3 px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold shrink-0">
          {trainerName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
        </div>
        <p className="font-semibold text-sm text-gray-800 flex-1 truncate">{trainerName}</p>
        <button
          onClick={() => onClose ? onClose() : router.back()}
          className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-900 transition-colors shrink-0"
          aria-label="Fermer"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* ── Messages ── SEULE zone qui scrolle */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2 bg-gray-50"
        style={{ overscrollBehavior: 'contain' }}
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
            <p className="text-sm text-gray-400">Démarre la conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === currentUserId
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                  isMine
                    ? 'bg-indigo-500 text-white rounded-br-md'
                    : 'bg-white text-gray-800 border border-gray-200 rounded-bl-md'
                }`}>
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

      {/* ── Input ── TOUJOURS visible en bas */}
      <div className="flex-none px-4 py-2.5 border-t border-gray-200 bg-white">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ton message…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent max-h-24"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="p-2.5 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-90 shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}
