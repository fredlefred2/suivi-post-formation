'use client'

import { useState, useRef, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Pencil } from 'lucide-react'
import { createAxe, deleteAxe, updateAxe, createAction, updateAction, deleteAction } from './actions'
import type { Axe, Action, ActionFeedbackData, Difficulty } from '@/lib/types'
import { MessageCircle, Bell } from 'lucide-react'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'
import QuickAddAction from '@/app/components/QuickAddAction'
import { acknowledgeStep } from '@/lib/onboarding'
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
  const isHighlightAdd = onboarding === 'highlight-add'
  const isHighlightDelete = onboarding === 'highlight-delete'
  const isAutoDemo = onboarding === 'auto-demo'
  const isOnboardingMode = isOnboardingCreate || isAutoDemo || isHighlightAdd || isHighlightDelete
  const [showAxeForm, setShowAxeForm] = useState(isOnboardingCreate)
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null)

  // Disable navigation menus during onboarding phases on /axes
  useEffect(() => {
    if (isOnboardingMode) setIsOnboarding(true)
    return () => setIsOnboarding(false)
  }, [isOnboardingMode, setIsOnboarding])
  const [addActionAxeId, setAddActionAxeId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  // Force index 0 during highlight/demo onboarding modes
  const [currentIndex, setCurrentIndex] = useState(isHighlightAdd || isHighlightDelete || isAutoDemo ? 0 : initialIndex)
  // Auto-demo state
  const [demoPhase, setDemoPhase] = useState(0) // 0=creating, 1=add, 2=edit, 3=feedback, 4=delete
  const [demoActionId, setDemoActionId] = useState<string | null>(null)
  const demoCreatedRef = useRef(false)
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

  // Auto-demo : créer automatiquement une action d'exemple
  useEffect(() => {
    if (!isAutoDemo || axes.length === 0 || demoCreatedRef.current) return
    demoCreatedRef.current = true
    const fd = new FormData()
    fd.set('axe_id', axes[0].id)
    fd.set('description', "J'ai préparé le compte-rendu de la réunion")
    startTransition(async () => {
      const result = await createAction(fd)
      if (result?.id) setDemoActionId(result.id)
      setDemoPhase(1)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoDemo])

  // Auto-demo : finaliser la démo
  async function finishDemo() {
    if (demoActionId) {
      startTransition(async () => {
        await deleteAction(demoActionId)
        if (userId) {
          acknowledgeStep('first-action', userId)
          acknowledgeStep('feedback-intro', userId)
          acknowledgeStep('edit-delete', userId)
        }
        router.push('/dashboard')
      })
    } else {
      if (userId) {
        acknowledgeStep('first-action', userId)
        acknowledgeStep('feedback-intro', userId)
        acknowledgeStep('edit-delete', userId)
      }
      router.push('/dashboard')
    }
  }

  // Demo phase data (6 phases)
  const demoPhases = [
    { icon: '➕', text: 'Le bouton « Ajouter » permet de créer des actions concrètes pour chaque axe.' },
    { icon: '✏️', text: 'Le bouton ✏️ permet de modifier le texte d\'une action à tout moment.' },
    { icon: '💬', text: 'Ton formateur et tes coéquipiers peuvent ❤️ liker et 💬 commenter tes actions.' },
    { icon: '🗑️', text: 'Le bouton 🗑️ permet de supprimer une action.' },
    { icon: '💬', text: 'L\'icône message en haut à droite te permet d\'envoyer un message privé à ton formateur.', highlight: 'message' },
    { icon: '🔔', text: 'La cloche te notifie des nouveautés : likes, commentaires et messages de ton formateur.', highlight: 'bell' },
  ]

  // Scroll initial vers l'index demandé
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || axes.length === 0) return
    const targetIndex = isHighlightAdd || isHighlightDelete || isAutoDemo ? 0 : initialIndex
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
    startTransition(async () => {
      const result = await createAxe(formData)
      if (result?.error) setError(result.error)
      else if (isOnboardingCreate) {
        router.push('/dashboard')
      } else {
        setShowAxeForm(false)
        setSelectedDifficulty(null)
        setCurrentIndex(axes.length)
      }
    })
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

      if (isHighlightAdd) {
        router.push('/dashboard')
        return
      }

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
    <div className={`space-y-6 ${isAutoDemo ? 'pb-28' : 'pb-4'}`}>
      <div className="flex items-center justify-between">
        <h1 className="page-title">Mes actions de progrès</h1>
        {axes.length < 3 && !isOnboardingCreate && (
          <button onClick={() => setShowAxeForm(true)} className="btn-primary">
            <Plus size={16} /> Ajouter un axe
          </button>
        )}
      </div>

      {isHighlightAdd && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-xl">⚡</span>
          <p className="text-sm font-semibold text-amber-800">Cliquez sur le bouton « + Ajouter » qui clignote ci-dessous</p>
        </div>
      )}
      {isHighlightDelete && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-xl">🗑️</span>
          <p className="text-sm font-semibold text-amber-800">Cliquez sur l&apos;icône de suppression 🗑️ qui clignote</p>
        </div>
      )}
      {isAutoDemo && demoPhase === 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-2.5 flex items-center gap-3">
          <span className="text-xl animate-spin">⏳</span>
          <p className="text-sm font-semibold text-indigo-800">Préparation de la démo...</p>
        </div>
      )}

      {/* Formulaire nouvel axe */}
      {showAxeForm && (
        <div className="card border-indigo-100 border-2">
          <h2 className="section-title mb-4">Nouvel axe de progrès</h2>
          <form onSubmit={handleCreateAxe} className="space-y-4">
            <div>
              <label className="label">Sujet / intitulé de l&apos;axe *</label>
              <input name="subject" required className="input" placeholder="Ex: Déléguer efficacement" />
            </div>
            <div>
              <label className="label">Description (optionnel)</label>
              <textarea name="description" className="input h-20 resize-none" placeholder="Décrivez ce que vous souhaitez améliorer..." />
            </div>
            <div>
              <label className="label">Niveau de difficulté de cet axe *</label>
              <p className="text-xs text-gray-400 mb-2">Ce niveau reste fixe et ne sera pas modifié lors des check-ins.</p>
              <div className="flex gap-3 mt-1">
                {(['facile', 'moyen', 'difficile'] as const).map((d) => {
                  const isSelected = selectedDifficulty === d
                  return (
                    <label key={d} className="flex-1 cursor-pointer">
                      <input
                        type="radio" name="difficulty" value={d} required className="sr-only"
                        checked={selectedDifficulty === d}
                        onChange={() => setSelectedDifficulty(d)}
                      />
                      <div className={`text-center py-4 border-2 rounded-xl transition-all duration-200 ${
                        isSelected
                          ? `${DIFFICULTY_COLORS[d]} scale-105 shadow-lg`
                          : 'border-gray-200 bg-white text-gray-600'
                      }`}>
                        <p className="text-xs font-bold">{DIFFICULTY_LABELS[d]}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              {!isOnboardingCreate && (
                <button type="button" onClick={() => { setShowAxeForm(false); setError(null) }} className="btn-secondary">
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
          <p className="text-gray-400 mb-4">Vous n&apos;avez pas encore défini d&apos;axes de progrès.</p>
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
            className="flex gap-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2"
          >
            {axes.map((axe, axeIndex) => {
              const dyn = getDynamique(axe.actions.length)
              const progress = getProgress(axe.actions.length)
              const levelIdx = getCurrentLevelIndex(axe.actions.length)
              const level = getCurrentLevel(axe.actions.length)
              return (
                <div
                  key={axe.id}
                  className={`snap-center shrink-0 w-[85vw] max-w-[420px] rounded-2xl border-2 p-4 flex flex-col max-h-[calc(100dvh-11rem)] ${dyn.color}`}
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

                  {/* Moyens / description */}
                  <div className="h-[32px] mt-1">
                    {axe.description ? (
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{axe.description}</p>
                    ) : (
                      <p className="text-xs text-gray-400 italic">—</p>
                    )}
                  </div>

                  {/* Niveau actuel - hero */}
                  <div className="flex items-center justify-center h-[40px] gap-2">
                    <span className="text-3xl drop-shadow-sm">{level.icon}</span>
                    <span className="text-sm font-bold text-gray-700">{level.label}</span>
                  </div>

                  {/* Piste de progression avec jalons */}
                  <div className="relative h-[20px] mx-1">
                    <div className="absolute top-[6px] inset-x-0 h-2 bg-white/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${progress}%`,
                          background: levelIdx === 0
                            ? '#94a3b8'
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
                    <div className="flex justify-between absolute inset-x-0 top-0">
                      {MARKERS.map((m, i) => {
                        const reached = i <= levelIdx
                        const isCurrent = i === levelIdx
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-center rounded-full transition-all ${
                              isCurrent
                                ? 'w-5 h-5 bg-white shadow-md ring-2 ring-current/40 text-sm z-10'
                                : reached
                                ? 'w-4 h-4 mt-0.5 bg-white/90 shadow-sm text-[11px]'
                                : 'w-4 h-4 mt-0.5 bg-white/40 text-[11px]'
                            }`}
                          >
                            <span className={reached ? '' : 'opacity-30 grayscale text-[10px]'}>{m.icon}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Compteur actions + delta */}
                  <div className="h-[20px] flex items-center justify-center mt-1">
                    <p className="text-center text-xs font-semibold text-gray-600">
                      {axe.actions.length} action{axe.actions.length !== 1 ? 's' : ''}
                      {axe.actions.length < 9 && (
                        <span className="font-normal text-gray-400"> · encore {9 - axe.actions.length} pour 🚀</span>
                      )}
                    </p>
                  </div>
                 </div>

                  {/* Séparateur + titre Actions menées (fixe) */}
                  <div className="border-t border-current/10 pt-3 mt-2 shrink-0">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium text-gray-700">
                        Actions menées
                        {axe.actions.length > 0 && (
                          <span className="ml-1.5 text-xs font-normal text-gray-400">({axe.actions.length})</span>
                        )}
                      </p>
                      {/* Bouton Ajouter visible uniquement pendant l'onboarding */}
                      {(isHighlightAdd || (isAutoDemo && demoPhase === 1)) && axeIndex === 0 && (
                        <button
                          onClick={() => setAddActionAxeId(axe.id)}
                          className="btn-primary text-xs px-3 py-1.5 onboarding-pulse"
                        >
                          <Plus size={14} /> Ajouter
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Liste d'actions (scrollable) */}
                  <div className="flex-1 min-h-0 overflow-y-auto">
                    {axe.actions.length === 0 && (
                      <p className="text-xs text-gray-400 italic">Aucune action enregistrée</p>
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
                            // Pulse conditionnels pour l'onboarding
                            const shouldPulseEdit = isAutoDemo && demoPhase === 2 && axeIndex === 0 && actionIndex === 0
                            const shouldPulseFeedback = isAutoDemo && demoPhase === 3 && axeIndex === 0 && actionIndex === 0
                            const shouldPulseDelete = (isHighlightDelete || (isAutoDemo && demoPhase === 4)) && axeIndex === 0 && actionIndex === 0
                            const isNewlyAdded = highlightAxeId === axe.id && actionIndex === 0
                            return (
                              <li key={action.id} className={`flex items-start gap-2 rounded-lg px-1 -mx-1 transition-colors duration-1000 ${isNewlyAdded ? 'bg-indigo-100' : ''}`}>
                                <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm bg-white/60">{getActionPhaseIcon(rank)}</span>
                                <div className="flex-1 min-w-0">
                                  <span className="text-sm text-gray-700">{action.description}</span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-gray-400">{formatDate(action.created_at)}</span>
                                    <div className={shouldPulseFeedback ? 'rounded-lg onboarding-pulse px-1' : ''}>
                                      <ActionFeedback
                                        actionId={action.id}
                                        feedback={feedbackMap[action.id] ?? emptyFeedback}
                                        canInteract={false}
                                      />
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <button
                                    onClick={() => { if (!isAutoDemo) { setEditingActionId(action.id); setEditingText(action.description) } }}
                                    className={`text-gray-300 hover:text-indigo-500 transition-colors ${shouldPulseEdit ? 'p-1.5 rounded-full onboarding-pulse' : 'p-0.5'}`}
                                    title="Modifier"
                                  >
                                    <Pencil size={shouldPulseEdit ? 16 : 13} />
                                  </button>
                                  <button
                                    onClick={() => { if (!isAutoDemo) setDeletingActionId(action.id) }}
                                    className={`text-gray-300 hover:text-red-400 transition-colors ${shouldPulseDelete ? 'p-1.5 rounded-full onboarding-pulse' : 'p-0.5'}`}
                                    title="Supprimer"
                                  >
                                    <Trash2 size={shouldPulseDelete ? 16 : 13} />
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

      {/* Bandeau auto-demo fixe en bas */}
      {isAutoDemo && demoPhase >= 1 && demoPhase <= 6 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-gray-200 p-4 flex items-center gap-3 animate-fade-in-up">
            {demoPhases[demoPhase - 1].highlight === 'message' ? (
              <MessageCircle size={24} className="shrink-0 text-indigo-500 animate-pulse" />
            ) : demoPhases[demoPhase - 1].highlight === 'bell' ? (
              <Bell size={24} className="shrink-0 text-amber-500 animate-pulse" />
            ) : (
              <span className="text-2xl shrink-0">{demoPhases[demoPhase - 1].icon}</span>
            )}
            <p className="text-sm text-gray-700 flex-1">{demoPhases[demoPhase - 1].text}</p>
            <button
              onClick={() => {
                if (demoPhase < 6) {
                  setDemoPhase(demoPhase + 1)
                } else {
                  finishDemo()
                }
              }}
              disabled={isPending}
              className="btn-primary text-xs px-4 py-2 shrink-0"
            >
              {isPending ? '...' : demoPhase < 6 ? 'Suivant →' : 'Compris !'}
            </button>
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
              <p className="text-lg font-semibold text-indigo-600">débloqué !</p>
              <p className="text-sm text-gray-400 mt-3">Continue comme ça 💪</p>
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
                    if (isHighlightDelete && userId) {
                      acknowledgeStep('edit-delete', userId)
                      router.push('/dashboard')
                    }
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
      {/* FAB — Bouton flottant "Ajouter une action" */}
      {axes.length > 0 && !isOnboardingMode && (
        <button
          onClick={() => setQuickAddOpen(true)}
          className="fixed bottom-20 right-4 sm:hidden z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white active:scale-90 transition-transform"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)',
            boxShadow: '0 4px 15px rgba(79, 70, 229, 0.4)',
          }}
          title="Ajouter une action"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      )}

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
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 text-lg">Modifier l&apos;axe de progrès</h3>
            <form onSubmit={handleUpdateAxe} className="space-y-4">
              <div>
                <label className="label">Sujet / intitulé de l&apos;axe *</label>
                <input
                  value={editAxeSubject}
                  onChange={(e) => setEditAxeSubject(e.target.value)}
                  required
                  className="input"
                />
              </div>
              <div>
                <label className="label">Description (optionnel)</label>
                <textarea
                  value={editAxeDescription}
                  onChange={(e) => setEditAxeDescription(e.target.value)}
                  className="input h-20 resize-none"
                />
              </div>
              <div>
                <label className="label">Niveau de difficulté *</label>
                <div className="flex gap-3 mt-1">
                  {(['facile', 'moyen', 'difficile'] as const).map((d) => {
                    const isSelected = editAxeDifficulty === d
                    return (
                      <label key={d} className="flex-1 cursor-pointer">
                        <input
                          type="radio" name="edit-difficulty" value={d} className="sr-only"
                          checked={editAxeDifficulty === d}
                          onChange={() => setEditAxeDifficulty(d)}
                        />
                        <div className={`text-center py-4 border-2 rounded-xl transition-all duration-200 ${
                          isSelected
                            ? `${DIFFICULTY_COLORS[d]} scale-105 shadow-lg`
                            : 'border-gray-200 bg-white text-gray-600'
                        }`}>
                          <p className="text-xs font-bold">{DIFFICULTY_LABELS[d]}</p>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setEditingAxe(null)} className="btn-secondary px-5">
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
    </div>
  )
}
