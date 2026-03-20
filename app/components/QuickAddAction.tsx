'use client'

import { useState, useEffect, useTransition } from 'react'
import { X } from 'lucide-react'
import { createAction } from '@/app/(learner)/axes/actions'
import { getNextLevel, getCurrentLevelIndex, getCurrentLevel } from '@/lib/axeHelpers'
import { useToast } from '@/app/components/Toast'

type AxeOption = {
  id: string
  subject: string
  completedCount: number
}

type Category = {
  key: string
  emoji: string
  label: string
  prefix: string
  placeholder: string
}

const CATEGORIES: Category[] = [
  {
    key: 'action',
    emoji: '💪',
    label: 'J\'ai agi différemment',
    prefix: 'Action',
    placeholder: 'Ex : J\'ai laissé Julie animer la réunion',
  },
  {
    key: 'outil',
    emoji: '🔧',
    label: 'J\'ai utilisé un outil / une méthode',
    prefix: 'Outil',
    placeholder: 'Ex : J\'ai utilisé la matrice Eisenhower',
  },
  {
    key: 'recul',
    emoji: '🪞',
    label: 'J\'ai pris du recul',
    prefix: 'Recul',
    placeholder: 'Ex : J\'ai analysé ma réaction après la réunion',
  },
]

type Props = {
  axes: AxeOption[]
  open: boolean
  onClose: () => void
  onSuccess?: (axeId: string, newCount: number) => void
  onboardingMode?: boolean
}

export default function QuickAddAction({ axes, open, onClose, onSuccess, onboardingMode }: Props) {
  const [step, setStep] = useState<'axe' | 'category' | 'comment'>('axe')
  const [selectedAxe, setSelectedAxe] = useState<AxeOption | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [comment, setComment] = useState('')
  const [isPending, startTransition] = useTransition()
  const [levelUpInfo, setLevelUpInfo] = useState<{ icon: string; label: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmInfo, setConfirmInfo] = useState<{ message: string; nextIcon: string; nextLabel: string } | null>(null)
  const { toast } = useToast()

  // Onboarding mode: auto-select first axe, first category, pre-fill text
  useEffect(() => {
    if (onboardingMode && open && axes.length > 0 && !selectedAxe) {
      const firstAxe = axes[0]
      setSelectedAxe(firstAxe)
      setSelectedCategory(CATEGORIES[0]) // 💪 J'ai agi différemment
      setComment('J\'ai prepare le compte-rendu de la reunion')
      setStep('comment')
    }
  }, [onboardingMode, open, axes, selectedAxe])

  function reset() {
    setStep('axe')
    setSelectedAxe(null)
    setSelectedCategory(null)
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
    setStep('category')
  }

  function handleSelectCategory(cat: Category) {
    setSelectedCategory(cat)
    setStep('comment')
  }

  function handleSubmit() {
    if (!selectedAxe || !selectedCategory) return

    const description = comment.trim()
      ? `${selectedCategory.prefix} · ${comment.trim()}`
      : selectedCategory.prefix

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
        // Fenêtre de confirmation (même taille que célébration)
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
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xs mx-4 p-8 text-center animate-fade-in-up">
          <div className="text-7xl animate-level-up mb-4">{levelUpInfo.icon}</div>
          <div className="animate-level-up-text">
            <p className="text-xl font-bold text-gray-900 mb-1">Niveau {levelUpInfo.label}</p>
            <p className="text-lg font-semibold text-gray-500">débloqué !</p>
            <p className="text-sm text-gray-400 mt-3">Continue comme ça 💪</p>
          </div>
        </div>
      ) : showConfirm ? (
        <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xs mx-4 p-8 text-center animate-fade-in-up">
          <div className="text-7xl mb-4">✅</div>
          <p className="text-xl font-bold text-gray-900 mb-1">Action ajoutée !</p>
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
        <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md mx-0 sm:mx-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 text-lg">
              {step === 'axe' && 'Sur quel axe ?'}
              {step === 'category' && 'Qu\'as-tu fait ?'}
              {step === 'comment' && 'Précise (optionnel)'}
            </h3>
            <button onClick={handleClose} className="p-1 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          {/* Étape 1 : Choix de l'axe */}
          {step === 'axe' && (
            <div className="space-y-3">
              {axes.map((axe, i) => (
                <button
                  key={axe.id}
                  onClick={() => handleSelectAxe(axe)}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-sm font-bold text-indigo-600 shrink-0">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{axe.subject}</p>
                      <p className="text-xs text-gray-400">{axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Étape 2 : Choix de la catégorie */}
          {step === 'category' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500 mb-1">
                Axe : <span className="font-medium text-gray-700">{selectedAxe?.subject}</span>
              </p>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => handleSelectCategory(cat)}
                  className="w-full text-left p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{cat.emoji}</span>
                    <p className="font-medium text-gray-800">{cat.label}</p>
                  </div>
                </button>
              ))}
              <button
                onClick={() => setStep('axe')}
                className="text-sm text-gray-400 hover:text-gray-600 mt-2"
              >
                ← Changer d&apos;axe
              </button>
            </div>
          )}

          {/* Étape 3 : Commentaire optionnel */}
          {step === 'comment' && (
            <div className="space-y-4">
              {onboardingMode && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-sm text-indigo-700">
                  <p className="font-medium">🎯 C&apos;est un exemple !</p>
                  <p className="text-xs text-indigo-500 mt-0.5">Ton axe et ta categorie sont pre-selectionnes. Valide cette action pour decouvrir la suite.</p>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>{selectedCategory?.emoji}</span>
                <span className="font-medium text-gray-700">{selectedCategory?.label}</span>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="input w-full h-24 resize-none"
                placeholder={selectedCategory?.placeholder}
                autoFocus
              />
              <div className="flex gap-3">
                {!onboardingMode && (
                  <button
                    onClick={() => setStep('category')}
                    className="btn-secondary flex-1"
                  >
                    ← Retour
                  </button>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={isPending}
                  className="btn-primary flex-1"
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
