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
      body: JSON.stringify({ action: 'regenerate', tipId: tip.id, groupTheme, axeSubject: tip.axe?.subject || '' }),
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
            <button
              onClick={() => toggleLearner(learner.learnerId)}
              className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
            >
              {isExpanded ? <ChevronDown size={16} className="text-gray-500" /> : <ChevronRight size={16} className="text-gray-500" />}
              <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-800 font-semibold flex items-center justify-center text-xs shrink-0">
                {learner.learnerName.split(' ').map(n => n[0]).join('')}
              </div>
              <span className="font-semibold text-sm text-gray-800">{learner.learnerName}</span>
              <span className="text-xs text-gray-500 ml-auto">{sentTips}/{totalTips} envoyés</span>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 space-y-4">
                {learner.axes.map(axe => (
                  <div key={axe.axeId}>
                    <p className="text-xs font-semibold text-indigo-600 mb-2 uppercase tracking-wide">🎯 {axe.axeSubject}</p>
                    <div className="space-y-2">
                      {axe.tips.map(tip => {
                        const isLocked = tip.sent
                        const isEditing = editingTip === tip.id

                        return (
                          <div key={tip.id} className={`rounded-xl border p-3 ${
                            tip.acted ? 'bg-green-50 border-green-200'
                            : tip.sent ? 'bg-amber-50 border-amber-200'
                            : 'bg-white border-gray-200'
                          }`}>
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                isLocked ? 'bg-amber-200 text-amber-800' : 'bg-gray-200 text-gray-600'
                              }`}>
                                Semaine {tip.week_number}
                              </span>
                              {tip.acted && <span className="text-xs text-green-600">✅ Lu</span>}
                              {tip.sent && !tip.acted && <span className="text-xs text-amber-600">📤 Envoyé</span>}
                              {!tip.sent && <span className="text-xs text-gray-400">⏳ En attente</span>}
                              {isLocked && <span className="text-[10px] text-gray-400 ml-auto">🔒</span>}
                            </div>

                            {isEditing ? (
                              <div className="space-y-2">
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5 block">📚 Le savais-tu ?</label>
                                  <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 min-h-[60px]" autoFocus />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5 block">💡 Conseil</label>
                                  <textarea value={editAdvice} onChange={e => setEditAdvice(e.target.value)}
                                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 min-h-[60px]" />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => handleEdit(tip.id)} className="btn-primary btn-sm text-xs"><Check size={14} /> Enregistrer</button>
                                  <button onClick={() => setEditingTip(null)} className="btn-secondary btn-sm text-xs">Annuler</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Rappel */}
                                <div className="mb-2">
                                  <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-0.5">📚 Le savais-tu ?</p>
                                  <p className="text-sm text-gray-800 leading-relaxed">{tip.content}</p>
                                </div>

                                {/* Conseil */}
                                {tip.advice && (
                                  <div className="bg-indigo-50 rounded-lg p-2.5 mt-2">
                                    <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">💡 Conseil de la semaine</p>
                                    <p className="text-sm text-indigo-900 leading-relaxed">{tip.advice}</p>
                                  </div>
                                )}

                                {/* Boutons formateur — verrouillé si envoyé */}
                                {!isLocked && (
                                  <div className="flex items-center gap-1 pt-2 border-t border-gray-100 mt-2">
                                    <button onClick={() => { setEditingTip(tip.id); setEditContent(tip.content); setEditAdvice(tip.advice || '') }}
                                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-indigo-50 transition-colors">
                                      <Pencil size={12} /> Modifier
                                    </button>
                                    <button onClick={() => handleRegenerate(tip)} disabled={regenerating === tip.id}
                                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors">
                                      {regenerating === tip.id ? <><Loader2 size={12} className="animate-spin" /> Génération...</> : <><RefreshCw size={12} /> Régénérer</>}
                                    </button>
                                    <button onClick={() => handleDelete(tip.id)}
                                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors">
                                      <Trash2 size={12} /> Supprimer
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )
                      })}
                      <button onClick={() => handleAdd(axe.axeId, learner.learnerId, axe.tips.length + 1)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 px-2 py-1.5 mt-1 transition-colors">
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
