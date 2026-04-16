'use client'

import { useState, useEffect, useRef } from 'react'
import { CheckinPrompt, CoachGiftPrompt, ActionPrompt, QuizPrompt } from './PromptModals'

type PromptType = 'checkin' | 'tip' | 'action' | 'quiz'

type Props = {
  firstName: string
  // Check-in
  checkinAvailable: boolean   // ven-lun
  checkinDone: boolean
  checkinWeekLabel: string
  streak: number
  // Callbacks pour ouvrir les modales correspondantes
  onOpenCheckin: () => void
  onOpenQuickAdd: () => void
  onOpenQuiz?: () => void
}

/**
 * Orchestrateur des fenêtres plein écran à l'ouverture de l'appli.
 * Check les conditions dans l'ordre de priorité et affiche la première qui matche.
 * Gère les skips pour ne pas harceler.
 *
 * Règles de réouverture après skip :
 * - checkin : à chaque ouverture jusqu'à lundi soir (urgent)
 * - tip     : 1x par jour max (si skip aujourd'hui, reprend demain matin)
 * - action  : 1x par ouverture max (reprend la prochaine ouverture le lendemain si toujours 10j+)
 * - quiz    : 1x par semaine max
 */
export default function OpenAppPrompt({
  firstName,
  checkinAvailable,
  checkinDone,
  checkinWeekLabel,
  streak,
  onOpenCheckin,
  onOpenQuickAdd,
  onOpenQuiz,
}: Props) {
  const [activePrompt, setActivePrompt] = useState<PromptType | null>(null)
  const [tipData, setTipData] = useState<any>(null)
  const [daysSince, setDaysSince] = useState(0)
  const didCheck = useRef(false)

  useEffect(() => {
    // Ne check qu'une fois par montage du composant (une fois par ouverture d'appli)
    if (didCheck.current) return
    didCheck.current = true

    async function checkPriorities() {
      try {
        // Récupère les skips en parallèle avec les autres vérifs
        const [dismissalsRes, tipRes, lastActionRes] = await Promise.all([
          fetch('/api/prompt-dismiss').then(r => r.ok ? r.json() : { dismissals: {} }),
          fetch('/api/tips').then(r => r.ok ? r.json() : { tip: null }),
          fetch('/api/last-action').then(r => r.ok ? r.json() : null),
        ])

        const dismissals: Record<string, string> = dismissalsRes.dismissals || {}
        const tip = tipRes.tip
        const lastAction = lastActionRes

        // ── 1. Check-in : ven/sam/dim/lun + pas fait ──
        if (checkinAvailable && !checkinDone) {
          // Pas de skip blocking — on ré-affiche à chaque ouverture (urgent)
          setActivePrompt('checkin')
          return
        }

        // ── 2. Tip non lu ──
        if (tip) {
          const skipped = dismissals.tip
          if (!skipped || !isSameDay(skipped)) {
            setTipData(tip)
            setActivePrompt('tip')
            return
          }
        }

        // ── 3. Pas d'action depuis 10j ──
        if (lastAction?.isStale) {
          const skipped = dismissals.action
          // Reprend si pas skip OU skip d'hier ou avant
          if (!skipped || !isSameDay(skipped)) {
            setDaysSince(lastAction.daysSince || 10)
            setActivePrompt('action')
            return
          }
        }

        // ── 4. Quiz (Phase 2, désactivé pour l'instant) ──
        // const quizAvailable = false
        // if (quizAvailable) {
        //   const skipped = dismissals.quiz
        //   if (!skipped || !isSameWeek(skipped)) {
        //     setActivePrompt('quiz')
        //     return
        //   }
        // }

        // Rien à afficher
      } catch (err) {
        console.error('[OpenAppPrompt] check failed:', err)
      }
    }

    // Petit délai pour laisser le dashboard finir son premier rendu
    const t = setTimeout(checkPriorities, 600)
    return () => clearTimeout(t)
  }, [checkinAvailable, checkinDone])

  async function markSkipped(type: PromptType) {
    try {
      await fetch('/api/prompt-dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promptType: type }),
      })
    } catch {}
  }

  function close() {
    setActivePrompt(null)
  }

  return (
    <>
      <CheckinPrompt
        open={activePrompt === 'checkin'}
        weekLabel={checkinWeekLabel}
        streak={streak}
        onDoIt={() => { close(); onOpenCheckin() }}
        onSkip={() => { close(); markSkipped('checkin') }}
      />
      <CoachGiftPrompt
        open={activePrompt === 'tip'}
        tip={tipData}
        onRead={async () => {
          // Marquer le tip comme "acted" pour ne plus le re-afficher
          if (tipData) {
            try {
              await fetch('/api/tips', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipId: tipData.id, acted: true }),
              })
            } catch {}
          }
          close()
        }}
        onSkip={() => { close(); markSkipped('tip') }}
      />
      <ActionPrompt
        open={activePrompt === 'action'}
        daysSince={daysSince}
        firstName={firstName}
        onDoIt={() => { close(); onOpenQuickAdd() }}
        onSkip={() => { close(); markSkipped('action') }}
      />
      <QuizPrompt
        open={activePrompt === 'quiz'}
        onDoIt={() => { close(); onOpenQuiz?.() }}
        onSkip={() => { close(); markSkipped('quiz') }}
      />
    </>
  )
}

// ── Helpers ─────────────────────────────────────────────────────

function isSameDay(iso: string): boolean {
  const d = new Date(iso)
  const now = new Date()
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate()
}
