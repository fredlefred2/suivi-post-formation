'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

export async function submitCheckin(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const { week, year } = getCurrentWeek()

  // Vérifier si déjà fait cette semaine
  const { data: existing } = await supabase
    .from('checkins')
    .select('id')
    .eq('learner_id', user.id)
    .eq('week_number', week)
    .eq('year', year)
    .maybeSingle()

  if (existing) return { error: 'Vous avez déjà effectué votre check-in cette semaine.' }

  // Créer le check-in
  const { error: checkinError } = await supabase.from('checkins').insert({
    learner_id: user.id,
    week_number: week,
    year,
    weather: formData.get('weather') as string,
    what_worked: formData.get('what_worked') as string || null,
    difficulties: formData.get('difficulties') as string || null,
  })

  if (checkinError) return { error: checkinError.message }

  // Enregistrer les scores des axes
  const axeIds = formData.getAll('axe_ids') as string[]
  for (const axeId of axeIds) {
    const score = formData.get(`score_${axeId}`)
    if (score) {
      await supabase.from('axis_scores').upsert({
        axe_id: axeId,
        learner_id: user.id,
        score: parseInt(score as string),
        week_number: week,
        year,
      }, { onConflict: 'axe_id,week_number,year' })
    }
  }

  revalidatePath('/dashboard')
  revalidatePath('/history')
  revalidatePath('/checkin')
}
