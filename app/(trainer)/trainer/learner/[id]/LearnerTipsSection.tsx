'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2, Sparkles, RefreshCw, Pencil, Check, Zap, Trash2 } from 'lucide-react'

interface Tip {
  id: string
  axe_id: string
  week_number: number
  content: string
  advice: string | null
  sent: boolean
  acted: boolean
  read_at: string | null
  next_scheduled: boolean
}

interface AxeTips {
  axeId: string
  axeSubject: string
  tips: Tip[]
}

function tipStatusBadge(tip: Tip): { label: string; className: string } {
  if (tip.acted) return { label: '✅ Compris', className: 'text-emerald-600' }
  if (tip.sent && tip.read_at) return { label: '👁️ Lu', className: 'text-amber-600' }
  if (tip.sent) return { label: '💤 Non lu', className: 'text-gray-500' }
  if (tip.next_scheduled) return { label: '📅 Prochain mardi', className: 'text-indigo-600' }
  return { label: '⏳ Stock', className: 'text-gray-400' }
}

export default function LearnerTipsSection({
  learnerId,
  firstName,
  axes,
}: {
  learnerId: string
  firstName: string
  axes: Array<{ id: string; subject: string }>
}) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [axeTips, setAxeTips] = useState<AxeTips[]>([])
  const [expandedAxes, setExpandedAxes] = useState<Set<string>>(new Set())
  const [editingTip, setEditingTip] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editAdvice, setEditAdvice] = useState('')
  const [regenerating, setRegenerating] = useState<string | null>(null)
  const [generatingNext, setGeneratingNext] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchTips = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/tips/admin/learner?learnerId=${learnerId}`)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const data = await res.json()
      setAxeTips(data.axeTips || [])
    } catch (err) {
      setError('Impossible de charger les tips')
      console.error(err)
    }
    setLoading(false)
  }

  useEffect(() => {
    if (expanded && axeTips.length === 0 && !loading) {
      fetchTips()
    }
  }, [expanded]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalSent = axeTips.reduce((sum, a) => sum + a.tips.filter(t => t.sent).length, 0)
  const totalCompris = axeTips.reduce((sum, a) => sum + a.tips.filter(t => t.acted).length, 0)
  const hasNextScheduled = axeTips.some(a => a.tips.some(t => t.next_scheduled && !t.sent))

  const handleEdit = async (tipId: string) => {
    setError(null)
    const res = await fetch('/api/tips/admin', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipId, content: editContent, advice: editAdvice }),
    })
    if (!res.ok) { setError('Erreur lors de la modification'); return }
    setEditingTip(null)
    fetchTips()
  }

  const handleRegenerate = async (tipId: string) => {
    setError(null)
    setRegenerating(tipId)
    const res = await fetch('/api/tips/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate', tipId }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data.error || 'Erreur lors de la regeneration')
    }
    setRegenerating(null)
    fetchTips()
  }

  const handleDelete = async (tipId: string) => {
    setError(null)
    const res = await fetch(`/api/tips/admin?tipId=${tipId}`, { method: 'DELETE' })
    if (!res.ok) setError('Erreur lors de la suppression')
    fetchTips()
  }

  const handleGenerateNext = async (axeId: string) => {
    // Vérifier si un autre axe a déjà un tip en attente d'envoi
    const existingScheduled = axeTips
      .filter(a => a.axeId !== axeId)
      .flatMap(a => a.tips)
      .find(t => t.next_scheduled && !t.sent)

    if (existingScheduled) {
      const axeName = axeTips.find(a => a.tips.some(t => t.id === existingScheduled.id))?.axeSubject || 'un autre axe'
      const ok = window.confirm(
        `Un tip est déjà programmé pour mardi sur l'axe « ${axeName} ».\n\nSi tu génères ici, celui-là sera annulé.\n\nContinuer ?`
      )
      if (!ok) return
    }

    setError(null)
    setGeneratingNext(axeId)
    try {
      const res = await fetch('/api/tips/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-next', learnerId, axeId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || `Erreur ${res.status}`)
      } else {
        await fetchTips()
      }
    } catch (err) {
      setError('Erreur reseau')
      console.error(err)
    }
    setGeneratingNext(null)
  }

  const toggleAxe = (id: string) => {
    setExpandedAxes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (axes.length === 0) return null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50/80 transition-colors"
      >
        {expanded
          ? <ChevronDown size={16} className="text-gray-500" />
          : <ChevronRight size={16} className="text-gray-500" />
        }
        <Sparkles size={18} className="text-indigo-500" />
        <div className="flex-1 text-left">
          <span className="font-bold text-gray-800 text-sm">Coaching IA</span>
          {totalSent > 0 && (
            <span className="text-[10px] text-gray-400 ml-2">
              {totalSent} envoy&eacute;{totalSent > 1 ? 's' : ''}
              {totalCompris > 0 && ` · ${totalCompris} compris`}
            </span>
          )}
        </div>
        {hasNextScheduled && (
          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
            📅 Prochain pr&ecirc;t
          </span>
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Erreur */}
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-4 text-gray-400 text-sm">
              <Loader2 size={16} className="animate-spin mr-2" /> Chargement...
            </div>
          ) : axeTips.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-gray-400 mb-3">Aucun tip pour {firstName}</p>
              {/* Boutons de generation par axe */}
              {axes.map(axe => (
                <button
                  key={axe.id}
                  onClick={() => handleGenerateNext(axe.id)}
                  disabled={generatingNext === axe.id}
                  className="flex items-center justify-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium py-2 px-4 rounded-xl border border-dashed border-violet-200 hover:bg-violet-50 transition-colors disabled:opacity-50 mx-auto mb-2"
                >
                  {generatingNext === axe.id
                    ? <><Loader2 size={12} className="animate-spin" /> Generation...</>
                    : <><Zap size={12} /> Generer pour &laquo; {axe.subject} &raquo;</>
                  }
                </button>
              ))}
            </div>
          ) : (
            // Fusionner axes du prop (dans le bon ordre) avec les tips récupérés
            axes.map(propAxe => {
              const axeTip = axeTips.find(a => a.axeId === propAxe.id)
              const axe = axeTip || { axeId: propAxe.id, axeSubject: propAxe.subject, tips: [] }
              const isAxeExpanded = expandedAxes.has(axe.axeId)
              const sentCount = axe.tips.filter(t => t.sent).length
              const nextTip = axe.tips.find(t => t.next_scheduled && !t.sent)
              const hasNext = !!nextTip

              return (
                <div key={axe.axeId} className="rounded-xl border border-gray-100 overflow-hidden">
                  <button
                    onClick={() => toggleAxe(axe.axeId)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50/80 transition-colors"
                  >
                    {isAxeExpanded
                      ? <ChevronDown size={14} className="text-gray-400" />
                      : <ChevronRight size={14} className="text-gray-400" />
                    }
                    <span className="text-xs font-semibold text-indigo-600 flex-1 text-left truncate">
                      🎯 {axe.axeSubject}
                    </span>
                    {hasNext && <span className="text-[10px] text-indigo-500">📅</span>}
                    <span className="text-[10px] text-gray-400">{sentCount} envoy&eacute;{sentCount > 1 ? 's' : ''}</span>
                  </button>

                  {isAxeExpanded && (
                    <div className="px-3 pb-3 space-y-2">
                      {/* Prochain tip mis en avant */}
                      {nextTip && (
                        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/60 p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-200 px-2 py-0.5 rounded-full">
                              📅 Prochain mardi
                            </span>
                            <span className="text-[10px] text-gray-400">S.{nextTip.week_number}</span>
                          </div>

                          {editingTip === nextTip.id ? (
                            <div className="space-y-2">
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5 block">🥷 Rappel</label>
                                <textarea value={editContent} onChange={e => setEditContent(e.target.value)}
                                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 min-h-[60px]" autoFocus />
                              </div>
                              <div>
                                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-0.5 block">💡 Conseil</label>
                                <textarea value={editAdvice} onChange={e => setEditAdvice(e.target.value)}
                                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 min-h-[60px]" />
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleEdit(nextTip.id)} className="btn-primary btn-sm text-xs"><Check size={14} /> Enregistrer</button>
                                <button onClick={() => setEditingTip(null)} className="btn-secondary btn-sm text-xs">Annuler</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-sm font-semibold text-gray-800 leading-relaxed">{nextTip.content}</p>
                              {nextTip.advice && (
                                <div className="bg-white rounded-lg p-2 mt-2 border border-indigo-100">
                                  <p className="text-[10px] font-semibold text-indigo-600 uppercase mb-0.5">💡 Conseil</p>
                                  <p className="text-sm text-gray-700 leading-relaxed">{nextTip.advice}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-1 pt-2 mt-2 border-t border-indigo-100">
                                <button
                                  onClick={() => { setEditingTip(nextTip.id); setEditContent(nextTip.content); setEditAdvice(nextTip.advice || '') }}
                                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-indigo-600 px-2 py-1 rounded-lg hover:bg-white transition-colors"
                                >
                                  <Pencil size={10} /> Modifier
                                </button>
                                <button
                                  onClick={() => handleRegenerate(nextTip.id)}
                                  disabled={regenerating === nextTip.id}
                                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-amber-600 px-2 py-1 rounded-lg hover:bg-white transition-colors"
                                >
                                  {regenerating === nextTip.id
                                    ? <><Loader2 size={10} className="animate-spin" /> Generation...</>
                                    : <><RefreshCw size={10} /> Regenerer</>
                                  }
                                </button>
                                <button
                                  onClick={() => handleDelete(nextTip.id)}
                                  className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                                >
                                  <Trash2 size={10} /> Supprimer
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Bouton generer si pas de prochain */}
                      {!hasNext && (
                        <button
                          onClick={() => handleGenerateNext(axe.axeId)}
                          disabled={generatingNext === axe.axeId}
                          className="w-full flex items-center justify-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium py-2 rounded-xl border border-dashed border-violet-200 hover:bg-violet-50 transition-colors disabled:opacity-50"
                        >
                          {generatingNext === axe.axeId
                            ? <><Loader2 size={12} className="animate-spin" /> Generation en cours...</>
                            : <><Zap size={12} /> Generer le prochain tip</>
                          }
                        </button>
                      )}

                      {/* Historique des tips envoyes */}
                      {axe.tips.filter(t => t.sent).length > 0 && (
                        <div className="space-y-1.5 mt-2">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Historique</p>
                          {axe.tips.filter(t => t.sent).reverse().map(tip => {
                            const status = tipStatusBadge(tip)
                            return (
                              <div key={tip.id} className={`rounded-lg p-2.5 text-xs ${
                                tip.acted ? 'bg-emerald-50/60 border border-emerald-100'
                                : tip.read_at ? 'bg-amber-50/60 border border-amber-100'
                                : 'bg-gray-50 border border-gray-100'
                              }`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-semibold text-gray-500">S.{tip.week_number}</span>
                                  <span className={status.className}>{status.label}</span>
                                </div>
                                <p className="text-gray-700 leading-relaxed font-medium">{tip.content}</p>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
