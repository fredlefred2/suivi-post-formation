'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Send, ArrowLeft, Search, MessageCircle, ChevronDown } from 'lucide-react'

type Learner = { id: string; name: string }
type GroupInfo = { id: string; name: string; count: number }

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

type TeamMessage = {
  id: string
  senderId: string
  senderFirstName: string
  senderLastName: string
  content: string
  createdAt: string
}

const DELETED_CONVS_KEY = 'trainer_deleted_convs'

function getDeletedConvs(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DELETED_CONVS_KEY) || '{}')
  } catch { return {} }
}

function setDeletedConv(userId: string) {
  const deleted = getDeletedConvs()
  deleted[userId] = new Date().toISOString()
  localStorage.setItem(DELETED_CONVS_KEY, JSON.stringify(deleted))
}

function clearDeletedConv(userId: string) {
  const deleted = getDeletedConvs()
  delete deleted[userId]
  localStorage.setItem(DELETED_CONVS_KEY, JSON.stringify(deleted))
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
  if (minutes < 1) return '\u00c0 l\'instant'
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
  groups?: GroupInfo[]
  onClose?: () => void
}

export default function TrainerMessagesClient({ currentUserId, initialContact, allLearners, groups = [], onClose }: Props) {
  const router = useRouter()

  // ── View state ──
  const [selected, setSelected] = useState<{ userId: string; name: string } | null>(initialContact)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [search, setSearch] = useState('')

  // ── Team messages ──
  const [teamGroupId, setTeamGroupId] = useState(
    groups.length > 0 ? (typeof window !== 'undefined' ? localStorage.getItem('trainer_selected_group') : null) || groups[0].id : ''
  )
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([])
  const [teamInput, setTeamInput] = useState('')
  const [sendingTeam, setSendingTeam] = useState(false)
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false)

  // ── Private conversations ──
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConvs, setLoadingConvs] = useState(true)

  // ── Chat view ──
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingChat, setLoadingChat] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [])

  // ── Fetch team messages ──
  useEffect(() => {
    if (!teamGroupId) return
    fetchTeamMessages()
  }, [teamGroupId])

  async function fetchTeamMessages() {
    try {
      const res = await fetch(`/api/team-messages?groupId=${teamGroupId}&all=true`)
      if (!res.ok) return
      const { messages: msgs } = await res.json()
      // Only show my messages (trainer's own)
      const mine = (msgs ?? []).filter((m: TeamMessage) => m.senderId === currentUserId)
      setTeamMessages(mine.reverse()) // newest first
    } catch { /* silencieux */ }
  }

  async function handleSendTeam() {
    const text = teamInput.trim()
    if (!text || sendingTeam || !teamGroupId) return
    setSendingTeam(true)
    setTeamInput('')
    try {
      await fetch('/api/team-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: teamGroupId, content: text }),
      })
      fetchTeamMessages()
    } catch {
      setTeamInput(text)
    } finally {
      setSendingTeam(false)
    }
  }

  // ── Fetch private conversations ──
  useEffect(() => { fetchConversations() }, [])

  async function fetchConversations() {
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) return
      const { conversations: convs } = await res.json()
      const deleted = getDeletedConvs()
      const filtered = (convs ?? []).filter((conv: Conversation) => {
        const deletedAt = deleted[conv.userId]
        if (!deletedAt) return true
        if (new Date(conv.lastMessageAt) > new Date(deletedAt)) {
          clearDeletedConv(conv.userId)
          return true
        }
        return false
      })
      setConversations(filtered)
    } catch { /* silencieux */ } finally { setLoadingConvs(false) }
  }

  // ── Chat messages ──
  useEffect(() => {
    if (!selected) return
    setLoadingChat(true)
    fetchMessages()
    markAsRead()
    const interval = setInterval(fetchMessages, 30_000)
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

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

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
    fetchConversations()
  }

  const filteredLearners = search.trim()
    ? allLearners.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : allLearners

  const selectedTeamGroup = groups.find(g => g.id === teamGroupId)

  // ══════════════════════════════════════════════════════════════
  // CHAT VIEW — conversation avec un apprenant
  // ══════════════════════════════════════════════════════════════
  if (selected) {
    return (
      <div className="fixed inset-0 z-[70] bg-white flex flex-col overflow-hidden" style={{ top: 0, height: '100dvh' }}>
        {/* Header */}
        <div className="flex-none flex items-center gap-3 px-4 py-2.5 bg-white" style={{ borderBottom: '2px solid #f0ebe0' }}>
          <button onClick={handleBack} className="p-1.5 rounded-full transition-colors" style={{ color: '#a0937c' }}>
            <ArrowLeft size={20} />
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0" style={{ background: '#1a1a2e', color: '#fbbf24' }}>
            {selected.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <p className="font-bold text-sm flex-1 truncate" style={{ color: '#1a1a2e' }}>{selected.name}</p>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2"
          style={{ background: '#faf8f4', overscrollBehavior: 'contain' }}
        >
          {loadingChat ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className="h-10 w-40 rounded-2xl animate-pulse" style={{ background: '#f0ebe0' }} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#a0937c' }}>D\u00e9marrez la conversation</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[75%] px-3.5 py-2 text-sm leading-relaxed"
                    style={{
                      borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                      background: isMine ? '#1a1a2e' : 'white',
                      color: isMine ? 'white' : '#1a1a2e',
                      border: isMine ? 'none' : '1.5px solid #f0ebe0',
                    }}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    <p className="text-[10px] mt-1" style={{ color: isMine ? 'rgba(255,255,255,0.4)' : '#a0937c' }}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Input */}
        <div className="flex-none px-4 pt-2.5 bg-white" style={{
          borderTop: '2px solid #f0ebe0',
          paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))',
        }}>
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Votre message\u2026"
              rows={1}
              className="flex-1 resize-none px-3.5 py-2.5 text-sm max-h-24 focus:outline-none"
              style={{
                border: '1.5px solid #f0ebe0',
                borderRadius: 14,
                background: '#faf8f4',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="p-2.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-90 shrink-0"
              style={{ background: '#fbbf24', color: '#1a1a2e', borderRadius: 14 }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  // NEW MESSAGE — s\u00e9lection d'un destinataire
  // ══════════════════════════════════════════════════════════════
  if (showNewMessage) {
    return (
      <div className="space-y-0">
        <div className="flex items-center gap-2 px-1 py-3" style={{ borderBottom: '1.5px solid #f0ebe0' }}>
          <button onClick={() => setShowNewMessage(false)} style={{ color: '#a0937c' }}>
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#a0937c' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un apprenant\u2026"
              className="w-full pl-8 pr-3 py-2 text-sm focus:outline-none"
              style={{ border: '1.5px solid #f0ebe0', borderRadius: 12, background: '#faf8f4' }}
              autoFocus
            />
          </div>
        </div>
        <div className="divide-y" style={{ borderColor: '#f0ebe0' }}>
          {filteredLearners.map((learner) => (
            <button
              key={learner.id}
              onClick={() => handleSelect(learner.id, learner.name)}
              className="w-full text-left px-3 py-3 flex items-center gap-3 transition-colors hover:bg-[#fffbeb]"
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold shrink-0" style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                {learner.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <p className="text-sm font-semibold" style={{ color: '#1a1a2e' }}>{learner.name}</p>
            </button>
          ))}
          {filteredLearners.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#a0937c' }}>Aucun r\u00e9sultat</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════
  // LIST VIEW — Messages team + Conversations priv\u00e9es
  // ══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5 pb-24">

      {/* ── Section Messages team ── */}
      {groups.length > 0 && (
        <section>
          <h2 className="text-sm font-bold mb-2" style={{ color: '#1a1a2e' }}>📢 Messages team</h2>

          {/* Group selector si plusieurs groupes */}
          {groups.length > 1 && (
            <div className="relative mb-2">
              <button
                onClick={() => setTeamDropdownOpen(o => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  border: '1.5px solid #f0ebe0',
                  borderRadius: 10,
                  color: '#1a1a2e',
                  background: 'white',
                }}
              >
                <span>{selectedTeamGroup?.name ?? 'Groupe'}</span>
                <ChevronDown size={12} className={`transition-transform ${teamDropdownOpen ? 'rotate-180' : ''}`} style={{ color: '#a0937c' }} />
              </button>
              {teamDropdownOpen && (
                <div className="absolute top-full mt-1 left-0 z-50 bg-white shadow-xl overflow-hidden" style={{ border: '1.5px solid #f0ebe0', borderRadius: 12, minWidth: 180 }}>
                  {groups.map(g => (
                    <button
                      key={g.id}
                      onClick={() => { setTeamGroupId(g.id); setTeamDropdownOpen(false) }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors"
                      style={{
                        background: g.id === teamGroupId ? '#fffbeb' : 'white',
                        color: '#1a1a2e',
                        fontWeight: g.id === teamGroupId ? 700 : 500,
                      }}
                    >
                      <span>{g.name}</span>
                      <span className="text-[10px]" style={{ color: '#a0937c' }}>{g.count} app.</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Compose team message */}
          <div className="flex gap-2 mb-2">
            <textarea
              value={teamInput}
              onChange={(e) => setTeamInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendTeam() } }}
              placeholder={`Message au groupe ${selectedTeamGroup?.name ?? ''}\u2026`}
              rows={2}
              className="flex-1 resize-none px-3 py-2 text-xs focus:outline-none"
              style={{
                border: '1.5px solid #f0ebe0',
                borderRadius: 12,
                background: '#faf8f4',
                minHeight: 44,
              }}
            />
            <button
              onClick={handleSendTeam}
              disabled={!teamInput.trim() || sendingTeam}
              className="self-end p-2 disabled:opacity-40 transition-all active:scale-90 shrink-0"
              style={{ background: '#1a1a2e', color: '#fbbf24', borderRadius: 12 }}
            >
              <Send size={16} />
            </button>
          </div>

          {/* Team messages — navy cards */}
          {teamMessages.length === 0 ? (
            <p className="text-xs italic px-1" style={{ color: '#a0937c' }}>Aucun message team envoy\u00e9</p>
          ) : (
            <div className="space-y-2">
              {teamMessages.slice(0, 5).map((msg) => {
                const groupForMsg = selectedTeamGroup
                return (
                  <div key={msg.id} style={{ background: '#1a1a2e', borderRadius: 18, padding: 14 }}>
                    <p className="text-[10px] font-bold mb-1.5" style={{ color: '#fbbf24' }}>Message au groupe</p>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.9)' }}>{msg.content}</p>
                    <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {new Date(msg.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {groupForMsg ? ` \u00b7 Envoy\u00e9 \u00e0 ${groupForMsg.count} participants` : ''}
                    </p>
                  </div>
                )
              })}
              {teamMessages.length > 5 && (
                <p className="text-[10px] font-semibold text-center py-1" style={{ color: '#a0937c' }}>
                  {teamMessages.length - 5} message{teamMessages.length - 5 > 1 ? 's' : ''} plus ancien{teamMessages.length - 5 > 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Section Conversations priv\u00e9es ── */}
      <section>
        <h2 className="text-sm font-bold mb-2" style={{ color: '#1a1a2e' }}>💬 Conversations priv\u00e9es</h2>

        {loadingConvs ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse" style={{ background: 'white', borderRadius: 18 }}>
                <div className="w-9 h-9 rounded-full" style={{ background: '#f0ebe0' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded w-24" style={{ background: '#f0ebe0' }} />
                  <div className="h-2.5 rounded w-40" style={{ background: '#f0ebe0' }} />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageCircle size={36} className="mx-auto mb-2" style={{ color: '#f0ebe0' }} />
            <p className="text-sm" style={{ color: '#a0937c' }}>Aucune conversation</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const isUnread = conv.unreadCount > 0
              return (
                <button
                  key={conv.userId}
                  onClick={() => handleSelect(conv.userId, `${conv.firstName} ${conv.lastName}`)}
                  className="w-full text-left transition-all active:scale-[0.98]"
                  style={{
                    padding: 14,
                    borderRadius: 18,
                    border: isUnread ? '1.5px solid #fde68a' : '1.5px solid #f0ebe0',
                    background: isUnread ? '#fffbeb' : 'white',
                  }}
                >
                  <div className="flex items-center gap-2.5 mb-2">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0" style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                      {`${conv.firstName.charAt(0)}${conv.lastName.charAt(0)}`.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold truncate" style={{ color: '#1a1a2e' }}>
                        {conv.firstName} {conv.lastName}
                      </p>
                      {isUnread && (
                        <p className="text-[10px] font-semibold" style={{ color: '#92400e' }}>
                          {conv.unreadCount} message{conv.unreadCount > 1 ? 's' : ''} non lu{conv.unreadCount > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: '#a0937c' }}>
                      {timeAgo(conv.lastMessageAt)}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed truncate" style={{ color: '#374151' }}>
                    {conv.lastMessageByMe ? 'Vous : ' : ''}{conv.lastMessage}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="inline-flex items-center gap-1 px-3.5 py-1 text-[11px] font-semibold transition-all"
                      style={{ border: '1.5px solid #f0ebe0', borderRadius: 10, color: '#1a1a2e', background: 'white' }}
                    >
                      ↩️ R\u00e9pondre
                    </span>
                    {isUnread && (
                      <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full px-1" style={{ background: '#fbbf24', color: '#1a1a2e' }}>
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── FAB Compose ── */}
      <button
        onClick={() => setShowNewMessage(true)}
        className="fixed z-20 flex items-center justify-center w-12 h-12 shadow-lg transition-all active:scale-90"
        style={{
          bottom: 'calc(80px + env(safe-area-inset-bottom, 12px))',
          right: 16,
          background: '#fbbf24',
          color: '#1a1a2e',
          borderRadius: 16,
          boxShadow: '0 4px 14px rgba(251,191,36,0.4)',
        }}
      >
        <span className="text-lg font-bold">✏️</span>
      </button>
    </div>
  )
}
