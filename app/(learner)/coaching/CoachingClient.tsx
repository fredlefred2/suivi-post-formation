'use client'

import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, Check, Clock } from 'lucide-react'

interface Tip {
  id: string
  content: string
  advice: string | null
  week_number: number
  sent: boolean
  acted: boolean
  axe_id: string
  axe_subject: string
}

interface AxeGroup {
  axeId: string
  axeSubject: string
  tips: Tip[]
}

export default function CoachingClient({ userId, firstName }: { userId: string; firstName: string }) {
  const [axeGroups, setAxeGroups] = useState<AxeGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedAxe, setExpandedAxe] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/tips/history')
      .then(r => r.json())
      .then(data => {
        setAxeGroups(data.axeGroups || [])
        // Auto-expand first axe
        if (data.axeGroups?.length > 0) setExpandedAxe(data.axeGroups[0].axeId)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="px-4 py-6 space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-lg w-48" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
        <div className="h-32 bg-gray-200 rounded-2xl" />
      </div>
    )
  }

  const totalTips = axeGroups.reduce((sum, g) => sum + g.tips.length, 0)
  const readTips = axeGroups.reduce((sum, g) => sum + g.tips.filter(t => t.acted).length, 0)

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full flex items-center justify-center text-2xl"
             style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', boxShadow: '0 2px 8px rgba(245,158,11,0.3)' }}>
          🧑‍🏫
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Ton espace coaching</h1>
          <p className="text-xs text-gray-500">
            {readTips}/{totalTips} conseils consultés
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {totalTips > 0 && (
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Progression</span>
            <span className="font-semibold text-gray-700">{Math.round((readTips / totalTips) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(readTips / totalTips) * 100}%`,
                background: 'linear-gradient(90deg, #f59e0b, #d97706)',
              }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {axeGroups.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-3">🧑‍🏫</div>
          <p className="text-gray-700 font-medium">Pas encore de conseils</p>
          <p className="text-sm text-gray-500 mt-1">Les conseils apparaîtront après la création de tes axes</p>
        </div>
      )}

      {/* Axes accordion */}
      {axeGroups.map(group => {
        const isExpanded = expandedAxe === group.axeId
        const readCount = group.tips.filter(t => t.acted).length

        return (
          <div key={group.axeId} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Axe header */}
            <button
              onClick={() => setExpandedAxe(isExpanded ? null : group.axeId)}
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                <Sparkles size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{group.axeSubject}</p>
                <p className="text-[11px] text-gray-500">{readCount}/{group.tips.length} consultés</p>
              </div>
              <ChevronDown
                size={18}
                className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {/* Tips list */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2.5">
                {group.tips.map(tip => {
                  const isRead = tip.acted
                  const isSent = tip.sent
                  const isLocked = !isSent && !isRead

                  return (
                    <div
                      key={tip.id}
                      className={`rounded-xl p-3.5 transition-all ${
                        isLocked
                          ? 'bg-gray-50 opacity-50'
                          : isRead
                          ? 'bg-green-50/50 border border-green-200/50'
                          : 'bg-amber-50 border border-amber-200/50'
                      }`}
                    >
                      {/* Week badge + status */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${
                          isRead ? 'text-green-600' : isLocked ? 'text-gray-400' : 'text-amber-600'
                        }`}>
                          Semaine {tip.week_number}
                        </span>
                        {isRead && <Check size={12} className="text-green-500" />}
                        {isLocked && <Clock size={12} className="text-gray-400" />}
                      </div>

                      {isLocked ? (
                        <p className="text-xs text-gray-400 italic">Disponible prochainement...</p>
                      ) : (
                        <>
                          {/* Rappel */}
                          <p className="text-[13px] text-gray-800 leading-relaxed">
                            {tip.content}
                          </p>

                          {/* Conseil */}
                          {tip.advice && (
                            <div className="mt-2 pt-2 border-t border-gray-200/50">
                              <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider mb-1">
                                🎯 Conseil
                              </p>
                              <p className="text-[12px] text-gray-600 leading-relaxed">
                                {tip.advice}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
