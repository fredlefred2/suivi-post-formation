'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, Download, Loader2 } from 'lucide-react'
import { getDynamique, getCurrentLevelIndex } from '@/lib/axeHelpers'
import TrainerTeamMessages from '@/app/components/TrainerTeamMessages'
import type { GroupMember, GroupAction } from './page'

const WEATHER_ICONS: Record<string, string> = { sunny: '☀️', cloudy: '⛅', stormy: '⛈️' }

// Couleurs identiques au TeamClient apprenant
const LEVEL_AVATAR_COLORS: Record<number, string> = {
  0: 'bg-slate-200 text-slate-700',
  1: 'bg-sky-200 text-sky-700',
  2: 'bg-emerald-200 text-emerald-700',
  3: 'bg-orange-200 text-orange-700',
  4: 'bg-rose-200 text-rose-700',
}

const LEVEL_BORDER: Record<string, string> = {
  Veille: 'border-l-slate-300',
  Impulsion: 'border-l-sky-400',
  'Rythme': 'border-l-emerald-400',
  'Intensité': 'border-l-orange-400',
  Propulsion: 'border-l-rose-400',
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function GroupDetailClient({
  group,
  members,
  recentActions,
  pendingCheckins,
  avgWeather,
  actionsThisWeek,
  groupRegularity,
  checkinPct,
  isCheckinOpen,
  currentUserId,
}: {
  group: { id: string; name: string; theme: string | null }
  members: GroupMember[]
  recentActions: GroupAction[]
  pendingCheckins: string[]
  avgWeather: string | null
  actionsThisWeek: number
  groupRegularity: number
  checkinPct: number
  isCheckinOpen: boolean
  currentUserId: string
}) {
  const carouselRef = useRef<HTMLDivElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState('')

  // Auto-scroll carousel
  const [carouselPage, setCarouselPage] = useState(0)
  const maxCarouselPage = Math.max(0, Math.ceil(recentActions.length / 2) - 1)

  useEffect(() => {
    if (recentActions.length <= 2) return
    const interval = setInterval(() => {
      setCarouselPage((p) => (p >= maxCarouselPage ? 0 : p + 1))
    }, 5000)
    return () => clearInterval(interval)
  }, [recentActions.length, maxCarouselPage])

  useEffect(() => {
    if (carouselRef.current) {
      const scrollTo = carouselPage * (240 + 12)
      carouselRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' })
    }
  }, [carouselPage])

  async function handleDownloadReport() {
    setIsDownloading(true)
    try {
      setDownloadStatus('Collecte des données...')
      const dataRes = await fetch(`/api/group-report?groupId=${group.id}&mode=data`, { credentials: 'include' })
      if (!dataRes.ok) throw new Error(`Erreur (${dataRes.status})`)
      const reportData = await dataRes.json()

      setDownloadStatus('Analyse IA...')
      let aiAnalysis = null
      try {
        const aiRes = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData),
        })
        if (aiRes.ok) {
          const rawText = await aiRes.text()
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          if (jsonMatch) aiAnalysis = JSON.parse(jsonMatch[0])
        }
      } catch { /* optionnel */ }

      setDownloadStatus('Génération PDF...')
      const pdfRes = await fetch('/api/group-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData, aiAnalysis }),
      })
      if (!pdfRes.ok) throw new Error(`Erreur PDF (${pdfRes.status})`)

      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfRes.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'rapport.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[PDF] Error:', err)
    }
    setIsDownloading(false)
    setDownloadStatus('')
  }

  return (
    <div className="space-y-4 pb-36">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/trainer/dashboard" className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
          <ChevronLeft size={16} />
          <span>Mes groupes</span>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-semibold truncate">{group.name}</span>
      </div>

      {/* Hero block gradient — conforme charte apprenant */}
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
          boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
        }}
      >
        {/* Decorative circles identiques dashboard apprenant */}
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">{group.name}</h1>
            <p className="text-xs text-indigo-200 mt-0.5">{members.length} participant{members.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {avgWeather && <span className="text-3xl drop-shadow-lg">{WEATHER_ICONS[avgWeather]}</span>}
            <button
              onClick={handleDownloadReport}
              disabled={isDownloading}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-white/90 hover:bg-white transition-colors disabled:opacity-50"
            >
              {isDownloading
                ? <><Loader2 size={13} className="animate-spin" /> {downloadStatus}</>
                : <><Download size={13} /> Rapport</>
              }
            </button>
          </div>
        </div>

        {/* 3 stats glass — taille text-2xl font-black comme dashboard apprenant */}
        <div className="relative grid grid-cols-3 gap-2">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className="text-2xl font-black text-white">{groupRegularity}%</div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">régularité</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className={`text-2xl font-black ${actionsThisWeek > 0 ? 'text-emerald-300' : 'text-white/40'}`}>
              {actionsThisWeek > 0 ? `+${actionsThisWeek}` : '0'}
            </div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">cette semaine</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            {isCheckinOpen ? (
              <>
                <div className={`text-2xl font-black ${pendingCheckins.length > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {pendingCheckins.length}
                </div>
                <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">en attente</p>
              </>
            ) : (
              <>
                <div className="text-2xl font-black text-white">{checkinPct}%</div>
                <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">check-ins</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pending check-ins banner */}
      {isCheckinOpen && pendingCheckins.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm">
          <span className="font-semibold text-amber-800">Check-ins en attente : </span>
          <span className="text-amber-700">{pendingCheckins.join(', ')}</span>
        </div>
      )}

      {/* Recent actions carousel */}
      {recentActions.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-800 text-base mb-3">Actions récentes</h2>
          <div
            ref={carouselRef}
            className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {recentActions.slice(0, 10).map((action) => {
              const level = getDynamique(action.axe_action_count)
              const borderColor = LEVEL_BORDER[level.label] || 'border-l-gray-300'
              return (
                <div
                  key={action.id}
                  className={`flex-shrink-0 w-[240px] bg-white rounded-xl border border-gray-100 shadow-sm p-3.5 snap-start border-l-4 ${borderColor}`}
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(99,102,241,0.08)' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                      {action.learner_first_name[0]}{action.learner_last_name[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-gray-800 truncate">
                        {action.learner_first_name} {action.learner_last_name}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">{action.axe_subject}</p>
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 line-clamp-2 leading-snug">{action.description}</p>
                  <div className="flex items-center justify-between mt-2.5 text-[11px] text-gray-400">
                    <span>{formatDate(action.created_at)}</span>
                    <div className="flex items-center gap-2">
                      {action.likes_count > 0 && <span>❤️ {action.likes_count}</span>}
                      {action.comments_count > 0 && <span>💬 {action.comments_count}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          {recentActions.length > 2 && (
            <div className="flex justify-center gap-1.5 mt-2">
              {Array.from({ length: maxCarouselPage + 1 }).map((_, i) => (
                <button key={i} onClick={() => setCarouselPage(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${i === carouselPage ? 'bg-indigo-500 w-4' : 'bg-gray-300'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ranking — badges identiques au TeamClient apprenant */}
      {members.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-800 text-base mb-3">Classement</h2>
          <div className="space-y-2">
            {members.map((member, idx) => {
              const rank = idx + 1
              // Styles podium identiques TeamClient
              const rankColors: Record<number, { bg: string; border: string; badge: string }> = {
                1: { bg: 'linear-gradient(135deg, #fef9c3 0%, #fde68a 100%)', border: '#fbbf24', badge: '#f59e0b' },
                2: { bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', border: '#cbd5e1', badge: '#94a3b8' },
                3: { bg: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)', border: '#fdba74', badge: '#f97316' },
              }
              const rc = rankColors[rank]

              // Badges niveaux identiques TeamClient : w-7 h-7 rounded-lg text-sm
              const axeBadges = member.axeActionCounts.map((count) => ({
                level: getCurrentLevelIndex(count),
                icon: getDynamique(count).icon,
              }))

              return (
                <Link
                  key={member.learner_id}
                  href={`/trainer/learner/${member.learner_id}?group=${group.id}`}
                  className="flex items-center gap-3 rounded-2xl p-3.5 active:opacity-80 transition-opacity"
                  style={rc ? {
                    background: rc.bg,
                    border: `1px solid ${rc.border}`,
                  } : {
                    background: 'white',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  {/* Rank badge identique TeamClient */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0"
                    style={rc ? {
                      background: rc.badge,
                      color: 'white',
                      boxShadow: `0 2px 8px ${rc.badge}66`,
                    } : {
                      background: '#e5e7eb',
                      color: '#6b7280',
                    }}
                  >
                    {rank}
                  </div>

                  {/* Name + weather */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {member.first_name} {member.last_name}
                      {member.lastWeather && <span className="ml-1.5">{WEATHER_ICONS[member.lastWeather]}</span>}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {member.totalActions} action{member.totalActions !== 1 ? 's' : ''}
                      {member.actionsThisWeek > 0 && (
                        <span className="text-emerald-500 ml-1">(+{member.actionsThisWeek})</span>
                      )}
                    </p>
                  </div>

                  {/* Level badges identiques TeamClient : w-7 h-7 rounded-lg text-sm */}
                  <div className="flex items-center gap-1 shrink-0">
                    {axeBadges.map((m, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-sm ${LEVEL_AVATAR_COLORS[m.level] ?? LEVEL_AVATAR_COLORS[0]}`}
                      >
                        {m.icon}
                      </span>
                    ))}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {members.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">Aucun participant dans ce groupe.</p>
          <p className="text-sm text-gray-400 mt-1">Ajoutez des apprenants depuis la salle d&apos;attente.</p>
        </div>
      )}

      {/* Team messages — au-dessus du bottom nav */}
      <div className="fixed bottom-16 left-0 right-0 z-10 sm:bottom-0">
        <div className="max-w-lg mx-auto px-4">
          <TrainerTeamMessages groupId={group.id} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  )
}
