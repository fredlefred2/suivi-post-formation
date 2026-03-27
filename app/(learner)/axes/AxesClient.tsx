'use client'

import { useState, useRef, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { createAxe, createAxeFast, deleteAxe, updateAxe, createAction, updateAction, deleteAction } from './actions'
import type { Axe, Action, ActionFeedbackData, Difficulty } from '@/lib/types'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'
import QuickAddAction from '@/app/components/QuickAddAction'
import { useOnboarding } from '@/lib/onboarding-context'
import { MARKERS, getDynamique, getCurrentLevelIndex, getProgress, getCurrentLevel, getNextLevel, getActionPhaseIcon } from '@/lib/axeHelpers'
import { useToast } from '@/app/components/Toast'

type AxeWithActions = Axe & { actions: Action[] }

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const emptyFeedback: ActionFeedbackData = { likes_count: 0, comments_count: 0, liked_by_me: false, likers: [], comments: [] }

const ACTION_PHASE_COLORS = [
  'bg-sky-100',      // rank 1-2 → Impulsion
  'bg-emerald-100',  // rank 3-5 → Rythme
  'bg-orange-100',   // rank 6-8 → Intensité
  'bg-rose-100',     // rank 9+  → Propulsion
] as const
function getActionPhaseBg(rank: number) {
  if (rank <= 2) return ACTION_PHASE_COLORS[0]
  if (rank <= 5) return ACTION_PHASE_COLORS[1]
  if (rank <= 8) return ACTION_PHASE_COLORS[2]
  return ACTION_PHASE_COLORS[3]
}

export default function AxesClient({ axes, initialIndex = 0, feedbackMap = {}, onboarding, userId }: { axes: AxeWithActions[], initialIndex?: number, feedbackMap?: Record<string, ActionFeedbackData>, onboarding?: string, userId?: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const { setIsOnboarding } = useOnboarding()
  const [levelUpInfo, setLevelUpInfo] = useState<{ icon: string; label: string } | null>(null)
  const isOnboardingCreate = onboarding === 'create'
  const isOnboardingMode = isOnboardingCreate
  const [showAxeForm, setShowAxeForm] = useState(isOnboardingCreate)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null)

  // Disable navigation menus during onboarding phases on /axes
  useEffect(() => {
    if (isOnboardingMode) setIsOnboarding(true)
    return () => setIsOnboarding(false)
  }, [isOnboardingMode, setIsOnboarding])
  const [addActionAxeId, setAddActionAxeId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [editingActionId, setEditingActionId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingActionId, setDeletingActionId] = useState<string | null>(null)
  const [deletingAxeStep, setDeletingAxeStep] = useState<0 | 1 | 2>(0) // 0=fermé, 1=avertissement, 2=confirmation
  const [deletingAxeId, setDeletingAxeId] = useState<string | null>(null)
  // État édition d'axe
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [highlightAxeId, setHighlightAxeId] = useState<string | null>(null)
  const [editingAxe, setEditingAxe] = useState<AxeWithActions | null>(null)
  const [editAxeSubject, setEditAxeSubject] = useState('')
  const [editAxeDescription, setEditAxeDescription] = useState('')
  const [editAxeDifficulty, setEditAxeDifficulty] = useState<Difficulty | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Index sécurisé (évite les débordements si un axe est supprimé)
  const safeIndex = Math.max(0, Math.min(currentIndex, axes.length - 1))

  // Scroll handler : met à jour l'index courant en fonction de la carte visible
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container || container.children.length === 0) return
    const containerRect = container.getBoundingClientRect()
    const containerCenter = containerRect.left + containerRect.width / 2
    let closestIndex = 0
    let closestDist = Infinity
    for (let i = 0; i < container.children.length; i++) {
      const child = container.children[i] as HTMLElement
      const childRect = child.getBoundingClientRect()
      const childCenter = childRect.left + childRect.width / 2
      const dist = Math.abs(containerCenter - childCenter)
      if (dist < closestDist) {
        closestDist = dist
        closestIndex = i
      }
    }
    setCurrentIndex(closestIndex)
  }, [])

  // Scroll initial vers l'index demandé
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || axes.length === 0) return
    const targetIndex = initialIndex
    if (targetIndex > 0 && targetIndex < axes.length) {
      const card = container.children[targetIndex] as HTMLElement
      if (card) {
        card.scrollIntoView({ inline: 'center', block: 'nearest' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreateAxe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    if (isOnboardingCreate) {
      // En onboarding : action rapide (revalide uniquement /dashboard)
      setIsSaving(true)
      const result = await createAxeFast(formData)
      if (result?.error) { setError(result.error); setIsSaving(false) }
      else router.push('/dashboard')
    } else {
      startTransition(async () => {
        const result = await createAxe(formData)
        if (result?.error) setError(result.error)
        else {
          setShowAxeForm(false)
          setSelectedDifficulty(null)
          setCurrentIndex(axes.length)
        }
      })
    }
  }

  async function handleCreateAction(e: React.FormEvent<HTMLFormElement>, axeId: string) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('axe_id', axeId)

    // Sauvegarder le count avant pour détecter un changement de niveau
    const axe = axes.find(a => a.id === axeId)
    const oldCount = axe?.actions.length ?? 0

    startTransition(async () => {
      const result = await createAction(formData)
      if (result?.error) return

      setAddActionAxeId(null)

      // Toast avec delta vers le prochain niveau
      const newCount = oldCount + 1
      const next = getNextLevel(newCount)
      if (next) {
        toast(`✓ Action ajoutée — encore ${next.delta} pour ${next.icon} ${next.label}`)
      } else {
        toast('✓ Action ajoutée — niveau max atteint ! 🚀')
      }

      // Célébration si changement de niveau
      const oldLevel = getCurrentLevelIndex(oldCount)
      const newLevel = getCurrentLevelIndex(newCount)
      if (newLevel > oldLevel) {
        const level = getCurrentLevel(newCount)
        setLevelUpInfo(level)
        setTimeout(() => setLevelUpInfo(null), 3000)
      }
    })
  }

  // Handler pour la modification d'axe
  async function handleUpdateAxe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingAxe || !editAxeDifficulty) return
    setError(null)
    startTransition(async () => {
      const result = await updateAxe(editingAxe.id, editAxeSubject, editAxeDescription || null, editAxeDifficulty)
      if (result?.error) setError(result.error)
      else setEditingAxe(null)
    })
  }

  const deletingAxe = deletingAxeId ? axes.find(a => a.id === deletingAxeId) : null

  return (
    <div className="space-y-6 pb-4">
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
          boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />
        <div className="relative flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold text-white">Mes actions</h1>
            <p className="text-xs text-indigo-200 mt-0.5">{axes.length} axe{axes.length !== 1 ? 's' : ''} de progrès</p>
          </div>
          {axes.length < 3 && !isOnboardingCreate && (
            <button
              onClick={() => setShowAxeForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-white/90 hover:bg-white transition-colors"
            >
              <Plus size={14} /> Ajouter un axe
            </button>
          )}
        </div>
      </div>

      {/* Bouton Nouvelle Action — full width harmonisé avec dashboard */}
      {axes.length > 0 && !isOnboardingMode && (
        <button
          onClick={() => setQuickAddOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white active:scale-[0.97] transition-transform"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
            boxShadow: '0 4px 15px rgba(79, 70, 229, 0.35)',
          }}
        >
          <Plus size={20} strokeWidth={2.5} />
          <span className="text-[15px] font-bold">Nouvelle action</span>
        </button>
      )}

      {/* Formulaire nouvel axe */}
      {showAxeForm && (
        <div className="rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden">
          {/* Header gradient */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4">
            <h2 className="text-white font-bold text-base">🎯 Nouvel axe de progrès</h2>
            <p className="text-indigo-100 text-xs mt-0.5">Définis un domaine à améliorer</p>
          </div>

          <form onSubmit={handleCreateAxe} className="p-5 space-y-5">
            {/* Sujet */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intitulé de l&apos;axe</label>
              <input
                name="subject"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all placeholder:text-gray-500"
                placeholder="Ex : Déléguer efficacement"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                Moyens envisagés <span className="font-normal text-gray-500">(optionnel)</span>
              </label>
              <textarea
                name="description"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none h-20 placeholder:text-gray-500"
                placeholder="Comment comptez-vous progresser sur cet axe ?"
              />
            </div>

            {/* Difficulté */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-2 block">Niveau de difficulté</label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { key: 'facile' as const, emoji: '🟢', label: 'Facile' },
                  { key: 'moyen' as const, emoji: '🟡', label: 'Moyen' },
                  { key: 'difficile' as const, emoji: '🔴', label: 'Difficile' },
                ]).map(({ key, emoji, label }) => {
                  const isSelected = selectedDifficulty === key
                  return (
                    <label key={key} className="cursor-pointer">
                      <input
                        type="radio" name="difficulty" value={key} required className="sr-only"
                        checked={isSelected}
                        onChange={() => setSelectedDifficulty(key)}
                      />
                      <div className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all duration-200 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50 shadow-md scale-[1.03]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                        <span className="text-lg">{emoji}</span>
                        <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-500'}`}>{label}</span>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

            {/* Boutons */}
            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={isPending || isSaving}
                className={`flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98] ${(isPending || isSaving) ? 'opacity-60' : ''}`}
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                {(isPending || isSaving) ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Enregistrement...
                  </span>
                ) : '✓ Enregistrer'}
              </button>
              {!isOnboardingCreate && (
                <button
                  type="button"
                  onClick={() => { setShowAxeForm(false); setError(null); setSelectedDifficulty(null) }}
                  className="px-5 py-3 rounded-xl font-semibold text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* État vide */}
      {axes.length === 0 && !showAxeForm && (
        <div className="card text-center py-10">
          <p className="text-gray-500 mb-4">Vous n&apos;avez pas encore défini d&apos;axes de progrès.</p>
          <button onClick={() => setShowAxeForm(true)} className="btn-primary">
            <Plus size={16} /> Définir mon premier axe
          </button>
        </div>
      )}

      {/* Carrousel scroll-snap (masqué pendant l'onboarding création d'axes) */}
      {axes.length > 0 && !isOnboardingCreate && (
        <div className="space-y-3">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
          >
            {axes.map((axe, axeIndex) => {
              const dyn = getDynamique(axe.actions.length)
              const progress = getProgress(axe.actions.length)
              const levelIdx = getCurrentLevelIndex(axe.actions.length)
              const level = getCurrentLevel(axe.actions.length)
              const cardGradient = levelIdx === 0
                ? 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)'
                : levelIdx === 1
                ? 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)'
                : levelIdx === 2
                ? 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)'
                : levelIdx === 3
                ? 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 100%)'
                : 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)'
              return (
                <div
                  key={axe.id}
                  className="snap-center shrink-0 w-[85vw] max-w-[420px] rounded-2xl p-4 flex flex-col max-h-[calc(100dvh-11rem)]"
                  style={{ background: cardGradient }}
                >
                 <div className="shrink-0">
                  {/* Titre + boutons edit/delete */}
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-white/70 flex items-center justify-center text-xs font-bold shrink-0">
                      {axeIndex + 1}
                    </span>
                    <p className="font-bold text-sm leading-snug line-clamp-1 flex-1">{axe.subject}</p>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => {
                          setEditingAxe(axe)
                          setEditAxeSubject(axe.subject)
                          setEditAxeDescription(axe.description ?? '')
                          setEditAxeDifficulty(axe.difficulty as Difficulty)
                        }}
                        className="opacity-40 hover:opacity-80 transition-opacity p-1"
                        title="Modifier cet axe"
                      >
                        <Pencil size={15} />
                      </button>
                      {axes.length > 1 && (
                        <button
                          onClick={() => { setDeletingAxeId(axe.id); setDeletingAxeStep(1) }}
                          className="opacity-40 hover:opacity-80 transition-opacity p-1"
                          title="Supprimer cet axe"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {axe.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-1 ml-8">{axe.description}</p>
                  )}

                  {/* Barre de progression simplifiée */}
                  <div className="mt-3 flex items-center gap-2.5">
                    <span className="text-lg">{level.icon}</span>
                    <div className="flex-1">
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${progress}%`,
                            background: levelIdx === 0
                              ? '#a78bfa'
                              : levelIdx === 1
                              ? '#38bdf8'
                              : levelIdx === 2
                              ? '#34d399'
                              : levelIdx === 3
                              ? '#fb923c'
                              : '#f472b6',
                          }}
                        />
                      </div>
                    </div>
                    <span className={`text-lg ${levelIdx >= 4 ? '' : 'opacity-30'}`}>🚀</span>
                  </div>

                  {/* Niveau + compteur sur 1 ligne */}
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`text-xs font-semibold ${dyn.color.split(' ')[0]}`}>{dyn.label}</span>
                    <span className="text-xs text-gray-500">
                      {axe.actions.length} action{axe.actions.length !== 1 ? 's' : ''}
                      {axe.actions.length === 0 && (
                        <span className={`font-medium ml-1 ${dyn.color.split(' ')[0]}`}>· commence !</span>
                      )}
                      {axe.actions.length > 0 && axe.actions.length < 9 && (
                        <span className={`font-medium ml-1 ${dyn.color.split(' ')[0]}`}>· encore {dyn.delta} pour {MARKERS[levelIdx + 1]?.icon}</span>
                      )}
                    </span>
                  </div>
                 </div>

                  {/* Séparateur + titre Actions menées (fixe) */}
                  <div className="border-t border-current/10 pt-3 mt-2 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700">
                        Actions menées
                        {axe.actions.length > 0 && (
                          <span className="ml-1.5 text-xs font-normal text-gray-500">({axe.actions.length})</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Liste d'actions (scrollable) */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {axe.actions.length === 0 && (
                      <p className="text-xs text-gray-500 italic">Aucune action enregistrée</p>
                    )}

                    {(() => {
                      // Tri chronologique pour attribuer les rangs, puis affichage antéchronologique
                      const chronoSorted = [...axe.actions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      const rankMap = new Map(chronoSorted.map((a, i) => [a.id, i + 1]))
                      const displaySorted = [...axe.actions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

                      return (
                        <ul className="space-y-2">
                          {displaySorted.map((action, actionIndex) => {
                            const rank = rankMap.get(action.id) ?? 1
                            const isNewlyAdded = highlightAxeId === axe.id && actionIndex === 0
                            return (
                              <li key={action.id} className={`flex items-start gap-2 rounded-lg px-1 -mx-1 transition-colors duration-1000 ${isNewlyAdded ? 'bg-indigo-100' : ''}`}>
                                <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm bg-white/60">{getActionPhaseIcon(rank)}</span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-gray-700">{action.description}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-500">{formatDate(action.created_at)}</span>
                                    <ActionFeedback
                                      actionId={action.id}
                                      feedback={feedbackMap[action.id] ?? emptyFeedback}
                                      canInteract={false}
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <button
                                    onClick={() => { setEditingActionId(action.id); setEditingText(action.description) }}
                                    className="text-gray-300 hover:text-indigo-500 transition-colors p-0.5"
                                    title="Modifier"
                                  >
                                    <Pencil size={13} />
                                  </button>
                                  <button
                                    onClick={() => setDeletingActionId(action.id)}
                                    className="text-gray-300 hover:text-red-400 transition-colors p-0.5"
                                    title="Supprimer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </li>
                            )
                          })}
                        </ul>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Indicateurs dots */}
          {axes.length > 1 && (
            <div className="flex items-center justify-center gap-1.5">
              {axes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    const container = scrollContainerRef.current
                    if (container && container.children[i]) {
                      (container.children[i] as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
                    }
                  }}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    i === safeIndex
                      ? 'w-6 bg-indigo-500'
                      : 'w-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {/* Modale ajout d'action */}
      {addActionAxeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddActionAxeId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Nouvelle action</h3>
            <p className="text-sm text-gray-500">Décrivez une action concrète que vous avez menée pour progresser sur cet axe.</p>
            <form
              onSubmit={(e) => handleCreateAction(e, addActionAxeId)}
              className="space-y-4"
            >
              <textarea
                name="description"
                required
                className="input w-full h-24 resize-none"
                placeholder="Ex: J'ai confié la préparation de la réunion à Julie"
                autoFocus
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setAddActionAxeId(null)} className="btn-secondary px-5">
                  Annuler
                </button>
                <button type="submit" disabled={isPending} className="btn-primary px-5">
                  {isPending ? 'Enregistrement...' : 'Ajouter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale d'édition */}
      {editingActionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingActionId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Modifier l&apos;action</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                startTransition(async () => {
                  await updateAction(editingActionId, editingText)
                  setEditingActionId(null)
                })
              }}
              className="space-y-4"
            >
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="input w-full h-24 resize-none"
                autoFocus
                required
              />
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setEditingActionId(null)} className="btn-secondary px-5">
                  Annuler
                </button>
                <button type="submit" disabled={isPending} className="btn-primary px-5">
                  {isPending ? 'Enregistrement...' : 'Valider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale suppression axe — Étape 1 : Avertissement */}
      {deletingAxeStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingAxeStep(0)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <span className="text-xl">⚠️</span>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Attention</h3>
                <p className="text-sm text-gray-500">Cette opération va supprimer l&apos;intégralité de l&apos;axe de progrès, toutes ses actions et tous les commentaires associés.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingAxeStep(0)} className="btn-secondary px-5">
                Annuler
              </button>
              <button
                onClick={() => setDeletingAxeStep(2)}
                className="px-5 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors"
              >
                J&apos;ai compris
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale suppression axe — Étape 2 : Confirmation définitive */}
      {deletingAxeStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingAxeStep(0)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Confirmer la suppression</h3>
                <p className="text-sm text-gray-500">L&apos;axe « {deletingAxe?.subject} » sera définitivement supprimé. Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingAxeStep(0)} className="btn-secondary px-5">
                Annuler
              </button>
              <button
                onClick={() => {
                  if (!deletingAxe) return
                  const axeIdx = axes.findIndex(a => a.id === deletingAxe.id)
                  startTransition(() => { deleteAxe(deletingAxe.id) })
                  setCurrentIndex(Math.max(0, axeIdx - 1))
                  setDeletingAxeStep(0)
                  setDeletingAxeId(null)
                }}
                className="px-5 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Célébration de niveau */}
      {levelUpInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setLevelUpInfo(null)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-xs p-8 text-center">
            <div className="text-7xl animate-level-up mb-4">{levelUpInfo.icon}</div>
            <div className="animate-level-up-text">
              <p className="text-xl font-bold text-gray-900 mb-1">Niveau {levelUpInfo.label}</p>
              <p className="text-lg font-semibold text-gray-500">débloqué !</p>
              <p className="text-sm text-gray-500 mt-3">Continue comme ça 💪</p>
            </div>
          </div>
        </div>
      )}

      {/* Modale de suppression d'action */}
      {deletingActionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingActionId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Supprimer cette action ?</h3>
                <p className="text-sm text-gray-500">Cette action sera définitivement supprimée.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingActionId(null)} className="btn-secondary px-5">
                Annuler
              </button>
              <button
                onClick={() => {
                  const actionId = deletingActionId
                  if (!actionId) return
                  setDeletingActionId(null)
                  startTransition(async () => {
                    await deleteAction(actionId)
                  })
                }}
                className="px-5 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
      {/* FAB supprimé — remplacé par bouton full-width en haut */}

      {/* Quick Add Action Modal */}
      <QuickAddAction
        axes={axes.map(a => ({ id: a.id, subject: a.subject, completedCount: a.actions.length }))}
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSuccess={(axeId) => {
          // Scroll vers la carte de l'axe concerné
          const axeIndex = axes.findIndex(a => a.id === axeId)
          if (axeIndex >= 0) {
            setCurrentIndex(axeIndex)
            const container = scrollContainerRef.current
            if (container && container.children[axeIndex]) {
              (container.children[axeIndex] as HTMLElement).scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
            }
          }
          // Flash sur la dernière action ajoutée
          setHighlightAxeId(axeId)
          setTimeout(() => setHighlightAxeId(null), 2000)
          router.refresh()
        }}
      />

      {/* Modale d'édition d'axe */}
      {editingAxe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingAxe(null)} />
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4">
              <h2 className="text-white font-bold text-base">✏️ Modifier l&apos;axe de progrès</h2>
              <p className="text-indigo-100 text-xs mt-0.5">Modifie les détails de ton axe</p>
            </div>

            <form onSubmit={handleUpdateAxe} className="p-5 space-y-5">
              {/* Sujet */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intitulé de l&apos;axe</label>
                <input
                  value={editAxeSubject}
                  onChange={(e) => setEditAxeSubject(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Moyens envisagés <span className="font-normal text-gray-500">(optionnel)</span>
                </label>
                <textarea
                  value={editAxeDescription}
                  onChange={(e) => setEditAxeDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none h-20"
                />
              </div>

              {/* Difficulté */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block">Niveau de difficulté</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'facile' as const, emoji: '🟢', label: 'Facile' },
                    { key: 'moyen' as const, emoji: '🟡', label: 'Moyen' },
                    { key: 'difficile' as const, emoji: '🔴', label: 'Difficile' },
                  ]).map(({ key, emoji, label }) => {
                    const isSelected = editAxeDifficulty === key
                    return (
                      <label key={key} className="cursor-pointer">
                        <input
                          type="radio" name="edit-difficulty" value={key} className="sr-only"
                          checked={isSelected}
                          onChange={() => setEditAxeDifficulty(key)}
                        />
                        <div className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 shadow-md scale-[1.03]'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                          <span className="text-lg">{emoji}</span>
                          <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-500'}`}>{label}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              {/* Boutons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  {isPending ? 'Enregistrement...' : '✓ Valider'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAxe(null)}
                  className="px-5 py-3 rounded-xl font-semibold text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
