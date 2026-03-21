import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { sendNotification } from '@/lib/send-notification'

// Appelé par Vercel Cron chaque mercredi à 9h
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  }

  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Récupérer tous les tips non envoyés, groupés par apprenant
  // On envoie le tip le plus ancien non envoyé pour chaque axe
  const { data: tips, error } = await supabase
    .from('tips')
    .select('id, axe_id, learner_id, content, week_number, axe:axes(subject)')
    .eq('sent', false)
    .order('week_number', { ascending: true })

  if (error || !tips || tips.length === 0) {
    return NextResponse.json({ message: 'Aucun tip à envoyer', sent: 0 })
  }

  // Grouper par apprenant : 1 seul tip par apprenant (le premier non envoyé)
  const sentLearners = new Set<string>()
  let sent = 0

  for (const tip of tips) {
    if (sentLearners.has(tip.learner_id)) continue
    sentLearners.add(tip.learner_id)

    const axeSubject = (tip as any).axe?.subject || 'ton axe'

    try {
      await sendNotification({
        userId: tip.learner_id,
        type: 'weekly_tip',
        title: `💡 Défi de la semaine`,
        body: `${axeSubject} : "${tip.content}"`,
        url: '/dashboard',
      })

      // Marquer comme envoyé
      await supabase
        .from('tips')
        .update({ sent: true })
        .eq('id', tip.id)

      sent++
    } catch (err) {
      console.error(`[Tips] Erreur envoi tip ${tip.id}:`, err)
    }
  }

  return NextResponse.json({ message: `Tips envoyés`, sent, total: tips.length })
}
