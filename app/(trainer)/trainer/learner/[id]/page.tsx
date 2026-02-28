import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatWeek } from '@/lib/utils'
import { WEATHER_LABELS, WEATHER_COLORS } from '@/lib/types'
import LearnerChart from './LearnerChart'

export default async function LearnerDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { group?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Vérifier que l'apprenant est dans un groupe du formateur
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups!inner(trainer_id)')
    .eq('learner_id', params.id)
    .eq('groups.trainer_id', user!.id)
    .limit(1)
    .maybeSingle()

  if (!membership) notFound()

  const [
    { data: profile },
    { data: axes },
    { data: checkins },
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, created_at').eq('id', params.id).single(),
    supabase.from('axes').select('*, actions(*), axis_scores(*)').eq('learner_id', params.id).order('created_at'),
    supabase.from('checkins').select('*').eq('learner_id', params.id).order('year').order('week_number'),
  ])

  if (!profile) notFound()

  // Données pour le graphique
  const chartData = (checkins ?? []).map((ci) => {
    const point: Record<string, unknown> = {
      label: `S${ci.week_number}`,
      week: ci.week_number,
      year: ci.year,
    }
    for (const axe of axes ?? []) {
      const score = (axe.axis_scores as Array<{ week_number: number; year: number; score: number }>)
        ?.find((s) => s.week_number === ci.week_number && s.year === ci.year)
      if (score) {
        point[axe.subject.substring(0, 15)] = score.score
      }
    }
    return point
  })

  const axeNames = (axes ?? []).map((a) => a.subject.substring(0, 15))
  const backHref = searchParams.group ? `/trainer/groups/${searchParams.group}` : '/trainer/groups'

  return (
    <div className="space-y-6 pb-4">
      <div>
        <Link href={backHref} className="text-sm text-indigo-600 hover:underline">
          ← Retour
        </Link>
        <h1 className="page-title mt-2">
          {profile.first_name} {profile.last_name}
        </h1>
        <p className="text-sm text-gray-400">
          {checkins?.length ?? 0} check-in{(checkins?.length ?? 0) > 1 ? 's' : ''} effectué{(checkins?.length ?? 0) > 1 ? 's' : ''}
        </p>
      </div>

      {/* Graphique d'évolution */}
      {chartData.length > 1 && axeNames.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">Évolution des scores</h2>
          <LearnerChart data={chartData} axeNames={axeNames} />
        </div>
      )}

      {/* Axes de progrès */}
      {axes && axes.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">Axes de progrès</h2>
          <div className="space-y-4">
            {axes.map((axe) => {
              const scores = axe.axis_scores as Array<{ score: number; week_number: number; year: number }>
              const latestScore = scores?.length > 0
                ? scores.sort((a, b) => b.year !== a.year ? b.year - a.year : b.week_number - a.week_number)[0].score
                : null
              const progression = latestScore ? latestScore - axe.initial_score : null
              const completedActions = (axe.actions as Array<{ completed: boolean }>).filter((a) => a.completed).length

              return (
                <div key={axe.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{axe.subject}</p>
                      {axe.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{axe.description}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-2">
                        {progression !== null && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${progression > 0 ? 'bg-emerald-100 text-emerald-700' : progression < 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                            {progression > 0 ? `+${progression}` : progression}
                          </span>
                        )}
                        <span className="font-bold text-indigo-600 text-lg">
                          {latestScore ?? axe.initial_score}/5
                        </span>
                      </div>
                      <p className="text-xs text-gray-400">Initial : {axe.initial_score}/5</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                      <div
                        className="bg-indigo-500 h-1.5 rounded-full"
                        style={{ width: `${((latestScore ?? axe.initial_score) / 5) * 100}%` }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    Actions : {completedActions}/{(axe.actions as Array<unknown>).length} terminée{completedActions > 1 ? 's' : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Historique des check-ins */}
      {checkins && checkins.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">Historique des check-ins</h2>
          <div className="space-y-3">
            {[...checkins].reverse().map((ci) => (
              <div key={ci.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${WEATHER_COLORS[ci.weather as keyof typeof WEATHER_COLORS]}`}>
                    {WEATHER_LABELS[ci.weather as keyof typeof WEATHER_LABELS]}
                  </span>
                  <span className="text-xs text-gray-400">{formatWeek(ci.week_number, ci.year)}</span>
                </div>
                {ci.what_worked && (
                  <div className="mb-1.5">
                    <p className="text-xs font-medium text-emerald-700">✅ Ce qui a bien fonctionné</p>
                    <p className="text-sm text-gray-700">{ci.what_worked}</p>
                  </div>
                )}
                {ci.difficulties && (
                  <div>
                    <p className="text-xs font-medium text-red-600">⚠️ Difficultés</p>
                    <p className="text-sm text-gray-700">{ci.difficulties}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(!checkins || checkins.length === 0) && (!axes || axes.length === 0) && (
        <div className="card text-center py-10">
          <p className="text-gray-400">Cet apprenant n&apos;a pas encore commencé à utiliser l&apos;application.</p>
        </div>
      )}
    </div>
  )
}
