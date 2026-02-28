import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, formatWeek } from '@/lib/utils'
import CheckinForm from './CheckinForm'

export default async function CheckinPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { week, year } = getCurrentWeek()

  const [{ data: axes }, { data: existingCheckin }] = await Promise.all([
    supabase.from('axes').select('id, subject, initial_score, difficulty').eq('learner_id', user!.id).order('created_at'),
    supabase.from('checkins').select('*').eq('learner_id', user!.id).eq('week_number', week).eq('year', year).maybeSingle(),
  ])

  if (existingCheckin) {
    return (
      <div className="space-y-4 pb-4">
        <h1 className="page-title">Check-in hebdomadaire</h1>
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">✅</div>
          <h2 className="font-semibold text-gray-900 mb-1">
            Check-in de la semaine {week} déjà effectué !
          </h2>
          <p className="text-sm text-gray-500">
            Rendez-vous la semaine prochaine. En attendant, consultez votre{' '}
            <a href="/history" className="text-indigo-600 hover:underline">historique</a>.
          </p>
        </div>
      </div>
    )
  }

  if (!axes || axes.length === 0) {
    return (
      <div className="space-y-4 pb-4">
        <h1 className="page-title">Check-in hebdomadaire</h1>
        <div className="card text-center py-10">
          <div className="text-4xl mb-3">🎯</div>
          <p className="text-gray-500 mb-3">Définissez d&apos;abord vos axes de progrès avant de faire un check-in.</p>
          <a href="/axes" className="btn-primary">Définir mes axes</a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="page-title">Check-in hebdomadaire</h1>
        <p className="text-sm text-gray-500 mt-1">{formatWeek(week, year)}</p>
      </div>
      <CheckinForm axes={axes} />
    </div>
  )
}
