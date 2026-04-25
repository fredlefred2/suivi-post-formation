import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sendNotification } from '@/lib/send-notification'

// Cron mardi 8h — envoi des tips pré-générés (lundi 17h par pre-generate-tips).
// Plus court qu'avant : pas de génération à la volée, pas de fallback batch.
// On envoie strictement ce qui est marqué next_scheduled=true, sent=false.
export const maxDuration = 60

/**
 * Cron mardi 8h — Envoi des tips programmés.
 *
 * Règle V1.30.1 : 1 tip max par apprenant en attente. Si pre-generate-tips
 * (lundi 17h) ou le formateur ont placé un tip dans le slot, on l'envoie.
 * Sinon → l'apprenant ne reçoit rien cette semaine (le formateur a pu
 * volontairement supprimer le tip).
 *
 * L'ancien fallback "tips batch sent=false, next_scheduled=false" est
 * supprimé (incompatible avec la règle "1 max par apprenant" + redondant
 * avec pre-generate-tips qui couvre tous les cas).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  let sent = 0
  const errors: string[] = []

  const { data: scheduledTips } = await supabaseAdmin
    .from('tips')
    .select('id, axe_id, learner_id, content, week_number, axe:axes(subject)')
    .eq('next_scheduled', true)
    .eq('sent', false)

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

      sent++
      console.log(`[Tips] Envoye → ${tip.learner_id.slice(0, 8)} / "${axeSubject}"`)
    } catch (err) {
      const msg = `Erreur envoi tip ${tip.id.slice(0, 8)}: ${err}`
      console.error(`[Tips] ${msg}`)
      errors.push(msg)
    }
  }

  return NextResponse.json({
    message: 'Tips envoyes',
    sent,
    skipped: (scheduledTips?.length ?? 0) - sent,
    errors: errors.length > 0 ? errors : undefined,
  })
}
