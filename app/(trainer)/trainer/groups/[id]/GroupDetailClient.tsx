'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, Download, Pencil, Loader2 } from 'lucide-react'
import { getDynamique } from '@/lib/axeHelpers'
import TrainerTeamMessages from '@/app/components/TrainerTeamMessages'
import type { GroupMember, GroupAction } from './page'

const WEATHER_ICONS: Record<string, string> = { sunny: '☀️', cloudy: '⛅', stormy: '⛈️' }

const LEVEL_COLORS: Record<string, string> = {
  Veille: 'bg-slate-100 text-slate-600',
  Impulsion: 'bg-sky-100 text-sky-700',
  'Rythme': 'bg-emerald-100 text-emerald-700',
  'Intensité': 'bg-orange-100 text-orange-700',
  Propulsion: 'bg-rose-100 text-rose-700',
}

const LEVEL_BORDER: Record<string, string> = {
  Veille: 'border-l-slate-300',
  Impulsion: 'border-l-sky-400',
  'Rythme': 'border-l-emerald-400',
  'Intensité': 'border-l-orange-400',
  Propulsion: 'border-l-rose-400',
}

const RANK_STYLES: Record<number, string> = {
  1: 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200',
  2: 'bg-gradient-to-r from-gray-50 to-slate-50 border-slate-200',
  3: 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200',
}

const RANK_CIRCLE: Record<number, string> = {
  1: 'bg-amber-400 text-white',
  2: 'bg-slate-400 text-white',
  3: 'bg-orange-400 text-white',
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
  currentUserId,
}: {
  group: { id: string; name: string; theme: string | null }
  members: GroupMember[]
  recentActions: GroupAction[]
  pendingCheckins: string[]
  avgWeather: string | null
  actionsThisWeek: number
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
    <div className="space-y-4 pb-24">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/trainer/dashboard" className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors">
          <ChevronLeft size={16} />
          <span>Mes groupes</span>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-semibold truncate">{group.name}</span>
      </div>

      {/* Hero block gradient */}
      <div className="rounded-2xl overflow-hidden relative" style={{
        background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
      }}>
        {/* Decorative circles */}
        <div className="absolute top-4 right-8 w-24 h-24 bg-white/10 rounded-full blur-xl" />
        <div className="absolute bottom-2 left-6 w-16 h-16 bg-white/10 rounded-full blur-lg" />

        <div className="relative p-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-white font-extrabold text-xl tracking-tight">{group.name}</h1>
              <p className="text-indigo-200 text-sm mt-0.5">{members.length} participant{members.length !== 1 ? 's' : ''}</p>
            </div>
            <span className="text-3xl">{avgWeather ? WEATHER_ICONS[avgWeather] : '—'}</span>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center border border-white/20">
              <p className="text-white font-bold text-lg">{members.length}</p>
              <p className="text-indigo-200 text-[11px]">membres</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center border border-white/20">
              <p className="text-emerald-300 font-bold text-lg">+{actionsThisWeek}</p>
              <p className="text-indigo-200 text-[11px]">cette semaine</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 text-center border border-white/20">
              <p className="text-amber-300 font-bold text-lg">{pendingCheckins.length}</p>
              <p className="text-indigo-200 text-[11px]">en attente</p>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleDownloadReport}
              disabled={isDownloading}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-medium rounded-xl transition-all border border-white/20 disabled:opacity-50"
            >
              {isDownloading
                ? <><Loader2 size={14} className="animate-spin" /> {downloadStatus}</>
                : <><Download size={14} /> Rapport</>
              }
            </button>
            <Link
              href={`/trainer/groups/${group.id}/tips`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white text-sm font-medium rounded-xl transition-all border border-white/20"
            >
              <Pencil size={14} /> Gérer
            </Link>
          </div>
        </div>
      </div>

      {/* Pending check-ins banner */}
      {pendingCheckins.length > 0 && (
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
                <button
                  key={i}
                  onClick={() => setCarouselPage(i)}
                  className={`w-2 h-2 rounded-full transition-all duration-200 ${
                    i === carouselPage ? 'bg-indigo-500 w-4' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ranking */}
      {members.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-800 text-base mb-3">Classement</h2>
          <div className="space-y-2">
            {members.map((member, idx) => {
              const rank = idx + 1
              const rankStyle = RANK_STYLES[rank] ?? 'bg-white border-gray-100'
              const circleStyle = RANK_CIRCLE[rank] ?? 'bg-gray-200 text-gray-600'
              const axeBadges = member.axeActionCounts.map((count) => getDynamique(count))

              return (
                <Link
                  key={member.learner_id}
                  href={`/trainer/learner/${member.learner_id}?group=${group.id}`}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${rankStyle}`}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${circleStyle}`}>
                    {rank}
                  </div>
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
                  <div className="flex gap-1 shrink-0">
                    {axeBadges.map((dyn, i) => (
                      <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${LEVEL_COLORS[dyn.label] ?? 'bg-gray-100 text-gray-500'}`}>
                        {dyn.icon}
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

      {/* Team messages */}
      <div className="fixed bottom-0 left-0 right-0 z-10">
        <div className="max-w-lg mx-auto">
          <TrainerTeamMessages groupId={group.id} currentUserId={currentUserId} />
        </div>
      </div>
    </div>
  )
}
