'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Send, ArrowLeft, Plus, Search, MessageCircle } from 'lucide-react'

type Learner = { id: string; name: string }

type Message = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  is_read: boolean
  created_at: string
}

type Conversation = {
  userId: string
  firstName: string
  lastName: string
  lastMessage: string
  lastMessageAt: string
  lastMessageByMe: boolean
  unreadCount: number
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

type Props = {
  currentUserId: string
  initialContact: { userId: string; name: string } | null
  allLearners: Learner[]
}

export default function TrainerMessagesClient({ currentUserId, initialContact, allLearners }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<{ userId: string; name: string } | null>(initialContact)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [search, setSearch] = useState('')

  // Conversation list state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Fetch conversations
  useEffect(() => {
    fetchConversations()
  }, [])

  async function fetchConversations() {
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) return
      const { conversations: convs } = await res.json()
      setConversations(convs ?? [])
    } catch { /* silencieux */ } finally { setLoadingConvs(false) }
  }

  // Fetch messages when selected changes
  useEffect(() => {
    if (!selected) return
    setLoadingChat(true)
    fetchMessages()
    markAsRead()
    const interval = setInterval(fetchMessages, 10_000)
    return () => clearInterval(interval)
  }, [selected?.userId])

  async function fetchMessages() {
    if (!selected) return
    try {
      const res = await fetch(`/api/messages?with=${selected.userId}`)
      if (!res.ok) return
      const { messages: msgs } = await res.json()
      setMessages(msgs ?? [])
    } catch { /* silencieux */ } finally { setLoadingChat(false) }
  }

  async function markAsRead() {
    if (!selected) return
    try {
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: selected.userId }),
      })
      window.dispatchEvent(new Event('messages-read'))
    } catch { /* silencieux */ }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  async function handleSend() {
    if (!selected) return
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')
    const optimistic: Message = {
      id: `temp-${Date.now()}`, sender_id: currentUserId, receiver_id: selected.userId,
      content: text, is_read: false, created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: selected.userId, content: text }),
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

  function handleSelect(userId: string, name: string) {
    setSelected({ userId, name })
    setShowNewMessage(false)
    setMessages([])
  }

  function handleBack() {
    setSelected(null)
    setInput('')
    fetchConversations() // Refresh conversation list
  }

  const filteredLearners = search.trim()
    ? allLearners.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : allLearners

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Header fixe */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        {selected ? (
          <>
            <button
              onClick={handleBack}
              className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Retour"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
              {selected.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
            <p className="font-semibold text-sm text-gray-800 flex-1">{selected.name}</p>
          </>
        ) : (
          <>
            <MessageCircle size={20} className="text-gray-600" />
            <p className="font-semibold text-sm text-gray-800 flex-1">Conversations</p>
            {!showNewMessage && (
              <button
                onClick={() => setShowNewMessage(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors"
              >
                <Plus size={14} />
                Nouveau
              </button>
            )}
          </>
        )}
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-gray-800 text-white hover:bg-gray-900 transition-colors"
          aria-label="Fermer"
        >
          <X size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Contenu */}
      {selected ? (
        <>
          {/* Zone messages scrollable */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2 bg-gray-50">
            {loadingChat ? (
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

          {/* Input fixe en bas */}
          <div className="px-4 py-3 border-t border-gray-200 bg-white shrink-0">
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
        </>
      ) : showNewMessage ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 shrink-0">
            <button onClick={() => setShowNewMessage(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={18} />
            </button>
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un apprenant…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
            {filteredLearners.map((learner) => (
              <button
                key={learner.id}
                onClick={() => handleSelect(learner.id, learner.name)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {learner.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <p className="text-sm font-medium text-gray-700">{learner.name}</p>
              </button>
            ))}
            {filteredLearners.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-gray-400">Aucun résultat</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
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
          ) : conversations.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageCircle size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">Aucune conversation</p>
              <button
                onClick={() => setShowNewMessage(true)}
                className="mt-4 btn-primary text-sm"
              >
                Démarrer une conversation
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map((conv) => (
                <button
                  key={conv.userId}
                  onClick={() => handleSelect(conv.userId, `${conv.firstName} ${conv.lastName}`)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {`${conv.firstName.charAt(0)}${conv.lastName.charAt(0)}`.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {conv.firstName} {conv.lastName}
                      </p>
                      <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                        {timeAgo(conv.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-xs truncate ${conv.unreadCount > 0 ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
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
          )}
        </div>
      )}
    </div>
  )
}
