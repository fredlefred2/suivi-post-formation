'use client'

import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface Tip {
  id: string
  axe_id: string
  week_number: number
  content: string
  advice: string | null
  sent: boolean
  acted: boolean
  axe: { subject: string } | null
}

interface AxeGroup {
  axeId: string
  axeSubject: string
  tips: Tip[]
}

export default function CoachingClient({ userId }: { userId: string }) {
  const [tips, setTips] = useState<Tip[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedAxes, setExpandedAxes] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/tips/learner')
      .then(r => r.json())
      .then(data => {
        setTips(data.tips || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Grouper par axe
  const axeGroups: AxeGroup[] = []
  const axeMap = new Map<string, AxeGroup>()

  for (const tip of tips) {
    if (!axeMap.has(tip.axe_id)) {
      const group: AxeGroup = {
        axeId: tip.axe_id,
        axeSubject: tip.axe?.subject || 'Axe',
        tips: [],
      }
      axeMap.set(tip.axe_id, group)
      axeGroups.push(group)
    }
    axeMap.get(tip.axe_id)!.tips.push(tip)
  }

  const toggleAxe = (id: string) => {
    setExpandedAxes(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full mr-2" />
        Chargement...
      </div>
    )
  }

  const sentTips = tips.filter(t => t.sent)

  return (
    <div className="space-y-5">
      {/* ── Header gradient harmonisé ── */}
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
          boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-white/20 shadow-lg">
            🥷
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-white">Mon coaching</h1>
            <p className="text-xs text-indigo-200 mt-0.5">
              {sentTips.length} conseil{sentTips.length > 1 ? 's' : ''} reçu{sentTips.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {tips.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center text-3xl mx-auto mb-4">🥷</div>
          <p className="text-sm font-medium text-gray-600">Tes conseils apparaîtront ici chaque semaine.</p>
          <p className="text-xs text-gray-400 mt-1.5">Crée tes axes de progrès pour recevoir du coaching personnalisé !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {axeGroups.map(axe => {
            const isExpanded = expandedAxes.has(axe.axeId)
            const axeSentTips = axe.tips.filter(t => t.sent)
            const progress = axe.tips.length > 0 ? Math.round((axeSentTips.length / axe.tips.length) * 100) : 0

            return (
              <div key={axe.axeId} className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                {/* Header axe — accordéon */}
                <button
                  onClick={() => toggleAxe(axe.axeId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-gray-50/80"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center text-base shrink-0">
                    🎯
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold text-gray-800 truncate">{axe.axeSubject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            background: 'linear-gradient(90deg, #6366f1, #818cf8)',
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 font-medium shrink-0">
                        {axeSentTips.length}/{axe.tips.length}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Tips — timeline verticale */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    {axeSentTips.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-4">Pas encore de conseil pour cet axe</p>
                    ) : (
                      <div className="relative ml-4">
                        {/* Ligne verticale de timeline */}
                        <div className="absolute left-0 top-2 bottom-2 w-px bg-indigo-100" />

                        <div className="space-y-4">
                          {axeSentTips.map((tip, idx) => (
                            <div key={tip.id} className="relative pl-6">
                              {/* Point sur la timeline */}
                              <div
                                className="absolute left-0 top-3 w-2.5 h-2.5 rounded-full -translate-x-1/2 ring-2 ring-white"
                                style={{
                                  background: tip.acted
                                    ? '#10b981'
                                    : idx === 0 ? '#6366f1' : '#d1d5db',
                                }}
                              />

                              <div className={`rounded-xl p-3.5 transition-all ${
                                tip.acted
                                  ? 'bg-emerald-50/60'
                                  : idx === 0 ? 'bg-indigo-50/60' : 'bg-gray-50/60'
                              }`}
                              style={{ border: `1px solid ${tip.acted ? '#d1fae5' : idx === 0 ? '#e0e7ff' : '#f1f5f9'}` }}
                              >
                                {/* En-tête : semaine + statut */}
                                <div className="flex items-center justify-between mb-2.5">
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                    Semaine {tip.week_number}
                                  </span>
                                  {tip.acted && (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      ✓ Lu
                                    </span>
                                  )}
                                </div>

                                {/* Rappel — style bulle de chat */}
                                <p className="text-[13px] font-semibold text-gray-800 leading-relaxed">
                                  {tip.content}
                                </p>

                                {/* Conseil */}
                                {tip.advice && (
                                  <div className="mt-2.5 pt-2.5 border-t border-gray-200/60">
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">
                                      💡 Essaye cette semaine
                                    </p>
                                    <p className="text-[13px] text-gray-600 leading-relaxed">{tip.advice}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
