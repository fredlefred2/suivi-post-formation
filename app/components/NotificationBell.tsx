'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'

const STORAGE_KEY = 'notif_last_seen'
const POLL_INTERVAL = 60_000 // 60s

type Notification = {
  type: 'like' | 'comment'
  personName: string
  actionDescription: string
  createdAt: string
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

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications')
      if (!res.ok) return
      const { notifications: notifs } = await res.json()
      setNotifications(notifs ?? [])

      // Compter les non-lues
      const lastSeen = localStorage.getItem(STORAGE_KEY)
      let unread: number
      if (lastSeen) {
        const lastSeenTime = new Date(lastSeen).getTime()
        unread = (notifs ?? []).filter(
          (n: Notification) => new Date(n.createdAt).getTime() > lastSeenTime
        ).length
      } else {
        unread = (notifs ?? []).length
      }
      setUnreadCount(unread)
    } catch {
      // Silencieux
    }
  }, [])

  // Fetch au montage + polling + visibilitychange (synchro immédiate)
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, POLL_INTERVAL)

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchNotifications()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchNotifications])

  // Fermer au clic extérieur
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

  const handleToggle = () => {
    const willOpen = !open
    setOpen(willOpen)
    if (willOpen) {
      // Marquer comme lu
      localStorage.setItem(STORAGE_KEY, new Date().toISOString())
      setUnreadCount(0)
    }
  }

  const handleNotifClick = (notif: Notification) => {
    setOpen(false)
    void notif
    router.push('/axes')
  }

  return (
    <div ref={ref} className="relative">
      {/* Bouton cloche */}
      <button
        onClick={handleToggle}
        className="relative text-indigo-200 hover:text-white transition-all p-2 hover:bg-white/15 rounded-lg active:scale-90"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full px-1 leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-800">Notifications</p>
          </div>

          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-gray-400">Aucune notification</p>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notifications.map((notif, i) => {
                const lastSeen = localStorage.getItem(STORAGE_KEY)
                const isNew = lastSeen
                  ? new Date(notif.createdAt).getTime() > new Date(lastSeen).getTime() - 1000
                  : true

                return (
                  <button
                    key={`${notif.type}-${notif.createdAt}-${i}`}
                    onClick={() => handleNotifClick(notif)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      isNew ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    {/* Ligne 1 : icône + prénom */}
                    <p className="text-sm font-medium text-gray-800">
                      {notif.type === 'like' ? '❤️' : '💬'}{' '}
                      {notif.personName}
                      <span className="font-normal text-gray-500">
                        {notif.type === 'like' ? ' a aimé' : ' a commenté'}
                      </span>
                    </p>
                    {/* Ligne 2 : action concernée */}
                    <p className="text-xs text-gray-600 mt-0.5 line-clamp-1">
                      {notif.actionDescription}
                    </p>
                    {/* Ligne 3 : date relative */}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {timeAgo(notif.createdAt)}
                    </p>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
