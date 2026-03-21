'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useRouter, usePathname } from 'next/navigation'

const POLL_INTERVAL = 60_000 // 60s

type NotificationType =
  | 'action_added'
  | 'action_liked'
  | 'action_commented'
  | 'level_up'
  | 'ranking_passed'
  | 'weekly_recap'
  | 'checkin_reminder'
  | 'checkin_done'
  | 'checkin_missing'
  | 'weather_alert'
  | 'message'
  | 'team_message'
  | 'streak_risk'
  | 'inactivity'

type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string
  data: Record<string, unknown>
  read: boolean
  created_at: string
}

const TYPE_ICONS: Record<NotificationType, string> = {
  action_liked: '❤️',
  action_commented: '💬',
  action_added: '💪',
  level_up: '🥁',
  ranking_passed: '📊',
  weekly_recap: '📊',
  checkin_reminder: '📋',
  checkin_done: '📋',
  checkin_missing: '📋',
  weather_alert: '⚠️',
  message: '📢',
  team_message: '📢',
  streak_risk: '⚠️',
  inactivity: '⚠️',
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then

  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'À l\'instant'
  if (minutes < 60) return `Il y a ${minutes} min`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Il y a ${hours}h`

  const days = Math.floor(hours / 24)
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days} jours`

  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

type GroupKey = 'today' | 'this_week' | 'earlier'

function groupNotifications(notifications: Notification[]): Record<GroupKey, Notification[]> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000 // 7 days ago

  const groups: Record<GroupKey, Notification[]> = {
    today: [],
    this_week: [],
    earlier: [],
  }

  for (const n of notifications) {
    const t = new Date(n.created_at).getTime()
    if (t >= todayStart) {
      groups.today.push(n)
    } else if (t >= weekStart) {
      groups.this_week.push(n)
    } else {
      groups.earlier.push(n)
    }
  }

  return groups
}

const GROUP_LABELS: Record<GroupKey, string> = {
  today: 'Aujourd\'hui',
  this_week: 'Cette semaine',
  earlier: 'Plus ancien',
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const prevCountRef = useRef(0)

  // Fermer le dropdown quand on change de page
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // Silencieux
    }
  }, [])

  // Supprime toutes les notifications texte affichées sur le téléphone
  const clearPhoneNotifications = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker?.ready
      if (reg) {
        const notifs = await reg.getNotifications()
        notifs.forEach(n => n.close())
      }
    } catch { /* silencieux */ }
  }, [])

  // Update app badge when unread count changes
  useEffect(() => {
    if (prevCountRef.current !== unreadCount) {
      prevCountRef.current = unreadCount
      if ('setAppBadge' in navigator) {
        if (unreadCount > 0) {
          navigator.setAppBadge(unreadCount).catch(() => {})
        } else {
          navigator.clearAppBadge?.().catch(() => {})
        }
      }
    }
  }, [unreadCount])

  // Fetch on mount + polling + visibilitychange
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, POLL_INTERVAL)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
        // Quand l'app revient au premier plan, nettoyer les notifs texte du téléphone
        clearPhoneNotifications()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchNotifications, clearPhoneNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [open])

  const markAllRead = async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)

    // Supprimer les notifications texte du téléphone
    clearPhoneNotifications()

    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      // Revert on error
      fetchNotifications()
    }
  }

  const markOneRead = async (notif: Notification) => {
    if (notif.read) return

    // Optimistic update
    setNotifications(prev =>
      prev.map(n => (n.id === notif.id ? { ...n, read: true } : n))
    )
    setUnreadCount(prev => Math.max(0, prev - 1))

    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [notif.id] }),
      })
      if (res.ok) {
        const data = await res.json()
        setUnreadCount(data.unreadCount ?? 0)
      }
    } catch {
      fetchNotifications()
    }
  }

  const handleNotifClick = async (notif: Notification) => {
    setOpen(false)
    await markOneRead(notif)

    // Navigate to relevant page
    const url = (notif.data?.url as string) || null
    if (url) {
      router.push(url)
    } else {
      // Fallback by type
      switch (notif.type) {
        case 'action_liked':
        case 'action_commented':
        case 'action_added':
          router.push('/axes')
          break
        case 'checkin_reminder':
        case 'checkin_done':
        case 'checkin_missing':
          router.push('/checkin')
          break
        case 'ranking_passed':
        case 'weekly_recap':
          router.push('/team')
          break
        case 'message':
        case 'team_message':
          router.push('/dashboard')
          break
        default:
          router.push('/dashboard')
      }
    }
  }

  const grouped = groupNotifications(notifications)
  const groupOrder: GroupKey[] = ['today', 'this_week', 'earlier']

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => {
          const willOpen = !open
          setOpen(willOpen)
          if (willOpen && unreadCount > 0) {
            markAllRead()
          }
        }}
        className="relative text-indigo-200 hover:text-white transition-all p-2 hover:bg-white/15 rounded-lg active:scale-90"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1 leading-none animate-in fade-in zoom-in duration-200">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="fixed left-1/2 -translate-x-1/2 top-14 mt-2 w-96 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
          </div>

          {/* Content */}
          {notifications.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <div className="text-3xl mb-2">🔔</div>
              <p className="text-sm text-gray-400">Aucune notification</p>
            </div>
          ) : (
            <div className="max-h-[28rem] overflow-y-auto">
              {groupOrder.map(groupKey => {
                const items = grouped[groupKey]
                if (items.length === 0) return null

                return (
                  <div key={groupKey}>
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        {GROUP_LABELS[groupKey]}
                      </p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {items.map(notif => (
                        <button
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex gap-3 items-start ${
                            !notif.read ? 'bg-blue-50/60' : ''
                          }`}
                        >
                          {/* Icon */}
                          <span className="text-lg mt-0.5 shrink-0">
                            {TYPE_ICONS[notif.type] || '🔔'}
                          </span>

                          {/* Text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-800 leading-snug">
                              <span className={!notif.read ? 'font-semibold' : 'font-medium'}>
                                {notif.title}
                              </span>
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                              {notif.body}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {timeAgo(notif.created_at)}
                            </p>
                          </div>

                          {/* Unread dot */}
                          {!notif.read && (
                            <span className="mt-2 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
