'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Check, X, Loader2 } from 'lucide-react'

interface Tip {
  id: string
  axe_id: string
  learner_id: string
  week_number: number
  content: string
  sent: boolean
  acted: boolean
  axe: { subject: string } | null
  learner: { first_name: string; last_name: string } | null
}

interface GroupedTips {
  learnerId: string
  learnerName: string
  axes: {
    axeId: string
    axeSubject: string
    tips: Tip[]
  }[]
}

export default function TrainerTipsManager({ groupId, groupTheme }: { groupId: string; groupTheme: string }) {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedLearners, setExpandedLearners] = useState<Set<string>>(new Set())
  const [editingTip, setEditingTip] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [regenerating, setRegenerating] = useState<string | null>(null)

  const fetchTips = useCallback(async () => {
    const res = await fetch(`/api/tips/admin?groupId=${groupId}`)
    const data = await res.json()
    setTips(data.tips || [])
    setLoading(false)
  }, [groupId])

  useEffect(() => { fetchTips() }, [fetchTips])

  // Grouper par apprenant → axe
  const grouped: GroupedTips[] = []
  const learnerMap = new Map<string, GroupedTips>()

  for (const tip of tips) {
    if (!learnerMap.has(tip.learner_id)) {
      const entry: GroupedTips = {
        learnerId: tip.learner_id,
        learnerName: tip.learner ? `${tip.learner.first_name} ${tip.learner.last_name}` : 'Inconnu',
        axes: [],
      }
      learnerMap.set(tip.learner_id, entry)
      grouped.push(entry)
    }

    const learner = learnerMap.get(tip.learner_id)!
    let axeGroup = learner.axes.find(a => a.axeId === tip.axe_id)
    if (!axeGroup) {
      axeGroup = { axeId: tip.axe_id, axeSubject: tip.axe?.subject || 'Axe inconnu', tips: [] }
      learner.axes.push(axeGroup)
    }
    axeGroup.tips.push(tip)
  }

  const toggleLearner = (id: string) => {
    setExpandedLearners(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleEdit = async (tipId: string) => {
    await fetch('/api/tips/admin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipId, content: editContent }),
    })
    setEditingTip(null)
    fetchTips()
  }

  const handleDelete = async (tipId: string) => {
    await fetch(`/api/tips/admin?tipId=${tipId}`, { method: 'DELETE' })
    fetchTips()
  }

  const handleRegenerate = async (tip: Tip) => {
    setRegenerating(tip.id)
    const res = await fetch('/api/tips/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'regenerate',
        tipId: tip.id,
        groupTheme,
        axeSubject: tip.axe?.subject || '',
      }),
    })
    setRegenerating(null)
    if (res.ok) fetchTips()
  }

  const handleAdd = async (axeId: string, learnerId: string, nextWeek: number) => {
    const content = prompt('Texte du nouveau défi :')
    if (!content) return
    await fetch('/api/tips/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', axeId, learnerId, weekNumber: nextWeek, content }),
    })
    fetchTips()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 size={20} className="animate-spin mr-2" />
        Chargement des défis...
      </div>
    )
  }

  if (tips.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p className="text-sm">Aucun défi généré pour ce groupe.</p>
        <p className="text-xs mt-1">Les défis sont générés automatiquement quand les apprenants créent leurs axes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700">💡 Défis hebdomadaires</h3>
        <span className="text-xs text-gray-500">{tips.length} défis</span>
      </div>

      {grouped.map(learner => (
        <div key={learner.learnerId} className="card overflow-hidden">
          {/* Header apprenant */}
          <button
            onClick={() => toggleLearner(learner.learnerId)}
            className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
          >
            {expandedLearners.has(learner.learnerId)
              ? <ChevronDown size={16} className="text-gray-500" />
              : <ChevronRight size={16} className="text-gray-500" />
            }
            <span className="font-semibold text-sm text-gray-800">{learner.learnerName}</span>
            <span className="text-xs text-gray-500 ml-auto">
              {learner.axes.reduce((sum, a) => sum + a.tips.length, 0)} défis
            </span>
          </button>

          {/* Contenu déplié */}
          {expandedLearners.has(learner.learnerId) && (
            <div className="px-3 pb-3 space-y-3">
              {learner.axes.map(axe => (
                <div key={axe.axeId}>
                  <p className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wide">
                    {axe.axeSubject}
                  </p>
                  <div className="space-y-1.5">
                    {axe.tips.map(tip => (
                      <div key={tip.id} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg text-sm ${
                        tip.sent ? (tip.acted ? 'bg-green-50' : 'bg-amber-50') : 'bg-gray-50'
                      }`}>
                        {/* Numéro semaine */}
                        <span className="text-xs font-mono text-gray-500 mt-0.5 flex-shrink-0 w-5">
                          S{tip.week_number}
                        </span>

                        {/* Contenu (éditable ou non) */}
                        {editingTip === tip.id ? (
                          <div className="flex-1 flex items-center gap-1">
                            <input
                              value={editContent}
                              onChange={e => setEditContent(e.target.value)}
                              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                              autoFocus
                            />
                            <button onClick={() => handleEdit(tip.id)} className="text-green-600 hover:text-green-800">
                              <Check size={14} />
                            </button>
                            <button onClick={() => setEditingTip(null)} className="text-gray-500 hover:text-gray-700">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <span className="flex-1 text-gray-700">{tip.content}</span>
                        )}

                        {/* Status */}
                        {tip.acted && <span className="text-xs text-green-600 flex-shrink-0">✅</span>}
                        {tip.sent && !tip.acted && <span className="text-xs text-amber-600 flex-shrink-0">📤</span>}

                        {/* Actions */}
                        {editingTip !== tip.id && (
                          <div className="flex items-center gap-0.5 flex-shrink-0">
                            <button
                              onClick={() => { setEditingTip(tip.id); setEditContent(tip.content) }}
                              className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                              title="Modifier"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => handleRegenerate(tip)}
                              disabled={regenerating === tip.id}
                              className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
                              title="Régénérer avec l'IA"
                            >
                              {regenerating === tip.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <RefreshCw size={12} />
                              }
                            </button>
                            <button
                              onClick={() => handleDelete(tip.id)}
                              className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Bouton ajouter */}
                    <button
                      onClick={() => handleAdd(axe.axeId, learner.learnerId, axe.tips.length + 1)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 transition-colors"
                    >
                      <Plus size={12} /> Ajouter un défi
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
