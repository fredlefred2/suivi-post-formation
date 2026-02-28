import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, formatWeek } from '@/lib/utils'
import { WEATHER_LABELS, WEATHER_COLORS } from '@/lib/types'
import { UserPlus } from 'lucide-react'

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { week, year } = getCurrentWeek()

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', params.id)
    .eq('trainer_id', user!.id)
    .single()

  if (!group) notFound()

  const { data: members } = await supabase
    .from('group_members')
    .select('learner_id, joined_at, profiles(id, first_name, last_name)')
    .eq('group_id', params.id)

  const learnerIds = members?.map((m) => m.learner_id) ?? []

  let learnersData: Array<{
    id: string
    first_name: string
    last_name: string
    joined_at: string
    thisWeekCheckin: { weather: string } | null
    checkinCount: number
    axesCount: number
  }> = []

  if (learnerIds.length > 0) {
    const [
      { data: thisWeekCheckins },
      { data: allCheckins },
      { data: axes },
    ] = await Promise.all([
      supabase
        .from('checkins')
        .select('learner_id, weather')
        .in('learner_id', learnerIds)
        .eq('week_number', week)
        .eq('year', year),
      supabase
        .from('checkins')
        .select('learner_id')
        .in('learner_id', learnerIds),
      supabase
        .from('axes')
        .select('learner_id')
        .in('learner_id', learnerIds),
    ])

    learnersData = (members ?? []).map((m) => {
      const profile = m.profiles as unknown as { id: string; first_name: string; last_name: string }
      return {
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        joined_at: m.joined_at,
        thisWeekCheckin: thisWeekCheckins?.find((c) => c.learner_id === profile.id) ?? null,
        checkinCount: allCheckins?.filter((c) => c.learner_id === profile.id).length ?? 0,
        axesCount: axes?.filter((a) => a.learner_id === profile.id).length ?? 0,
      }
    })
  }

  // Tendances météo (toutes les semaines)
  const allCheckinsList = learnerIds.length > 0
    ? (await supabase.from('checkins').select('weather').in('learner_id', learnerIds)).data ?? []
    : []

  const weatherCounts = {
    sunny: allCheckinsList.filter((c) => c.weather === 'sunny').length,
    cloudy: allCheckinsList.filter((c) => c.weather === 'cloudy').length,
    stormy: allCheckinsList.filter((c) => c.weather === 'stormy').length,
  }

  return (
    <div className="space-y-6 pb-4">
      <div>
        <Link href="/trainer/groups" className="text-sm text-indigo-600 hover:underline">
          ← Retour aux groupes
        </Link>
        <h1 className="page-title mt-2">{group.name}</h1>
        <p className="text-sm text-gray-400">Semaine courante : {formatWeek(week, year)}</p>
      </div>

      {/* Stats météo globales */}
      {allCheckinsList.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-3">Tendance météo du groupe</h2>
          <p className="text-xs text-gray-400 mb-3">Basé sur {allCheckinsList.length} check-in{allCheckinsList.length > 1 ? 's' : ''} au total</p>
          <div className="grid grid-cols-3 gap-3">
            {(['sunny', 'cloudy', 'stormy'] as const).map((w) => (
              <div key={w} className={`rounded-lg p-3 text-center ${WEATHER_COLORS[w]}`}>
                <p className="text-2xl">{w === 'sunny' ? '☀️' : w === 'cloudy' ? '⛅' : '⛈️'}</p>
                <p className="font-bold text-lg">{weatherCounts[w]}</p>
                <p className="text-xs mt-0.5">{Math.round((weatherCounts[w] / allCheckinsList.length) * 100)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste apprenants */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Apprenants ({learnersData.length})</h2>
          <Link
            href="/trainer/apprenants"
            className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors border border-indigo-200"
          >
            <UserPlus size={14} />
            Gérer les apprenants
          </Link>
        </div>

        {learnersData.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">Aucun apprenant dans ce groupe.</p>
        ) : (
          <div className="space-y-2">
            {learnersData.map((learner) => (
              <Link
                key={learner.id}
                href={`/trainer/learner/${learner.id}?group=${params.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 font-semibold flex items-center justify-center text-sm shrink-0">
                  {learner.first_name[0]}{learner.last_name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{learner.first_name} {learner.last_name}</p>
                  <p className="text-xs text-gray-400">
                    {learner.axesCount} axe{learner.axesCount > 1 ? 's' : ''} · {learner.checkinCount} check-in{learner.checkinCount > 1 ? 's' : ''}
                  </p>
                </div>
                {learner.thisWeekCheckin ? (
                  <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${WEATHER_COLORS[learner.thisWeekCheckin.weather as keyof typeof WEATHER_COLORS]}`}>
                    {WEATHER_LABELS[learner.thisWeekCheckin.weather as keyof typeof WEATHER_LABELS]}
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-400 px-2 py-1 rounded-full shrink-0">
                    Pas encore fait
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
