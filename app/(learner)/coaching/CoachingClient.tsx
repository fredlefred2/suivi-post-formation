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
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(new Set())
  const [expandedTips, setExpandedTips] = useState<Set<string>>(new Set())

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

  const toggleHistory = (axeId: string) => {
    setExpandedHistory(prev => {
      const next = new Set(prev)
      next.has(axeId) ? next.delete(axeId) : next.add(axeId)
      return next
    })
  }

  const toggleTipDetail = (tipId: string) => {
    setExpandedTips(prev => {
      const next = new Set(prev)
      next.has(tipId) ? next.delete(tipId) : next.add(tipId)
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
      {/* Header navy */}
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
          {axeGroups.map((axe, axeIndex) => {
            const isExpanded = expandedAxes.has(axe.axeId)
            const axeSentTips = axe.tips.filter(t => t.sent)
            const progress = axe.tips.length > 0 ? Math.round((axeSentTips.length / axe.tips.length) * 100) : 0

            // Dernier tip envoye = le plus recent (week_number le plus eleve)
            const sortedSent = [...axeSentTips].sort((a, b) => b.week_number - a.week_number)
            const latestTip = sortedSent[0] || null
            const olderTips = sortedSent.slice(1)
            const showHistory = expandedHistory.has(axe.axeId)

            return (
              <div key={axe.axeId} className="rounded-[22px] bg-white overflow-hidden" style={{ border: '2px solid #f0ebe0' }}>
                {/* Header axe */}
                <button
                  onClick={() => toggleAxe(axe.axeId)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors"
                >
                  <div className="axe-num w-9 h-9 text-base">
                    {axeIndex + 1}
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

                {/* Contenu deplie */}
                {isExpanded && (
                  <div className="px-4 pb-4">
                    {axeSentTips.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: '#a0937c' }}>Pas encore de conseil pour cet axe</p>
                    ) : (
                      <>
                        {/* Label + badge nouveau */}
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a0937c' }}>
                            Dernier conseil
                          </span>
                          {latestTip && !latestTip.acted && (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: '#fde68a', color: '#92400e' }}>
                              Nouveau
                            </span>
                          )}
                        </div>

                        {/* Dernier tip — mis en avant */}
                        {latestTip && (
                          <div
                            className="rounded-[22px] p-4 transition-all"
                            style={{
                              background: '#fffbeb',
                              border: `2px solid ${latestTip.acted ? '#f0ebe0' : '#fde68a'}`,
                              boxShadow: latestTip.acted ? 'none' : '0 2px 12px rgba(251,191,36,0.12)',
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#a0937c' }}>
                                Semaine {latestTip.week_number}
                              </span>
                              {latestTip.acted && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ color: '#92400e', background: '#fde68a' }}>
                                  ✓ Lu
                                </span>
                              )}
                            </div>

                            <p className="text-[13px] font-semibold leading-relaxed" style={{ color: '#1a1a2e' }}>
                              {latestTip.content}
                            </p>

                            {latestTip.advice && (
                              <div className="mt-2.5 pt-2.5" style={{ borderTop: '1px solid #f0ebe0' }}>
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#92400e' }}>
                                  💡 Essaye cette semaine
                                </p>
                                <p className="text-[13px] leading-relaxed" style={{ color: '#1a1a2e' }}>{latestTip.advice}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bouton voir precedents */}
                        {olderTips.length > 0 && (
                          <>
                            <button
                              onClick={() => toggleHistory(axe.axeId)}
                              className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-3 rounded-[16px] text-xs font-semibold transition-all"
                              style={{
                                border: '2px dashed #f0ebe0',
                                color: '#a0937c',
                                background: showHistory ? '#fffbeb' : 'transparent',
                                borderColor: showHistory ? '#fbbf24' : '#f0ebe0',
                              }}
                            >
                              {showHistory ? (
                                <>▲ Masquer l&apos;historique</>
                              ) : (
                                <>🕐 Voir {olderTips.length > 1 ? `les ${olderTips.length} précédents` : 'le précédent'}</>
                              )}
                            </button>

                            {/* Historique compact */}
                            {showHistory && (
                              <div className="mt-2.5 space-y-2 animate-fade-in-up">
                                {olderTips.map(tip => {
                                  const isDetailOpen = expandedTips.has(tip.id)
                                  return (
                                    <button
                                      key={tip.id}
                                      onClick={() => toggleTipDetail(tip.id)}
                                      className="w-full text-left flex items-start gap-2.5 p-3 rounded-[16px] transition-all"
                                      style={{
                                        background: tip.acted ? '#fffbeb' : '#faf8f4',
                                        border: `1.5px solid ${tip.acted ? '#f0ebe0' : '#f0ebe0'}`,
                                      }}
                                    >
                                      {/* Dot */}
                                      <div
                                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                                        style={{ background: tip.acted ? '#fbbf24' : '#e0d8c8' }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#a0937c' }}>
                                            Semaine {tip.week_number}
                                          </span>
                                          {tip.acted && (
                                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full" style={{ color: '#92400e', background: '#fde68a' }}>
                                              ✓ Lu
                                            </span>
                                          )}
                                        </div>
                                        <p
                                          className="text-xs leading-relaxed mt-1"
                                          style={{
                                            color: '#1a1a2e',
                                            display: isDetailOpen ? 'block' : '-webkit-box',
                                            WebkitLineClamp: isDetailOpen ? undefined : 2,
                                            WebkitBoxOrient: isDetailOpen ? undefined : 'vertical',
                                            overflow: isDetailOpen ? 'visible' : 'hidden',
                                          }}
                                        >
                                          {tip.content}
                                        </p>

                                        {/* Detail deplie */}
                                        {isDetailOpen && tip.advice && (
                                          <div className="mt-2 pt-2" style={{ borderTop: '1px solid #f0ebe0' }}>
                                            <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#92400e' }}>
                                              💡 Essaye cette semaine
                                            </p>
                                            <p className="text-xs leading-relaxed" style={{ color: '#1a1a2e' }}>{tip.advice}</p>
                                          </div>
                                        )}
                                      </div>
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </>
                        )}
                      </>
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
