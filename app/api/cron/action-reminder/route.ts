import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { secondFridayAfter, parisCalendarDaysBetween } from '@/lib/utils'
import { sendNotification } from '@/lib/send-notification'

// Route protégée — appelée par Vercel Cron (lundi 9h)
// Push de relance pour les apprenants qui n'ont pas déclaré d'action depuis 10 jours
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const now = new Date()
  const THRESHOLD_DAYS = 10

  // Récupérer tous les apprenants éligibles (onboarding terminé)
  const { data: allLearners } = await supabase
    .from('profiles')
    .select('id, first_name, created_at')
    .eq('role', 'learner')

  const eligibleLearners = (allLearners ?? []).filter((l) => {
    const firstEligible = secondFridayAfter(l.created_at)
    return now >= firstEligible
  })

  if (eligibleLearners.length === 0) {
    return NextResponse.json({ message: 'Aucun apprenant éligible', sent: 0 })
  }

  // 1 seule requête pour toutes les dernières actions (remplace le N+1 historique).
  // On récupère toutes les actions des apprenants éligibles triées par date DESC,
  // puis on garde la plus récente par apprenant client-side.
  const eligibleIds = eligibleLearners.map((l) => l.id)
  const { data: allActions } = await supabase
    .from('actions')
    .select('learner_id, created_at')
    .in('learner_id', eligibleIds)
    .order('created_at', { ascending: false })

  const lastActionByLearner = new Map<string, string>()
  for (const a of allActions ?? []) {
    if (!lastActionByLearner.has(a.learner_id)) {
      lastActionByLearner.set(a.learner_id, a.created_at)
    }
  }

  // Filtrer ceux qui n'ont rien fait depuis THRESHOLD_DAYS jours calendaires (Paris)
  const toRemind: Array<{ id: string; first_name: string; daysSince: number }> = []
  for (const learner of eligibleLearners) {
    const lastAt = lastActionByLearner.get(learner.id)
    if (!lastAt) continue // jamais d'action : on skip pour ne pas spammer les nouveaux
    const daysSince = parisCalendarDaysBetween(lastAt, now)
    if (daysSince >= THRESHOLD_DAYS) {
      toRemind.push({ id: learner.id, first_name: learner.first_name, daysSince })
    }
  }

  if (toRemind.length === 0) {
    return NextResponse.json({ message: 'Tous les apprenants sont actifs', sent: 0 })
  }

  // Envoi des push en parallèle (Promise.allSettled pour pas casser sur un échec)
  const results = await Promise.allSettled(
    toRemind.map((learner) =>
      sendNotification({
        userId: learner.id,
        type: 'action_added',
        title: `👀 Coucou ${learner.first_name} !`,
        body: `Ça fait ${learner.daysSince} jours qu'on ne s'est pas vus... T'as tenté un truc qu'on pourrait noter ?`,
        url: '/dashboard',
      })
    )
  )
  const sent = results.filter((r) => r.status === 'fulfilled').length
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error(`[action-reminder] Erreur push pour ${toRemind[i].id}:`, r.reason)
    }
  })

  return NextResponse.json({
    message: `Relances push envoyées`,
    sent,
    total: toRemind.length,
  })
}
