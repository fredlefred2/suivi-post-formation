'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Check, X, Loader2, Sparkles } from 'lucide-react'

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

  // Trier par nom
  grouped.sort((a, b) => a.learnerName.localeCompare(b.learnerName, 'fr'))

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
    const content = prompt('Texte du nouveau rappel & conseil :')
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
        Chargement...
      </div>
    )
  }

  if (tips.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Sparkles size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="text-sm">Aucun rappel & conseil généré pour ce groupe.</p>
        <p className="text-xs mt-1">Ils sont générés automatiquement quand les apprenants créent leurs axes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
          <Sparkles size={16} className="text-indigo-500" />
          Rappels & Conseils
        </h3>
        <span className="text-xs text-gray-500">{tips.length} éléments</span>
      </div>

      {grouped.map(learner => {
        const totalTips = learner.axes.reduce((sum, a) => sum + a.tips.length, 0)
        const sentTips = learner.axes.reduce((sum, a) => sum + a.tips.filter(t => t.sent).length, 0)
        const isExpanded = expandedLearners.has(learner.learnerId)

        return (
          <div key={learner.learnerId} className="card overflow-hidden">
            {/* Header apprenant */}
            <button
              onClick={() => toggleLearner(learner.learnerId)}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {isExpanded
                ? <ChevronDown size={16} className="text-gray-500" />
                : <ChevronRight size={16} className="text-gray-500" />
              }
              <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-800 font-semibold flex items-center justify-center text-xs shrink-0">
                {learner.learnerName.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="font-semibold text-sm text-gray-800">{learner.learnerName}</span>
              <span className="text-xs text-gray-500 ml-auto">
                {sentTips}/{totalTips} envoyés
              </span>
            </button>

            {/* Contenu déplié */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3">
                {learner.axes.map(axe => (
                  <div key={axe.axeId}>
                    <p className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wide">
                      🎯 {axe.axeSubject}
                    </p>
                    <div className="space-y-1.5">
                      {axe.tips.map(tip => {
                        const isLocked = tip.sent
                        return (
                          <div key={tip.id} className={`flex items-start gap-2 px-2.5 py-2 rounded-lg text-sm ${
                            tip.acted ? 'bg-green-50 border border-green-200'
                            : tip.sent ? 'bg-amber-50 border border-amber-200'
                            : 'bg-gray-50'
                          }`}>
                            {/* Numéro semaine */}
                            <span className={`text-xs font-mono mt-0.5 flex-shrink-0 w-5 ${
                              isLocked ? 'text-amber-600 font-bold' : 'text-gray-500'
                            }`}>
                              S{tip.week_number}
                            </span>

                            {/* Contenu (éditable ou non) */}
                            {editingTip === tip.id ? (
                              <div className="flex-1 flex items-center gap-1">
                                <textarea
                                  value={editContent}
                                  onChange={e => setEditContent(e.target.value)}
                                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 min-h-[60px]"
                                  autoFocus
                                />
                                <button onClick={() => handleEdit(tip.id)} className="text-green-600 hover:text-green-800 p-1">
                                  <Check size={14} />
                                </button>
                                <button onClick={() => setEditingTip(null)} className="text-gray-500 hover:text-gray-700 p-1">
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <span className={`flex-1 ${isLocked ? 'text-gray-600' : 'text-gray-700'}`}>{tip.content}</span>
                            )}

                            {/* Status */}
                            {tip.acted && <span className="text-xs flex-shrink-0" title="Vu par l'apprenant">✅</span>}
                            {tip.sent && !tip.acted && <span className="text-xs flex-shrink-0" title="Envoyé, en attente">📤</span>}

                            {/* Actions — verrouillé si déjà envoyé */}
                            {editingTip !== tip.id && !isLocked && (
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

                            {/* Indicateur verrouillé */}
                            {isLocked && editingTip !== tip.id && (
                              <span className="text-[10px] text-gray-400 flex-shrink-0" title="Déjà envoyé — non modifiable">
                                🔒
                              </span>
                            )}
                          </div>
                        )
                      })}

                      {/* Bouton ajouter */}
                      <button
                        onClick={() => handleAdd(axe.axeId, learner.learnerId, axe.tips.length + 1)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2.5 py-1.5 transition-colors"
                      >
                        <Plus size={12} /> Ajouter un rappel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
