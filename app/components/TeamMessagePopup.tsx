'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, MessageSquare } from 'lucide-react'

const STORAGE_KEY = 'dismissed_team_msg'

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

type TeamMsg = {
  id: string
  content: string
  senderFirstName: string
  createdAt: string
}

export default function TeamMessagePopup() {
  const [message, setMessage] = useState<TeamMsg | null>(null)
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch('/api/team-messages/latest')
      if (!res.ok) return
      const { message: msg } = await res.json()
      if (!msg) return

      const dismissed = localStorage.getItem(STORAGE_KEY)
      if (dismissed === msg.id) return

      setMessage(msg)
      // Small delay for animation
      setTimeout(() => {
        setVisible(true)
        setAnimating(true)
      }, 300)
    } catch {
      // Silent
    }
  }, [])

  useEffect(() => {
    fetchLatest()
    const interval = setInterval(fetchLatest, 60_000)
    return () => clearInterval(interval)
  }, [fetchLatest])

  function handleDismiss() {
    setAnimating(false)
    setTimeout(() => {
      setVisible(false)
      if (message) {
        localStorage.setItem(STORAGE_KEY, message.id)
      }
      setMessage(null)
    }, 200)
  }

  if (!visible || !message) return null

  return (
    <div
      className={`fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 max-w-[320px] w-full transition-all duration-300 ${
        animating ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      <div className="relative">
        {/* Bubble */}
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-indigo-500" />
              <span className="text-xs font-black text-gray-800 uppercase tracking-wide">
                {message.senderFirstName}
              </span>
              <span className="text-[10px] text-gray-400 font-medium">
                {timeAgo(message.createdAt)}
              </span>
            </div>
            <button
              onClick={handleDismiss}
              className="text-gray-300 hover:text-gray-500 transition-colors p-0.5 -mr-1"
              aria-label="Fermer"
            >
              <X size={16} />
            </button>
          </div>
          {/* Content */}
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>
        {/* BD tail */}
        <div className="absolute -bottom-3 right-6">
          <svg width="24" height="14" viewBox="0 0 24 14" fill="none">
            <path d="M24 0 L10 14 L16 0 Z" fill="white" stroke="#e5e7eb" strokeWidth="1" strokeLinejoin="round" />
            <rect x="14" y="0" width="10" height="3" fill="white" />
          </svg>
        </div>
      </div>
    </div>
  )
}
