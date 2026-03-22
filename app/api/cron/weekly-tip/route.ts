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
  const { data: unsentTips, error } = await supabase
    .from('tips')
    .select('id, axe_id, learner_id, content, week_number, axe:axes(subject)')
    .eq('sent', false)
    .order('week_number', { ascending: true })

  if (error || !unsentTips || unsentTips.length === 0) {
    return NextResponse.json({ message: 'Aucun tip à envoyer', sent: 0 })
  }

  // Grouper les tips non envoyés par apprenant
  const tipsByLearner = new Map<string, typeof unsentTips>()
  for (const tip of unsentTips) {
    if (!tipsByLearner.has(tip.learner_id)) {
      tipsByLearner.set(tip.learner_id, [])
    }
    tipsByLearner.get(tip.learner_id)!.push(tip)
  }

  // Récupérer le dernier tip envoyé par apprenant (pour l'alternance d'axes)
  const learnerIds = Array.from(tipsByLearner.keys())
  const { data: lastSentTips } = await supabase
    .from('tips')
    .select('learner_id, axe_id')
    .in('learner_id', learnerIds)
    .eq('sent', true)
    .order('week_number', { ascending: false })

  // Map learner_id → axe_id du dernier tip envoyé
  const lastSentAxeByLearner = new Map<string, string>()
  if (lastSentTips) {
    for (const tip of lastSentTips) {
      if (!lastSentAxeByLearner.has(tip.learner_id)) {
        lastSentAxeByLearner.set(tip.learner_id, tip.axe_id)
      }
    }
  }

  let sent = 0

  for (const learnerId of Array.from(tipsByLearner.keys())) {
    const learnerTips = tipsByLearner.get(learnerId)!
    const lastAxeId = lastSentAxeByLearner.get(learnerId)

    // Choisir un tip d'un axe différent du dernier envoyé (si possible)
    let chosenTip = learnerTips[0] // fallback : premier non envoyé
    if (lastAxeId) {
      const differentAxeTip = learnerTips.find(t => t.axe_id !== lastAxeId)
      if (differentAxeTip) {
        chosenTip = differentAxeTip
      }
    }

    const axeSubject = (chosenTip as any).axe?.subject || 'ton axe'

    try {
      await sendNotification({
        userId: learnerId,
        type: 'weekly_tip',
        title: `💡 Défi de la semaine`,
        body: `${axeSubject} : "${chosenTip.content}"`,
        url: '/dashboard',
      })

      // Marquer comme envoyé
      await supabase
        .from('tips')
        .update({ sent: true })
        .eq('id', chosenTip.id)

      sent++
    } catch (err) {
      console.error(`[Tips] Erreur envoi tip ${chosenTip.id}:`, err)
    }
  }

  return NextResponse.json({ message: `Tips envoyés`, sent, total: unsentTips.length })
}
