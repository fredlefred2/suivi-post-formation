import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { secondFridayAfter } from '@/lib/utils'
import { sendNotification } from '@/lib/send-notification'

// Route protégée par un secret — appelée par Vercel Cron chaque vendredi à 9h
export async function GET(request: NextRequest) {
  // Vérification du secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  // Client Supabase avec service role (accès complet)
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()

  // Calcul semaine courante
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const currentWeek = Math.floor((now.getTime() - startOfWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  const currentYear = now.getFullYear()

  // Récupérer tous les apprenants
  const { data: allLearners } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, created_at')
    .eq('role', 'learner')

  const learners = (allLearners ?? []).filter((l) => {
    const firstEligible = secondFridayAfter(l.created_at)
    return now >= firstEligible
  })

  if (!learners || learners.length === 0) {
    return NextResponse.json({ message: 'Aucun participant éligible', sent: 0 })
  }

  // Filtrer ceux qui n'ont pas fait leur check-in cette semaine
  const learnerIds = learners.map((l) => l.id)
  const { data: doneCheckins } = await supabase
    .from('checkins')
    .select('learner_id')
    .in('learner_id', learnerIds)
    .eq('week_number', currentWeek)
    .eq('year', currentYear)

  const doneIds = new Set(doneCheckins?.map((c) => c.learner_id) ?? [])
  const toRemind = learners.filter((l) => !doneIds.has(l.id))

  if (toRemind.length === 0) {
    return NextResponse.json({ message: 'Tous les participants ont fait leur check-in', sent: 0 })
  }

  // Envoyer une notification push à chaque apprenant
  let sent = 0
  for (const learner of toRemind) {
    try {
      await sendNotification({
        userId: learner.id,
        type: 'checkin_reminder',
        title: '☀️ Check-in de la semaine !',
        body: `${learner.first_name}, c'est le moment de faire le point sur ta semaine. 2 minutes suffisent !`,
        url: '/checkin',
      })
      sent++
    } catch (err) {
      console.error(`Erreur push pour ${learner.id}:`, err)
    }
  }

  return NextResponse.json({
    message: `Rappels push envoyés`,
    sent,
    total: toRemind.length,
  })
}
