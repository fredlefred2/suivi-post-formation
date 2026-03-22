'use client'

import { useState, useEffect, useCallback } from 'react'
import { Pencil, Trash2, Plus, RefreshCw, ChevronDown, ChevronRight, Check, X, Loader2, Sparkles } from 'lucide-react'

interface Tip {
  id: string
  axe_id: string
  learner_id: string
  week_number: number
  content: string
  advice: string | null
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
  const [editAdvice, setEditAdvice] = useState('')
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
      body: JSON.stringify({ tipId, content: editContent, advice: editAdvice }),
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
    await fetch('/api/tips/admin', {
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
    fetchTips()
  }

  const handleAdd = async (axeId: string, learnerId: string, nextWeek: number) => {
    const content = prompt('📚 Le savais-tu (rappel) :')
    if (!content) return
    const advice = prompt('💡 Conseil pratique :')
    await fetch('/api/tips/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add', axeId, learnerId, weekNumber: nextWeek, content, advice: advice || null }),
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

            {/* Contenu déplié : tableau par axe */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-4">
                {learner.axes.map(axe => (
                  <div key={axe.axeId}>
                    <p className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wide">
                      🎯 {axe.axeSubject}
                    </p>

                    {/* Tableau */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b border-gray-200">
                            <th className="text-left py-2 px-2 w-10">Sem.</th>
                            <th className="text-left py-2 px-2">📚 Le savais-tu ?</th>
                            <th className="text-left py-2 px-2">💡 Conseil</th>
                            <th className="text-center py-2 px-1 w-16">État</th>
                            <th className="text-center py-2 px-1 w-24">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {axe.tips.map(tip => {
                            const isLocked = tip.sent
                            const isEditing = editingTip === tip.id

                            return (
                              <tr key={tip.id} className={`border-b border-gray-100 ${
                                tip.acted ? 'bg-green-50' : tip.sent ? 'bg-amber-50' : ''
                              }`}>
                                {/* Semaine */}
                                <td className={`py-2 px-2 font-mono text-xs ${isLocked ? 'text-amber-600 font-bold' : 'text-gray-500'}`}>
                                  S{tip.week_number}
                                </td>

                                {/* Rappel */}
                                <td className="py-2 px-2 text-gray-700">
                                  {isEditing ? (
                                    <textarea
                                      value={editContent}
                                      onChange={e => setEditContent(e.target.value)}
                                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 min-h-[60px]"
                                      autoFocus
                                    />
                                  ) : (
                                    <span className="text-sm leading-relaxed">{tip.content}</span>
                                  )}
                                </td>

                                {/* Conseil */}
                                <td className="py-2 px-2 text-gray-600">
                                  {isEditing ? (
                                    <textarea
                                      value={editAdvice}
                                      onChange={e => setEditAdvice(e.target.value)}
                                      className="w-full text-sm border border-gray-300 rounded px-2 py-1 min-h-[60px]"
                                    />
                                  ) : (
                                    <span className="text-sm leading-relaxed italic">{tip.advice || '—'}</span>
                                  )}
                                </td>

                                {/* État */}
                                <td className="py-2 px-1 text-center">
                                  {tip.acted
                                    ? <span className="text-xs" title="Lu par l'apprenant">✅</span>
                                    : tip.sent
                                    ? <span className="text-xs" title="Envoyé">📤</span>
                                    : <span className="text-xs text-gray-400" title="En attente">⏳</span>
                                  }
                                </td>

                                {/* Actions */}
                                <td className="py-2 px-1 text-center">
                                  {isEditing ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <button onClick={() => handleEdit(tip.id)} className="text-green-600 hover:text-green-800 p-1">
                                        <Check size={14} />
                                      </button>
                                      <button onClick={() => setEditingTip(null)} className="text-gray-500 hover:text-gray-700 p-1">
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : isLocked ? (
                                    <span className="text-[10px] text-gray-400">🔒</span>
                                  ) : (
                                    <div className="flex items-center justify-center gap-0.5">
                                      <button
                                        onClick={() => { setEditingTip(tip.id); setEditContent(tip.content); setEditAdvice(tip.advice || '') }}
                                        className="p-1 text-gray-400 hover:text-indigo-600 transition-colors"
                                        title="Modifier"
                                      >
                                        <Pencil size={13} />
                                      </button>
                                      <button
                                        onClick={() => handleRegenerate(tip)}
                                        disabled={regenerating === tip.id}
                                        className="p-1 text-gray-400 hover:text-amber-600 transition-colors"
                                        title="Régénérer"
                                      >
                                        {regenerating === tip.id
                                          ? <Loader2 size={13} className="animate-spin" />
                                          : <RefreshCw size={13} />
                                        }
                                      </button>
                                      <button
                                        onClick={() => handleDelete(tip.id)}
                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                        title="Supprimer"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Bouton ajouter */}
                    <button
                      onClick={() => handleAdd(axe.axeId, learner.learnerId, axe.tips.length + 1)}
                      className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1.5 mt-1 transition-colors"
                    >
                      <Plus size={12} /> Ajouter un rappel
                    </button>
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
