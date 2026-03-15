export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { formatWeek, calculateStreak, getCheckinContext } from '@/lib/utils'
import { WEATHER_LABELS, WEATHER_COLORS } from '@/lib/types'
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
  const WEATHER_BG: Record<string, string> = { sunny: 'bg-amber-50', cloudy: 'bg-sky-50', stormy: 'bg-red-50' }

  const historySection = displayCheckins.length > 0 ? (
    <div className="card">
      <h2 className="section-title mb-4">Mes check-ins ({displayCheckins.length})</h2>
      <div className="space-y-3">
        {displayCheckins.map((ci) => (
          <div key={ci.id} className={`flex gap-3 border border-gray-100 rounded-xl p-3 ${WEATHER_BG[ci.weather as string] ?? ''}`}>
            <div className="flex flex-col items-center justify-center shrink-0 w-14">
              <span className="text-3xl leading-none">{WEATHER_EMOJI[ci.weather as string] ?? '❓'}</span>
              <span className="text-[10px] text-gray-400 mt-1">{`S${ci.week_number}`}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-gray-400 mb-1">{formatWeek(ci.week_number, ci.year)}</p>
              {ci.what_worked && (
                <p className="text-xs text-gray-700 leading-relaxed">
                  <span className="font-medium text-emerald-600">✅</span> {ci.what_worked}
                </p>
              )}
              {ci.difficulties && (
                <p className="text-xs text-gray-700 leading-relaxed mt-0.5">
                  <span className="font-medium text-red-500">⚠️</span> {ci.difficulties}
                </p>
              )}
              {!ci.what_worked && !ci.difficulties && (
                <p className="text-xs text-gray-400 italic">Aucun commentaire</p>
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
      <div className="space-y-6 pb-4">
        <h1 className="page-title">Check-in hebdomadaire</h1>
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">📅</div>
          <h2 className="font-semibold text-gray-900 mb-1">
            Pas de check-in pour le moment
          </h2>
          <p className="text-sm text-gray-500">
            Le check-in sera disponible à partir de vendredi.
          </p>
        </div>
        {historySection}
      </div>
    )
  }

  if (existingCheckin) {
    return (
      <div className="space-y-6 pb-4">
        <h1 className="page-title">Check-in hebdomadaire</h1>
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-semibold text-gray-900 mb-1">
            Check-in de la {checkinCtx.weekLabel} déjà effectué !
          </h2>
          <p className="text-sm text-gray-500">
            Rendez-vous vendredi prochain.
          </p>
        </div>
        {historySection}
      </div>
    )
  }

  if (!axes || axes.length === 0) {
    return (
      <div className="space-y-6 pb-4">
        <h1 className="page-title">Check-in hebdomadaire</h1>
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-gray-500 mb-3">Définissez d&apos;abord vos axes de progrès avant de faire un check-in.</p>
          <a href="/axes" className="btn-primary">Définir mes axes</a>
        </div>
        {historySection}
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="page-title">Check-in hebdomadaire</h1>
        <p className="text-sm text-gray-500 mt-1">{checkinCtx.weekLabel}</p>
      </div>
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
