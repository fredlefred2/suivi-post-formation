'use client'

import { useState, useEffect } from 'react'
import { CheckinPrompt, CoachGiftPrompt, ActionPrompt, QuizPrompt } from './PromptModals'

type PromptType = 'checkin' | 'tip' | 'action' | 'quiz'

type InitialTip = {
  id: string
  content: string
  advice: string | null
  axe_subject?: string
} | null

type Props = {
  firstName: string
  // Check-in
  checkinAvailable: boolean   // ven-lun
  checkinDone: boolean
  checkinWeekLabel: string
  streak: number
  // Contrôle : forcer l'affichage du coach (quand user clique sur l'icône)
  forceCoach?: boolean
  // Données précalculées server-side — zéro fetch client au mount
  initialTip: InitialTip
  initialLastAction: { daysSince: number; isStale: boolean } | null
  initialDismissals: Record<string, string>
  // Callbacks pour ouvrir les modales correspondantes
  onOpenCheckin: () => void
  onOpenQuickAdd: () => void
  onOpenQuiz?: () => void
  onTipRead?: () => void  // Quand user marque le tip lu
  onForceCoachConsumed?: () => void  // Reset forceCoach après affichage
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
  forceCoach,
  initialTip,
  initialLastAction,
  initialDismissals,
  onOpenCheckin,
  onOpenQuickAdd,
  onOpenQuiz,
  onTipRead,
  onForceCoachConsumed,
}: Props) {
  // Calcul synchrone de l'actif à l'ouverture — pas de fetch, pas de setTimeout
  const initialActive = computeInitialPrompt({
    checkinAvailable,
    checkinDone,
    tip: initialTip,
    lastAction: initialLastAction,
    dismissals: initialDismissals,
  })

  const [activePrompt, setActivePrompt] = useState<PromptType | null>(initialActive.prompt)
  const [tipData, setTipData] = useState<InitialTip>(initialActive.prompt === 'tip' ? initialTip : null)
  const [daysSince] = useState(initialActive.daysSince)

  // Déclenchement manuel quand user clique l'icône Coach
  useEffect(() => {
    if (!forceCoach) return
    if (initialTip) {
      setTipData(initialTip)
      setActivePrompt('tip')
    }
    onForceCoachConsumed?.()
  }, [forceCoach, initialTip, onForceCoachConsumed])

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
          // Marquer le tip comme "acted" — bloquant pour éviter la réapparition
          if (tipData) {
            try {
              const res = await fetch('/api/tips', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tipId: tipData.id, acted: true }),
              })
              if (!res.ok) console.error('[OpenAppPrompt] PATCH tip failed:', res.status)
            } catch (err) {
              console.error('[OpenAppPrompt] PATCH tip error:', err)
            }
          }
          setTipData(null)  // Clear local cache
          close()
          onTipRead?.()     // Notifier le parent pour reset tipAvailable
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

/**
 * Applique la priorité (check-in > tip > relance 10j > quiz) à partir
 * des données déjà résolues côté serveur. Exécuté une fois au mount.
 */
function computeInitialPrompt({
  checkinAvailable,
  checkinDone,
  tip,
  lastAction,
  dismissals,
}: {
  checkinAvailable: boolean
  checkinDone: boolean
  tip: InitialTip
  lastAction: { daysSince: number; isStale: boolean } | null
  dismissals: Record<string, string>
}): { prompt: PromptType | null; daysSince: number } {
  // 1. Check-in urgent (pas de skip bloquant)
  if (checkinAvailable && !checkinDone) {
    return { prompt: 'checkin', daysSince: 0 }
  }

  // 2. Tip non lu (skip bloque 1 journée)
  if (tip) {
    const skipped = dismissals.tip
    if (!skipped || !isSameDay(skipped)) {
      return { prompt: 'tip', daysSince: 0 }
    }
  }

  // 3. Relance action 10 jours (skip bloque 1 journée)
  if (lastAction?.isStale) {
    const skipped = dismissals.action
    if (!skipped || !isSameDay(skipped)) {
      return { prompt: 'action', daysSince: lastAction.daysSince || 10 }
    }
  }

  // 4. Quiz — Phase 2, désactivé
  return { prompt: null, daysSince: 0 }
}
