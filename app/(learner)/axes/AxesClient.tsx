'use client'

import { useState, useEffect, useTransition } from 'react'
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
  'bg-sky-100',      // rank 1-2 → Essai
  'bg-emerald-100',  // rank 3-4 → Habitude
  'bg-orange-100',   // rank 5-6 → Réflexe
  'bg-rose-100',     // rank 7+  → Maîtrise
] as const
function getActionPhaseBg(rank: number) {
  if (rank <= 2) return ACTION_PHASE_COLORS[0]
  if (rank <= 4) return ACTION_PHASE_COLORS[1]
  if (rank <= 6) return ACTION_PHASE_COLORS[2]
  return ACTION_PHASE_COLORS[3]
}

export default function AxesClient({ axes, initialIndex = 0, feedbackMap = {}, onboarding, userId, groupTheme }: { axes: AxeWithActions[], initialIndex?: number, feedbackMap?: Record<string, ActionFeedbackData>, onboarding?: string, userId?: string, groupTheme?: string | null }) {
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
  const [expandedAxes, setExpandedAxes] = useState<Set<string>>(new Set())

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

  const MAX_VISIBLE_ACTIONS = 3

  function toggleAxeExpand(axeId: string) {
    setExpandedAxes(prev => {
      const next = new Set(prev)
      if (next.has(axeId)) next.delete(axeId)
      else next.add(axeId)
      return next
    })
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] pb-[env(safe-area-inset-bottom)]">
      {/* ── Bloc sticky : header navy + bouton nouvelle action ── */}
      <div className="shrink-0 space-y-3 pb-3">
        <div
          className="rounded-[28px] p-4 relative overflow-hidden"
          style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
        >
          <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />
          <div className="relative flex items-center justify-between">
            <div>
              <h1 className="text-xl font-extrabold text-white">Mes actions</h1>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{axes.length} axe{axes.length !== 1 ? 's' : ''} de progrès</p>
            </div>
            {axes.length < 3 && !isOnboardingCreate && (
              <button
                onClick={() => setShowAxeForm(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/90 hover:bg-white transition-colors"
                style={{ color: '#1a1a2e' }}
              >
                <Plus size={14} /> Ajouter un axe
              </button>
            )}
          </div>
        </div>

        {/* Bouton Nouvelle Action */}
        {axes.length > 0 && !isOnboardingMode && (
          <button
            onClick={() => setQuickAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl active:scale-[0.97] transition-transform"
            style={{
              background: '#fbbf24',
              color: '#1a1a2e',
              boxShadow: '0 4px 15px rgba(251, 191, 36, 0.35)',
            }}
          >
            <Plus size={20} strokeWidth={2.5} />
            <span className="text-[15px] font-bold">Nouvelle action</span>
          </button>
        )}
      </div>

      {/* Formulaire nouvel axe */}
      {showAxeForm && (
        <div className="rounded-[22px] bg-white shadow-lg overflow-hidden" style={{ border: '2px solid #f0ebe0' }}>
          {/* Header gradient */}
          <div className="px-5 py-4" style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}>
            <h2 className="text-white font-bold text-base">🎯 Nouvel axe de progrès</h2>
            <p className="text-white/50 text-xs mt-0.5">Définis un domaine à améliorer</p>
          </div>

          <form onSubmit={handleCreateAxe} className="p-5 space-y-5">
            {/* Sujet */}
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intitulé de l&apos;axe</label>
              <input
                name="subject"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20 outline-none transition-all placeholder:text-gray-500"
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
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20 outline-none transition-all resize-none h-20 placeholder:text-gray-500"
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
                          ? 'border-[#fbbf24] bg-[#fffbeb] shadow-md scale-[1.03]'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                        <span className="text-lg">{emoji}</span>
                        <span className={`text-xs font-semibold ${isSelected ? 'text-[#1a1a2e]' : 'text-gray-500'}`}>{label}</span>
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
                style={{ background: '#fbbf24', color: '#1a1a2e' }}
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

      {/* ── Liste verticale des axes (scrollable) ── */}
      {axes.length > 0 && !isOnboardingCreate && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-4">
          {axes.map((axe, axeIndex) => {
            const dyn = getDynamique(axe.actions.length)
            const progress = getProgress(axe.actions.length)
            const levelIdx = getCurrentLevelIndex(axe.actions.length)
            const level = getCurrentLevel(axe.actions.length)
            const LEVEL_BORDER_COLORS = ['#94a3b8', '#38bdf8', '#10b981', '#f59e0b', '#fb7185']
            const LEVEL_BAR_COLORS = ['#94a3b8', '#38bdf8', '#34d399', '#fb923c', '#f472b6']
            const borderColor = LEVEL_BORDER_COLORS[levelIdx] ?? LEVEL_BORDER_COLORS[0]
            const isExpanded = expandedAxes.has(axe.id)

            // Tri chronologique pour les rangs, antichrono pour l'affichage
            const chronoSorted = [...axe.actions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            const rankMap = new Map(chronoSorted.map((a, i) => [a.id, i + 1]))
            const displaySorted = [...axe.actions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            const visibleActions = isExpanded ? displaySorted : displaySorted.slice(0, MAX_VISIBLE_ACTIONS)
            const hiddenCount = displaySorted.length - MAX_VISIBLE_ACTIONS

            return (
              <div
                key={axe.id}
                className="rounded-[22px] bg-white p-4"
                style={{ border: `2px solid ${borderColor}` }}
              >
                {/* Titre + boutons edit/delete */}
                <div className="flex items-center gap-2">
                  <span className="axe-num shrink-0" style={{ background: borderColor, color: '#fff' }}>
                    {axeIndex + 1}
                  </span>
                  <p className="font-bold text-sm leading-snug line-clamp-1 flex-1" style={{ color: '#1a1a2e' }}>{axe.subject}</p>
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

                {/* Barre de progression */}
                <div className="mt-3 flex items-center gap-2.5">
                  <span className="text-lg">{level.icon}</span>
                  <div className="flex-1">
                    <div className="bar-bg">
                      <div
                        className="bar-fill transition-all duration-700"
                        style={{
                          width: `${progress}%`,
                          background: LEVEL_BAR_COLORS[levelIdx] ?? LEVEL_BAR_COLORS[0],
                        }}
                      />
                    </div>
                  </div>
                  <span className={`text-lg ${levelIdx >= 4 ? '' : 'opacity-30'}`}>🚀</span>
                </div>

                {/* Niveau + compteur */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold" style={{ color: '#1a1a2e' }}>{dyn.icon} {dyn.label}</span>
                  <span className="text-[11px]" style={{ color: '#a0937c' }}>
                    {axe.actions.length} action{axe.actions.length !== 1 ? 's' : ''}
                    {axe.actions.length === 0 && (
                      <span className="font-semibold ml-1" style={{ color: '#92400e' }}>· commence !</span>
                    )}
                    {axe.actions.length > 0 && axe.actions.length < 9 && (
                      <span className="font-semibold ml-1" style={{ color: '#92400e' }}>· encore {dyn.delta} pour {MARKERS[levelIdx + 1]?.icon}</span>
                    )}
                  </span>
                </div>

                {/* Séparateur + Actions menées */}
                {axe.actions.length > 0 && (
                  <div className="pt-3 mt-2" style={{ borderTop: '2px solid #f0ebe0' }}>
                    <ul className="space-y-2">
                      {visibleActions.map((action, actionIndex) => {
                        const rank = rankMap.get(action.id) ?? 1
                        const isNewlyAdded = highlightAxeId === axe.id && actionIndex === 0
                        return (
                          <li key={action.id} className={`flex items-start gap-2 rounded-lg px-1 -mx-1 transition-colors duration-1000 ${isNewlyAdded ? 'bg-[#fffbeb]' : ''}`}>
                            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full text-sm" style={{ background: '#f5f0e8' }}>{getActionPhaseIcon(rank)}</span>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm text-gray-700">{action.description}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500">{formatDate(action.created_at)}</span>
                                <ActionFeedback
                                  actionId={action.id}
                                  feedback={feedbackMap[action.id] ?? emptyFeedback}
                                  canInteract={true}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 mt-0.5">
                              <button
                                onClick={() => { setEditingActionId(action.id); setEditingText(action.description) }}
                                className="text-gray-300 hover:text-[#1a1a2e] transition-colors p-0.5"
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

                    {/* Voir plus / Voir moins */}
                    {hiddenCount > 0 && (
                      <button
                        onClick={() => toggleAxeExpand(axe.id)}
                        className="flex items-center gap-1 text-xs font-medium transition-colors mt-2 mx-auto"
                        style={{ color: '#92400e' }}
                      >
                        {isExpanded ? '▲ Voir moins' : `▼ Voir ${hiddenCount} de plus`}
                      </button>
                    )}
                  </div>
                )}

                {axe.actions.length === 0 && (
                  <p className="text-xs text-gray-500 italic mt-3 pt-3" style={{ borderTop: '2px solid #f0ebe0' }}>Aucune action enregistrée</p>
                )}
              </div>
            )
          })}
        </div>
      )}
      {/* Modale ajout d'action */}
      {addActionAxeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddActionAxeId(null)} />
          <div className="relative bg-white rounded-[28px] shadow-xl w-full max-w-md p-6 space-y-4" style={{ border: '2px solid #f0ebe0' }}>
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
          <div className="relative bg-white rounded-[28px] shadow-xl w-full max-w-md p-6 space-y-4" style={{ border: '2px solid #f0ebe0' }}>
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
          <div className="relative bg-white rounded-[28px] shadow-xl w-full max-w-sm p-6 space-y-4" style={{ border: '2px solid #f0ebe0' }}>
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
          <div className="relative bg-white rounded-[28px] shadow-xl w-full max-w-sm p-6 space-y-4" style={{ border: '2px solid #f0ebe0' }}>
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
                  startTransition(() => { deleteAxe(deletingAxe.id) })
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
          <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs p-8 text-center" style={{ border: '2px solid #f0ebe0' }}>
            <div className="text-7xl animate-level-up mb-4">{levelUpInfo.icon}</div>
            <div className="animate-level-up-text">
              <p className="text-xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Niveau {levelUpInfo.label}</p>
              <p className="text-lg font-semibold" style={{ color: '#a0937c' }}>débloqué !</p>
              <p className="text-sm mt-3" style={{ color: '#a0937c' }}>Continue comme ça 💪</p>
            </div>
          </div>
        </div>
      )}

      {/* Modale de suppression d'action */}
      {deletingActionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeletingActionId(null)} />
          <div className="relative bg-white rounded-[28px] shadow-xl w-full max-w-sm p-6 space-y-4" style={{ border: '2px solid #f0ebe0' }}>
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
        axes={axes.map(a => ({ id: a.id, subject: a.subject, description: a.description, completedCount: a.actions.length }))}
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onSuccess={(axeId) => {
          // Flash sur la dernière action ajoutée
          setHighlightAxeId(axeId)
          setTimeout(() => setHighlightAxeId(null), 2000)
          router.refresh()
        }}
        groupTheme={groupTheme}
      />

      {/* Modale d'édition d'axe */}
      {editingAxe && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditingAxe(null)} />
          <div className="relative w-full max-w-md rounded-[28px] bg-white shadow-xl overflow-hidden" style={{ border: '2px solid #f0ebe0' }}>
            {/* Header gradient */}
            <div className="px-5 py-4" style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}>
              <h2 className="text-white font-bold text-base">✏️ Modifier l&apos;axe de progrès</h2>
              <p className="text-white/50 text-xs mt-0.5">Modifie les détails de ton axe</p>
            </div>

            <form onSubmit={handleUpdateAxe} className="p-5 space-y-5">
              {/* Sujet */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intitulé de l&apos;axe</label>
                <input
                  value={editAxeSubject}
                  onChange={(e) => setEditAxeSubject(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20 outline-none transition-all"
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
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20 outline-none transition-all resize-none h-20"
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
                            ? 'border-[#fbbf24] bg-[#fffbeb] shadow-md scale-[1.03]'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                          <span className="text-lg">{emoji}</span>
                          <span className={`text-xs font-semibold ${isSelected ? 'text-[#1a1a2e]' : 'text-gray-500'}`}>{label}</span>
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
                  style={{ background: '#fbbf24', color: '#1a1a2e' }}
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
