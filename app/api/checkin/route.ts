import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCheckinContext } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const checkinCtx = getCheckinContext()
  if (!checkinCtx.isOpen) {
    return NextResponse.json({ error: 'Le check-in n\'est disponible que du vendredi au lundi.' }, { status: 400 })
  }

  const { checkinWeek: week, checkinYear: year } = checkinCtx

  // Vérifier si déjà fait cette semaine
  const { data: existing } = await supabase
    .from('checkins')
    .select('id')
    .eq('learner_id', user.id)
    .eq('week_number', week)
    .eq('year', year)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Tu as déjà effectué ton check-in pour cette semaine.' }, { status: 400 })
  }

  const body = await req.json()
  const { weather, what_worked, difficulties, axes } = body as {
    weather: string
    what_worked: string | null
    difficulties: string | null
    axes: Array<{ id: string; score: number }>
  }

  if (!weather) {
    return NextResponse.json({ error: 'La météo est requise.' }, { status: 400 })
  }

  // Créer le check-in
  const { error: checkinError } = await supabase.from('checkins').insert({
    learner_id: user.id,
    week_number: week,
    year,
    weather,
    what_worked: what_worked || null,
    difficulties: difficulties || null,
  })

  if (checkinError) {
    console.error('Checkin insert error:', checkinError)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  // Enregistrer les scores des axes
  for (const axe of axes ?? []) {
    if (axe.score) {
      await supabase.from('axis_scores').upsert({
        axe_id: axe.id,
        learner_id: user.id,
        score: axe.score,
        week_number: week,
        year,
      }, { onConflict: 'axe_id,week_number,year' })
    }
  }

  return NextResponse.json({ success: true })
}
