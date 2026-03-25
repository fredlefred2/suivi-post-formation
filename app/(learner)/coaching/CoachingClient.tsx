'use client'

import { useState, useEffect } from 'react'
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react'

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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Mon coaching</h1>
          <p className="text-xs text-gray-500">{sentTips.length} conseil{sentTips.length > 1 ? 's' : ''} reçu{sentTips.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      {tips.length === 0 ? (
        <div className="card text-center py-10">
          <Sparkles size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500">Tes conseils apparaîtront ici chaque semaine.</p>
          <p className="text-xs text-gray-400 mt-1">Crée tes axes de progrès pour recevoir du coaching personnalisé !</p>
        </div>
      ) : (
        <div className="space-y-3">
          {axeGroups.map(axe => {
            const isExpanded = expandedAxes.has(axe.axeId)
            const axeSentTips = axe.tips.filter(t => t.sent)

            return (
              <div key={axe.axeId} className="card overflow-hidden">
                {/* Header axe */}
                <button
                  onClick={() => toggleAxe(axe.axeId)}
                  className="w-full flex items-center gap-2 p-3 hover:bg-gray-50 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown size={16} className="text-indigo-500" />
                    : <ChevronRight size={16} className="text-indigo-500" />
                  }
                  <span className="text-sm font-semibold text-gray-800">🎯 {axe.axeSubject}</span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {axeSentTips.length}/{axe.tips.length}
                  </span>
                </button>

                {/* Tips */}
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2">
                    {axe.tips.filter(t => t.sent).map(tip => (
                      <TipCard key={tip.id} tip={tip} />
                    ))}
                    {axeSentTips.length === 0 && (
                      <p className="text-xs text-gray-400 text-center py-3">Pas encore de conseil pour cet axe</p>
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

function TipCard({ tip }: { tip: Tip }) {
  return (
    <div className={`rounded-xl border p-3 ${
      tip.acted ? 'bg-green-50 border-green-200' : 'bg-white border-indigo-100'
    }`}>
      {/* Semaine + status */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
          Semaine {tip.week_number}
        </span>
        {tip.acted && <span className="text-xs text-green-600">✅ Lu</span>}
      </div>

      {/* Rappel */}
      <div className="flex gap-2.5 items-start mb-2">
        <span className="text-xl shrink-0 mt-0.5">🥷</span>
        <div className="bg-gray-50 border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2.5">
          <p className="text-sm text-gray-800 leading-relaxed">{tip.content}</p>
        </div>
      </div>

      {/* Conseil */}
      {tip.advice && (
        <div className="bg-indigo-50 rounded-lg p-2.5 mt-2">
          <p className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide mb-0.5">💡 Conseil de la semaine</p>
          <p className="text-sm text-indigo-900 leading-relaxed">{tip.advice}</p>
        </div>
      )}
    </div>
  )
}
