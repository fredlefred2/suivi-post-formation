'use client'

import { useState, useEffect, useTransition } from 'react'
import { X } from 'lucide-react'
import { createAction } from '@/app/(learner)/axes/actions'
import { getNextLevel, getCurrentLevelIndex, getCurrentLevel, getDynamique } from '@/lib/axeHelpers'
import { useToast } from '@/app/components/Toast'

type AxeOption = {
  id: string
  subject: string
  completedCount: number
}

type Props = {
  axes: AxeOption[]
  open: boolean
  onClose: () => void
  onSuccess?: (axeId: string, newCount: number) => void
  onboardingMode?: boolean
  prefill?: { content: string; axeId: string } | null
}

const LEVEL_BORDER_COLORS: Record<number, string> = {
  0: '#94a3b8', // slate — Veille
  1: '#38bdf8', // sky — Impulsion
  2: '#34d399', // emerald — Rythme
  3: '#fb923c', // orange — Intensité
  4: '#fb7185', // rose — Propulsion
}

const LEVEL_BG_COLORS: Record<number, string> = {
  0: 'rgba(148,163,184,0.08)',
  1: 'rgba(56,189,248,0.08)',
  2: 'rgba(52,211,153,0.08)',
  3: 'rgba(251,146,60,0.08)',
  4: 'rgba(251,113,133,0.08)',
}

export default function QuickAddAction({ axes, open, onClose, onSuccess, onboardingMode, prefill }: Props) {
  const [step, setStep] = useState<'axe' | 'comment'>('axe')
  const [selectedAxe, setSelectedAxe] = useState<AxeOption | null>(null)
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const [levelUpInfo, setLevelUpInfo] = useState<{ icon: string; label: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmInfo, setConfirmInfo] = useState<{ message: string; nextIcon: string; nextLabel: string } | null>(null)
  const { toast } = useToast()

  // Prefill depuis défi de la semaine
  useEffect(() => {
    if (prefill && open) {
      const axe = axes.find(a => a.id === prefill.axeId)
      if (axe) {
        setSelectedAxe(axe)
        setComment(prefill.content)
        setStep('comment')
      }
    }
  }, [prefill, open, axes])

  // Onboarding mode: auto-select first axe, pre-fill text
  useEffect(() => {
    if (onboardingMode && open && axes.length > 0 && !selectedAxe) {
      const firstAxe = axes[0]
      setSelectedAxe(firstAxe)
      setComment('J\'ai préparé le compte-rendu de la réunion')
      setStep('comment')
    }
  }, [onboardingMode, open, axes, selectedAxe])

  function reset() {
    setStep('axe')
    setSelectedAxe(null)
    setComment('')
    setLevelUpInfo(null)
    setShowConfirm(false)
    setConfirmInfo(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSelectAxe(axe: AxeOption) {
    setSelectedAxe(axe)
    setStep('comment')
  }

  function handleSubmit() {
    if (!selectedAxe || !comment.trim()) return

    const description = comment.trim()

    const fd = new FormData()
    fd.set('axe_id', selectedAxe.id)
    fd.set('description', description)

    const oldCount = selectedAxe.completedCount

    startTransition(async () => {
      const result = await createAction(fd)
      if (result?.error) return

      const newCount = oldCount + 1

      // Célébration si changement de niveau, sinon confirmation simple
      const oldLevel = getCurrentLevelIndex(oldCount)
      const newLevel = getCurrentLevelIndex(newCount)
      if (newLevel > oldLevel) {
        const level = getCurrentLevel(newCount)
        setLevelUpInfo(level)
        setTimeout(() => {
          setLevelUpInfo(null)
          handleClose()
          onSuccess?.(selectedAxe.id, newCount)
        }, 2500)
      } else {
        // Fenêtre de confirmation
        const next = getNextLevel(newCount)
        setConfirmInfo(next ? {
          message: `Encore ${next.delta} action${next.delta > 1 ? 's' : ''} pour`,
          nextIcon: next.icon,
          nextLabel: next.label,
        } : null)
        setShowConfirm(true)
        setTimeout(() => {
          setShowConfirm(false)
          setConfirmInfo(null)
          handleClose()
          onSuccess?.(selectedAxe.id, newCount)
        }, 2500)
      }
    })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {levelUpInfo ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-4 p-8 text-center animate-fade-in-up" style={{ border: '2px solid #f0ebe0' }}>
          <div className="text-7xl animate-level-up mb-4">{levelUpInfo.icon}</div>
          <div className="animate-level-up-text">
            <p className="text-xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Niveau {levelUpInfo.label}</p>
            <p className="text-lg font-semibold" style={{ color: '#a0937c' }}>débloqué !</p>
            <p className="text-sm mt-3" style={{ color: '#a0937c' }}>Continue comme ça 💪</p>
          </div>
        </div>
      ) : showConfirm ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-4 p-8 text-center animate-fade-in-up" style={{ border: '2px solid #f0ebe0' }}>
          <div className="text-7xl mb-4">✅</div>
          <p className="text-xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Action ajoutée !</p>
          {confirmInfo ? (
            <div className="mt-3">
              <p className="text-sm text-gray-500">{confirmInfo.message}</p>
              <p className="text-2xl mt-1">{confirmInfo.nextIcon} <span className="text-lg font-semibold text-gray-500">{confirmInfo.nextLabel}</span></p>
            </div>
          ) : (
            <p className="text-lg font-semibold text-gray-500 mt-1">Niveau max atteint ! 🚀</p>
          )}
        </div>
      ) : (
        <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl w-full max-w-md mx-0 sm:mx-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-fade-in-up" style={{ border: '2px solid #f0ebe0' }}>
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>
              {step === 'axe' && 'Sur quel axe ?'}
              {step === 'comment' && 'Qu\'as-tu fait ?'}
            </h3>
            <button onClick={handleClose} className="p-1 text-gray-500 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* Étape 1 : Choix de l'axe — coloré par niveau */}
          {step === 'axe' && (
            <div className="space-y-3">
              {axes.map((axe) => {
                const levelIdx = getCurrentLevelIndex(axe.completedCount)
                const marker = getDynamique(axe.completedCount)
                const borderColor = LEVEL_BORDER_COLORS[levelIdx] ?? LEVEL_BORDER_COLORS[0]
                const bgColor = LEVEL_BG_COLORS[levelIdx] ?? LEVEL_BG_COLORS[0]
                return (
                  <button
                    key={axe.id}
                    onClick={() => handleSelectAxe(axe)}
                    className="w-full text-left p-4 rounded-xl transition-all active:scale-[0.98]"
                    style={{
                      background: bgColor,
                      border: `2px solid ${borderColor}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                        style={{
                          background: `linear-gradient(135deg, ${borderColor}, ${borderColor}dd)`,
                        }}
                      >
                        <span className="drop-shadow-sm">{marker.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">{axe.subject}</p>
                        <p className="text-xs text-gray-500">{axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''} · {marker.label}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          {/* Étape 2 : Saisie obligatoire */}
          {step === 'comment' && (
            <div className="space-y-4">
              {onboardingMode && (
                <div className="rounded-xl px-3 py-2 text-sm" style={{ background: '#fffbeb', border: '2px solid #fde68a', color: '#92400e' }}>
                  <p className="font-medium">🎯 C&apos;est un exemple !</p>
                  <p className="text-xs mt-0.5" style={{ color: '#92400e' }}>Ton axe est pré-sélectionné. Valide cette action pour découvrir la suite.</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-base">{getDynamique(selectedAxe?.completedCount ?? 0).icon}</span>
                <span className="font-medium text-gray-700">{selectedAxe?.subject}</span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="input w-full h-24 resize-none"
                placeholder="Ex : J'ai laissé Julie animer la réunion"
                autoFocus
                required
              />
              <div className="flex gap-3">
                {!onboardingMode && (
                  <button
                    onClick={() => { setStep('axe'); setSelectedAxe(null) }}
                    className="btn-secondary flex-1"
                  >
                    ← Retour
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={isPending || !comment.trim()}
                  className="btn-primary flex-1 disabled:opacity-50"
                >
                  {isPending ? 'Enregistrement...' : 'Valider ✓'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
