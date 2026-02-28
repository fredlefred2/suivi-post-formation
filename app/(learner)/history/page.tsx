import { createClient } from '@/lib/supabase/server'
import { formatWeek } from '@/lib/utils'
import { WEATHER_LABELS, WEATHER_COLORS } from '@/lib/types'
import ProgressChart from './ProgressChart'

export default async function HistoryPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: checkins }, { data: axes }] = await Promise.all([
    supabase
      .from('checkins')
      .select('*')
      .eq('learner_id', user!.id)
      .order('year', { ascending: true })
      .order('week_number', { ascending: true }),
    supabase
      .from('axes')
      .select('id, subject, actions(id, created_at)')
      .eq('learner_id', user!.id)
      .order('created_at'),
  ])

  // Construire le graphique en cumul d'actions menées, semaine par semaine
  const chartData: Record<string, unknown>[] = []
  if (checkins && checkins.length > 0 && axes) {
    for (const ci of checkins) {
      const ciDate = new Date(ci.created_at as string)
      // On ajoute un jour pour inclure les actions créées le même jour que le check-in
      ciDate.setHours(23, 59, 59, 999)

      const point: Record<string, unknown> = {
        label: `S${ci.week_number}`,
      }

      for (const axe of axes) {
        const actions = (axe.actions as Array<{ id: string; created_at: string }>) ?? []
        const cumul = actions.filter(a => new Date(a.created_at) <= ciDate).length
        point[axe.subject.substring(0, 20)] = cumul
      }

      chartData.push(point)
    }
  }

  const axeNames = axes?.map((a) => a.subject.substring(0, 20)) ?? []

  return (
    <div className="space-y-6 pb-4">
      <h1 className="page-title">Historique & évolution</h1>

      {!checkins || checkins.length === 0 ? (
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-gray-500">Votre historique s&apos;affichera ici après vos premiers check-ins.</p>
        </div>
      ) : (
        <>
          {/* Graphique cumul d'actions */}
          {chartData.length > 0 && axeNames.length > 0 && (
            <div className="card">
              <h2 className="section-title mb-1">Cumul des actions menées</h2>
              <p className="text-xs text-gray-400 mb-4">Nombre total d&apos;actions enregistrées par axe, semaine après semaine</p>
              <ProgressChart data={chartData} axeNames={axeNames} />
            </div>
          )}

          {/* Liste des check-ins */}
          <div className="card">
            <h2 className="section-title mb-4">Tous les check-ins ({checkins.length})</h2>
            <div className="space-y-4">
              {[...checkins].reverse().map((ci) => (
                <div key={ci.id} className="border border-gray-100 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${WEATHER_COLORS[ci.weather as keyof typeof WEATHER_COLORS]}`}>
                      {WEATHER_LABELS[ci.weather as keyof typeof WEATHER_LABELS]}
                    </span>
                    <span className="text-xs text-gray-400">{formatWeek(ci.week_number, ci.year)}</span>
                  </div>

                  {ci.what_worked && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-emerald-700 mb-0.5">✅ Ce qui a bien fonctionné</p>
                      <p className="text-sm text-gray-700">{ci.what_worked}</p>
                    </div>
                  )}
                  {ci.difficulties && (
                    <div>
                      <p className="text-xs font-medium text-red-600 mb-0.5">⚠️ Difficultés</p>
                      <p className="text-sm text-gray-700">{ci.difficulties}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
