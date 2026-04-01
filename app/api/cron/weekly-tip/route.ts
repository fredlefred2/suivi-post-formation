import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNotification } from '@/lib/send-notification'

/**
 * Cron mardi 8h — Envoi des tips pre-generes.
 *
 * Logique hybride :
 * 1. D'abord envoyer les tips next_scheduled (pre-generes lundi 17h)
 * 2. Ensuite, pour les apprenants sans next_scheduled,
 *    fallback sur l'ancien systeme (premier tip sent=false, alternance axes)
 *    → compatibilite avec les tips batch generes a la creation de l'axe
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  let sent = 0

  // ── 1. Envoyer les tips next_scheduled ────────────────────────
  const { data: scheduledTips } = await supabaseAdmin
    .from('tips')
    .select('id, axe_id, learner_id, content, week_number, axe:axes(subject)')
    .eq('next_scheduled', true)
    .eq('sent', false)

  const learnersHandled = new Set<string>()

  for (const tip of scheduledTips ?? []) {
    const axeSubject = (tip as any).axe?.subject || 'ton axe'

    try {
      await sendNotification({
        userId: tip.learner_id,
        type: 'weekly_tip',
        title: '💡 Ton coach a un message',
        body: `${axeSubject} : "${tip.content}"`,
        url: '/dashboard',
      })

      await supabaseAdmin
        .from('tips')
        .update({ sent: true, next_scheduled: false })
        .eq('id', tip.id)

      learnersHandled.add(tip.learner_id)
      sent++
      console.log(`[Tips] Envoye (perso) → ${tip.learner_id} / "${axeSubject}"`)
    } catch (err) {
      console.error(`[Tips] Erreur envoi tip ${tip.id}:`, err)
    }
  }

  // ── 2. Fallback : tips batch non envoyes (ancien systeme) ─────
  const { data: unsentTips } = await supabaseAdmin
    .from('tips')
    .select('id, axe_id, learner_id, content, week_number, axe:axes(subject)')
    .eq('sent', false)
    .eq('next_scheduled', false)
    .order('week_number', { ascending: true })

  if (unsentTips && unsentTips.length > 0) {
    // Grouper par apprenant
    const tipsByLearner = new Map<string, typeof unsentTips>()
    for (const tip of unsentTips) {
      if (learnersHandled.has(tip.learner_id)) continue // deja envoye via next_scheduled
      if (!tipsByLearner.has(tip.learner_id)) {
        tipsByLearner.set(tip.learner_id, [])
      }
      tipsByLearner.get(tip.learner_id)!.push(tip)
    }

    // Dernier axe envoye pour alternance
    const fallbackLearnerIds = Array.from(tipsByLearner.keys())
    const { data: lastSentTips } = await supabaseAdmin
      .from('tips')
      .select('learner_id, axe_id')
      .in('learner_id', fallbackLearnerIds)
      .eq('sent', true)
      .order('week_number', { ascending: false })

    const lastSentAxeByLearner = new Map<string, string>()
    if (lastSentTips) {
      for (const tip of lastSentTips) {
        if (!lastSentAxeByLearner.has(tip.learner_id)) {
          lastSentAxeByLearner.set(tip.learner_id, tip.axe_id)
        }
      }
    }

    for (const learnerId of fallbackLearnerIds) {
      const learnerTips = tipsByLearner.get(learnerId)!
      const lastAxeId = lastSentAxeByLearner.get(learnerId)

      let chosenTip = learnerTips[0]
      if (lastAxeId) {
        const differentAxeTip = learnerTips.find(t => t.axe_id !== lastAxeId)
        if (differentAxeTip) chosenTip = differentAxeTip
      }

      const axeSubject = (chosenTip as any).axe?.subject || 'ton axe'

      try {
        await sendNotification({
          userId: learnerId,
          type: 'weekly_tip',
          title: '💡 Défi de la semaine',
          body: `${axeSubject} : "${chosenTip.content}"`,
          url: '/dashboard',
        })

        await supabaseAdmin
          .from('tips')
          .update({ sent: true })
          .eq('id', chosenTip.id)

        sent++
        console.log(`[Tips] Envoye (batch) → ${learnerId} / "${axeSubject}"`)
      } catch (err) {
        console.error(`[Tips] Erreur envoi tip ${chosenTip.id}:`, err)
      }
    }
  }

  return NextResponse.json({ message: 'Tips envoyes', sent })
}
