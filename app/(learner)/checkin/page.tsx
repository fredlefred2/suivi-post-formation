export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatWeek, calculateStreak, getCheckinContext } from '@/lib/utils'
import CheckinForm from './CheckinForm'

export default async function CheckinPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const checkinCtx = getCheckinContext()

  const [{ data: axes }, { data: existingCheckin }, { data: allCheckins }] = await Promise.all([
    supabase.from('axes').select('id, subject, initial_score, difficulty').eq('learner_id', user!.id).order('created_at'),
    supabase.from('checkins').select('*').eq('learner_id', user!.id).eq('week_number', checkinCtx.checkinWeek).eq('year', checkinCtx.checkinYear).maybeSingle(),
    supabase.from('checkins').select('*').eq('learner_id', user!.id).order('year', { ascending: false }).order('week_number', { ascending: false }),
  ])

  const displayCheckins = allCheckins ?? []

  const WEATHER_EMOJI: Record<string, string> = { sunny: '☀️', cloudy: '⛅', stormy: '⛈️' }
  const WEATHER_BG: Record<string, string> = { sunny: 'bg-amber-50/50', cloudy: 'bg-sky-50/50', stormy: 'bg-red-50/50' }

  // Header navy — unique, toujours le meme
  const headerBlock = (
    <div
      className="rounded-[28px] px-5 py-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
    >
      <div className="absolute -top-8 -right-5 w-28 h-28 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />
      <div className="relative">
        <h1 className="text-xl font-extrabold text-white">Check-in hebdomadaire</h1>
        <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>Fais le point sur ta semaine</p>
      </div>
    </div>
  )

  // Historique compact
  const historySection = displayCheckins.length > 0 ? (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <h2 className="text-[13px] font-bold" style={{ color: '#1a1a2e' }}>Mes check-ins</h2>
        <span className="text-[11px] font-medium" style={{ color: '#a0937c' }}>{displayCheckins.length} check-in{displayCheckins.length > 1 ? 's' : ''}</span>
      </div>
      <div className="space-y-2">
        {displayCheckins.map((ci) => (
          <div key={ci.id} className={`flex gap-3 rounded-[16px] p-3 bg-white ${WEATHER_BG[ci.weather as string] ?? ''}`} style={{ border: '1.5px solid #f0ebe0' }}>
            <div className="flex flex-col items-center justify-center shrink-0 w-12">
              <span className="text-[26px] leading-none">{WEATHER_EMOJI[ci.weather as string] ?? '❓'}</span>
              <span className="text-[9px] font-semibold mt-1" style={{ color: '#a0937c' }}>{`S${ci.week_number}`}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] mb-1" style={{ color: '#a0937c' }}>{formatWeek(ci.week_number, ci.year)}</p>
              {ci.what_worked && (
                <p className="text-xs leading-relaxed" style={{ color: '#374151' }}>
                  <span className="text-[11px]" style={{ color: '#059669' }}>✅</span> {ci.what_worked}
                </p>
              )}
              {ci.difficulties && (
                <p className="text-xs leading-relaxed mt-0.5" style={{ color: '#374151' }}>
                  <span className="text-[11px]" style={{ color: '#dc2626' }}>⚠️</span> {ci.difficulties}
                </p>
              )}
              {!ci.what_worked && !ci.difficulties && (
                <p className="text-[11px] italic" style={{ color: '#a0937c' }}>Aucun commentaire</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  ) : null

  // Fenêtre fermée (mardi → jeudi)
  if (!checkinCtx.isOpen) {
    return (
      <div className="space-y-3 pb-4">
        {headerBlock}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-[16px] bg-white" style={{ border: '1.5px solid #f0ebe0' }}>
          <span className="text-[22px]">📅</span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#1a1a2e' }}>Pas de check-in pour le moment</p>
            <p className="text-[11px]" style={{ color: '#a0937c' }}>Disponible à partir de vendredi</p>
          </div>
        </div>
        {historySection}
      </div>
    )
  }

  if (existingCheckin) {
    return (
      <div className="space-y-3 pb-4">
        {headerBlock}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-[16px]" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
          <span className="text-[22px]">✅</span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#1a1a2e' }}>Check-in de la {checkinCtx.weekLabel} effectué !</p>
            <p className="text-[11px]" style={{ color: '#a0937c' }}>Rendez-vous vendredi prochain</p>
          </div>
        </div>
        {historySection}
      </div>
    )
  }

  if (!axes || axes.length === 0) {
    return (
      <div className="space-y-3 pb-4">
        {headerBlock}
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-[16px] bg-white" style={{ border: '1.5px solid #f0ebe0' }}>
          <span className="text-[22px]">🎯</span>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: '#1a1a2e' }}>Définis d&apos;abord tes axes de progrès</p>
            <p className="text-[11px]" style={{ color: '#a0937c' }}>Avant de faire ton premier check-in</p>
          </div>
        </div>
        <div className="text-center pt-2">
          <a href="/axes" className="btn-primary inline-block">Définir mes axes</a>
        </div>
        {historySection}
      </div>
    )
  }

  return (
    <div className="space-y-3 pb-4">
      {headerBlock}
      <p className="text-[11px] px-1" style={{ color: '#a0937c' }}>{checkinCtx.weekLabel}</p>
      <CheckinForm
        axes={axes}
        weekLabel={checkinCtx.weekLabel}
        streak={calculateStreak(
          (allCheckins ?? []).map(c => ({ week_number: c.week_number, year: c.year })),
          checkinCtx.checkinWeek, checkinCtx.checkinYear
        )}
      />
      {historySection}
    </div>
  )
}
