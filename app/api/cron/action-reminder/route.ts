import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { secondFridayAfter } from '@/lib/utils'
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
  const thresholdDate = new Date(now.getTime() - THRESHOLD_DAYS * 24 * 60 * 60 * 1000)

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

  // Pour chaque apprenant, vérifier la date de sa dernière action
  const toRemind: Array<{ id: string; first_name: string; daysSince: number }> = []

  for (const learner of eligibleLearners) {
    const { data: lastAction } = await supabase
      .from('actions')
      .select('created_at')
      .eq('learner_id', learner.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!lastAction) {
      // Jamais d'action : on pourrait relancer mais on skip pour ne pas spammer les nouveaux
      continue
    }

    const lastDate = new Date(lastAction.created_at)
    if (lastDate < thresholdDate) {
      const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
      toRemind.push({
        id: learner.id,
        first_name: learner.first_name,
        daysSince,
      })
    }
  }

  if (toRemind.length === 0) {
    return NextResponse.json({ message: 'Tous les apprenants sont actifs', sent: 0 })
  }

  // Envoyer une notification push à chaque apprenant inactif
  let sent = 0
  for (const learner of toRemind) {
    try {
      await sendNotification({
        userId: learner.id,
        type: 'action_added', // Réutilise un type existant (pas besoin de créer un nouveau type)
        title: `👀 Coucou ${learner.first_name} !`,
        body: `Ça fait ${learner.daysSince} jours qu'on ne s'est pas vus... T'as tenté un truc qu'on pourrait noter ?`,
        url: '/dashboard',
      })
      sent++
    } catch (err) {
      console.error(`[action-reminder] Erreur push pour ${learner.id}:`, err)
    }
  }

  return NextResponse.json({
    message: `Relances push envoyées`,
    sent,
    total: toRemind.length,
  })
}
