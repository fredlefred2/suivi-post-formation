'use client'

import { useState, useRef, useTransition } from 'react'
import { Plus, Trash2, Pencil, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { createAxe, deleteAxe, createAction, updateAction, deleteAction } from './actions'
import type { Axe, Action, ActionFeedbackData } from '@/lib/types'
import { DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'

type AxeWithActions = Axe & { actions: Action[] }

function getDynamique(count: number) {
  if (count === 0) return { label: 'Ancrage',     icon: '📍', color: 'text-gray-400   bg-gray-50   border-gray-200',   delta: 1 }
  if (count <= 2) return { label: 'Impulsion',   icon: '👣', color: 'text-teal-700   bg-teal-50   border-teal-200',   delta: 3 - count }
  if (count <= 5) return { label: 'Rythme',      icon: '🥁', color: 'text-blue-700   bg-blue-50   border-blue-200',   delta: 6 - count }
  if (count <= 8) return { label: 'Intensité',   icon: '🔥', color: 'text-orange-700 bg-orange-50 border-orange-200', delta: 9 - count }
  return               { label: 'Propulsion',  icon: '🚀', color: 'text-purple-700 bg-purple-50 border-purple-200', delta: 0 }
}

// Icône de phase selon le rang chronologique de l'action (1-indexed)
function getActionPhaseIcon(rank: number) {
  if (rank <= 2) return '👣'
  if (rank <= 5) return '🥁'
  if (rank <= 8) return '🔥'
  return '🚀'
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const emptyFeedback: ActionFeedbackData = { likes_count: 0, comments_count: 0, liked_by_me: false, likers: [], comments: [] }

export default function AxesClient({ axes, initialIndex = 0, feedbackMap = {} }: { axes: AxeWithActions[], initialIndex?: number, feedbackMap?: Record<string, ActionFeedbackData> }) {
  const [showAxeForm, setShowAxeForm] = useState(false)
  const [addActionAxeId, setAddActionAxeId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [editingActionId, setEditingActionId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [deletingActionId, setDeletingActionId] = useState<string | null>(null)
  const [deletingAxeStep, setDeletingAxeStep] = useState<0 | 1 | 2>(0) // 0=fermé, 1=avertissement, 2=confirmation
  const touchStartX = useRef<number>(0)

  // Index sécurisé (évite les débordements si un axe est supprimé)
  const safeIndex = Math.max(0, Math.min(currentIndex, axes.length - 1))

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (delta > 50 && safeIndex < axes.length - 1) setCurrentIndex(safeIndex + 1)
    if (delta < -50 && safeIndex > 0) setCurrentIndex(safeIndex - 1)
  }

  async function handleCreateAxe(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createAxe(formData)
      if (result?.error) setError(result.error)
      else {
        setShowAxeForm(false)
        // Aller sur le nouvel axe (qui sera à la fin)
        setCurrentIndex(axes.length)
      }
    })
  }

  async function handleCreateAction(e: React.FormEvent<HTMLFormElement>, axeId: string) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    formData.set('axe_id', axeId)
    startTransition(async () => {
      await createAction(formData)
      setAddActionAxeId(null)
    })
  }

  const scoreLabels = ['', 'Débutant', 'En cours', 'Intermédiaire', 'Avancé', 'Expert']

  const currentAxe = axes[safeIndex]

  return (
    <div className="space-y-6 pb-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Mes actions de progrès</h1>
        {axes.length < 3 && (
          <button onClick={() => setShowAxeForm(true)} className="btn-primary">
            <Plus size={16} /> Ajouter un axe
          </button>
        )}
      </div>

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
                {(['facile', 'moyen', 'difficile'] as const).map((d) => (
                  <label key={d} className="flex-1 cursor-pointer">
                    <input type="radio" name="difficulty" value={d} required className="sr-only peer" />
                    <div className={`text-center py-3 border-2 rounded-lg transition-all border-gray-200 peer-checked:border-current peer-checked:${DIFFICULTY_COLORS[d]}`}>
                      <p className="text-sm font-semibold">{DIFFICULTY_LABELS[d]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">Autopositionnement initial (1 = débutant, 5 = expert) *</label>
              <div className="flex gap-2 mt-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <label key={v} className="flex-1 cursor-pointer">
                    <input type="radio" name="initial_score" value={v} required className="sr-only peer" />
                    <div className="text-center py-2 border-2 border-gray-200 rounded-lg peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:text-indigo-700 font-semibold transition-all">
                      {v}
                    </div>
                    <p className="text-xs text-center text-gray-400 mt-1">{scoreLabels[v]}</p>
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? 'Enregistrement...' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => { setShowAxeForm(false); setError(null) }} className="btn-secondary">
                Annuler
              </button>
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

      {/* Carrousel */}
      {axes.length > 0 && (
        <div className="space-y-3">

          {/* Barre de navigation : ← dots → */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => setCurrentIndex(safeIndex - 1)}
              disabled={safeIndex === 0}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-1.5">
              {axes.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-2 rounded-full transition-all duration-200 ${
                    i === safeIndex
                      ? 'w-6 bg-indigo-500'
                      : 'w-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentIndex(safeIndex + 1)}
              disabled={safeIndex === axes.length - 1}
              className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Carte de l'axe courant */}
          {currentAxe && (() => {
            const dyn = getDynamique(currentAxe.actions.length)
            return (
              <div
                className="card"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {/* En-tête */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-gray-900">{currentAxe.subject}</h2>
                    {currentAxe.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{currentAxe.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full border ${DIFFICULTY_COLORS[currentAxe.difficulty]}`}>
                        {DIFFICULTY_LABELS[currentAxe.difficulty]}
                      </span>
                      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${dyn.color}`}>
                        <span className="text-sm leading-none">{dyn.icon}</span>
                        <span>{dyn.label}</span>
                        {dyn.delta > 0 && (
                          <span className="text-[10px] font-normal opacity-70">+{dyn.delta} pour {
                            currentAxe.actions.length === 0 ? 'Impulsion' :
                            currentAxe.actions.length <= 2 ? 'Rythme' :
                            currentAxe.actions.length <= 5 ? 'Intensité' : 'Propulsion'
                          }</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Suppression */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setDeletingAxeStep(1)}
                      className="text-gray-300 hover:text-red-400 transition-colors p-1"
                      title="Supprimer cet axe"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Actions menées */}
                <div className="border-t border-gray-100 pt-3 mt-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700">
                      Actions menées
                      {currentAxe.actions.length > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-gray-400">({currentAxe.actions.length})</span>
                      )}
                    </p>
                    <button
                      onClick={() => setAddActionAxeId(addActionAxeId === currentAxe.id ? null : currentAxe.id)}
                      className="btn-primary text-xs px-3 py-1.5"
                    >
                      <Plus size={14} /> Ajouter
                    </button>
                  </div>

                  {/* Formulaire d'ajout */}
                  {addActionAxeId === currentAxe.id && (
                    <form onSubmit={(e) => handleCreateAction(e, currentAxe.id)} className="flex gap-2 mb-3">
                      <input
                        name="description"
                        required
                        className="input flex-1"
                        placeholder="Décrivez l'action menée..."
                        autoFocus
                      />
                      <button type="submit" disabled={isPending} className="btn-primary px-3">
                        <Check size={15} />
                      </button>
                      <button type="button" onClick={() => setAddActionAxeId(null)} className="btn-secondary px-3">
                        <X size={15} />
                      </button>
                    </form>
                  )}

                  {currentAxe.actions.length === 0 && addActionAxeId !== currentAxe.id && (
                    <p className="text-xs text-gray-400 italic">Aucune action enregistrée</p>
                  )}

                  {(() => {
                    // Tri chronologique pour attribuer les rangs, puis affichage antéchronologique
                    const chronoSorted = [...currentAxe.actions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    const rankMap = new Map(chronoSorted.map((a, i) => [a.id, i + 1]))
                    const displaySorted = [...currentAxe.actions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

                    return (
                      <ul className="space-y-2">
                        {displaySorted.map((action) => {
                          const rank = rankMap.get(action.id) ?? 1
                          return (
                            <li key={action.id} className="flex items-start gap-2">
                              <span className="shrink-0 mt-0.5 text-base">{getActionPhaseIcon(rank)}</span>
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-gray-700">{action.description}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-gray-400">{formatDate(action.created_at)}</span>
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
          })()}
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
                <p className="text-sm text-gray-500">L&apos;axe « {currentAxe?.subject} » sera définitivement supprimé. Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeletingAxeStep(0)} className="btn-secondary px-5">
                Annuler
              </button>
              <button
                onClick={() => {
                  startTransition(() => { deleteAxe(currentAxe!.id) })
                  setCurrentIndex(Math.max(0, safeIndex - 1))
                  setDeletingAxeStep(0)
                }}
                className="px-5 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Supprimer définitivement
              </button>
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
                  startTransition(() => deleteAction(deletingActionId))
                  setDeletingActionId(null)
                }}
                className="px-5 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
