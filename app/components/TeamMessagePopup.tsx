'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const STORAGE_KEY = 'dismissed_team_msg'

type TeamMsg = {
  id: string
  content: string
  senderFirstName: string
  senderLastName: string
  createdAt: string
}

/**
 * TeamMessagePopup — affichage en 2 phases :
 * Phase 1 : popup non-fermable "Prénom Nom a envoyé un message à l'équipe" + bouton Lire
 * Phase 2 : le message apparaît lettre par lettre, 1s après la fin → auto-dismiss
 */
export default function TeamMessagePopup({ userId }: { userId: string }) {
  const [message, setMessage] = useState<TeamMsg | null>(null)
  const [visible, setVisible] = useState(false)
  const [phase, setPhase] = useState<'announce' | 'reading'>('announce')
  const [displayedText, setDisplayedText] = useState('')
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch('/api/team-messages/latest')
      if (!res.ok) return
      const { message: msg } = await res.json()
      if (!msg) return

      const userKey = `${STORAGE_KEY}_${userId}`
      const dismissed = localStorage.getItem(userKey)
      if (dismissed === msg.id) return

      setMessage(msg)
      setPhase('announce')
      setDisplayedText('')
      setVisible(true)
    } catch {
      // Silent
    }
  }, [userId])

  useEffect(() => {
    fetchLatest()
    const interval = setInterval(fetchLatest, 60_000)
    return () => clearInterval(interval)
  }, [fetchLatest])

  // Phase 2 : apparition lettre par lettre
  useEffect(() => {
    if (phase !== 'reading' || !message) return

    const text = message.content
    let index = 0
    setDisplayedText('')

    // Vitesse de lecture normale : ~40ms par caractère (≈25 car/sec ≈ 150 mots/min)
    timerRef.current = setInterval(() => {
      index++
      setDisplayedText(text.slice(0, index))
      if (index >= text.length) {
        if (timerRef.current) clearInterval(timerRef.current)
        // 1 seconde après la fin du message → disparition
        setTimeout(() => {
          handleDismiss()
        }, 1000)
      }
    }, 40)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [phase, message])

  function handleRead() {
    setPhase('reading')
  }

  function handleDismiss() {
    setVisible(false)
    if (message) {
      localStorage.setItem(`${STORAGE_KEY}_${userId}`, message.id)
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setMessage(null)
  }

  if (!visible || !message) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-fade-in-up">
        {phase === 'announce' ? (
          /* Phase 1 : Annonce */
          <div className="text-center px-6 py-8 space-y-5">
            <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
              <span className="text-2xl">💬</span>
            </div>
            <div>
              <p className="text-base font-semibold text-gray-900">
                {message.senderFirstName} {message.senderLastName}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                a envoyé un message à l&apos;équipe
              </p>
            </div>
            <button
              onClick={handleRead}
              className="btn-primary px-8 py-2.5 text-sm font-semibold"
            >
              Lire le message
            </button>
          </div>
        ) : (
          /* Phase 2 : Lecture lettre par lettre */
          <div className="px-6 py-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                {`${message.senderFirstName[0]}${message.senderLastName[0]}`.toUpperCase()}
              </div>
              <p className="text-sm font-semibold text-gray-700">
                {message.senderFirstName} {message.senderLastName}
              </p>
            </div>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words min-h-[40px]">
              {displayedText}
              <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 animate-pulse align-text-bottom" />
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
