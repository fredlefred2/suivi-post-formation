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
      <div className="flex items-center justify-center py-16" style={{ color: '#a0937c' }}>
        <div className="animate-spin w-5 h-5 border-2 border-t-transparent rounded-full mr-2" style={{ borderColor: '#fbbf24', borderTopColor: 'transparent' }} />
        Chargement...
      </div>
    )
  }

  const sentTips = tips.filter(t => t.sent)

  return (
    <div className="space-y-5">
      {/* ── Header navy — Cream & Warm ── */}
      <div
        className="rounded-[28px] p-5 relative overflow-hidden"
        style={{ background: '#1a1a2e' }}
      >
        <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />

        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg" style={{ background: 'rgba(255,255,255,0.2)' }}>
            💪
          </div>
          <div>
            <h1 className="text-[22px] font-extrabold text-white">Mon coaching</h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {sentTips.length} conseil{sentTips.length > 1 ? 's' : ''} reçu{sentTips.length > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {tips.length === 0 ? (
        <div className="rounded-[22px] bg-white p-8 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4" style={{ background: '#fffbeb' }}>💪</div>
          <p className="text-sm font-medium" style={{ color: '#1a1a2e' }}>Tes conseils apparaîtront ici chaque semaine.</p>
          <p className="text-xs mt-1.5" style={{ color: '#a0937c' }}>Crée tes axes de progrès pour recevoir du coaching personnalisé !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {axeGroups.map(axe => {
            const isExpanded = expandedAxes.has(axe.axeId)
            const axeSentTips = axe.tips.filter(t => t.sent)
            const progress = axe.tips.length > 0 ? Math.round((axeSentTips.length / axe.tips.length) * 100) : 0

            return (
              <div key={axe.axeId} className="rounded-[22px] bg-white overflow-hidden" style={{ border: '2px solid #f0ebe0' }}>
                {/* Header axe — accordéon */}
                <button
                  onClick={() => toggleAxe(axe.axeId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors"
                >
                  <div className="axe-num w-9 h-9 text-base">
                    🎯
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-bold truncate" style={{ color: '#1a1a2e' }}>{axe.axeSubject}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="bar-bg">
                        <div
                          className="bar-fill transition-all duration-500"
                          style={{
                            width: `${progress}%`,
                            background: '#fbbf24',
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-medium shrink-0" style={{ color: '#a0937c' }}>
                        {axeSentTips.length}/{axe.tips.length}
                      </span>
                    </div>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                    style={{ color: '#a0937c' }}
                  />
                </button>

                {/* Tips — timeline verticale */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    {axeSentTips.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: '#a0937c' }}>Pas encore de conseil pour cet axe</p>
                    ) : (
                      <div className="relative ml-4">
                        {/* Ligne verticale de timeline */}
                        <div className="absolute left-0 top-2 bottom-2 w-px" style={{ background: '#f0ebe0' }} />

                        <div className="space-y-4">
                          {axeSentTips.map((tip, idx) => (
                            <div key={tip.id} className="relative pl-6">
                              {/* Point sur la timeline */}
                              <div
                                className="absolute left-0 top-3 w-2.5 h-2.5 rounded-full -translate-x-1/2 ring-2 ring-white"
                                style={{
                                  background: tip.acted
                                    ? '#10b981'
                                    : idx === 0 ? '#fbbf24' : '#e0d8c8',
                                }}
                              />

                              <div
                                className="rounded-[18px] p-3.5 transition-all"
                                style={{
                                  background: tip.acted ? '#ecfdf5' : idx === 0 ? '#fffbeb' : '#faf8f4',
                                  border: `2px solid ${tip.acted ? '#d1fae5' : idx === 0 ? '#fde68a' : '#f0ebe0'}`,
                                }}
                              >
                                {/* En-tête : semaine + statut */}
                                <div className="flex items-center justify-between mb-2.5">
                                  <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a0937c' }}>
                                    Semaine {tip.week_number}
                                  </span>
                                  {tip.acted && (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                                      ✓ Lu
                                    </span>
                                  )}
                                </div>

                                {/* Rappel */}
                                <p className="text-[13px] font-semibold leading-relaxed" style={{ color: '#1a1a2e' }}>
                                  {tip.content}
                                </p>

                                {/* Conseil */}
                                {tip.advice && (
                                  <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid #f0ebe0' }}>
                                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#92400e' }}>
                                      💡 Essaye cette semaine
                                    </p>
                                    <p className="text-[13px] leading-relaxed" style={{ color: '#1a1a2e' }}>{tip.advice}</p>
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
