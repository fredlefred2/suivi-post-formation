import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generatePersonalizedTip } from '@/lib/generate-tips'
import { gatherLearnerContext } from '@/lib/gather-learner-context'

/**
 * Cron lundi 17h — Pre-generation des tips personnalises.
 *
 * Pour chaque apprenant :
 * - Si un tip next_scheduled existe deja (tous axes) → skip
 * - Sinon → choisir un axe (alterner), generer un tip personnalise
 *
 * Le formateur peut modifier/regenerer entre lundi 17h et mardi 8h.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Non autorise' }, { status: 401 })
  }

  // ── 1. Trouver tous les apprenants avec des axes ──────────────
  const { data: allAxes } = await supabaseAdmin
    .from('axes')
    .select('id, learner_id, subject')

  if (!allAxes || allAxes.length === 0) {
    return NextResponse.json({ message: 'Aucun axe trouve', generated: 0 })
  }

  // Grouper les axes par apprenant
  const axesByLearner = new Map<string, Array<{ id: string; subject: string }>>()
  for (const axe of allAxes) {
    if (!axesByLearner.has(axe.learner_id)) {
      axesByLearner.set(axe.learner_id, [])
    }
    axesByLearner.get(axe.learner_id)!.push({ id: axe.id, subject: axe.subject })
  }

  const learnerIds = Array.from(axesByLearner.keys())

  // ── 2. Verifier qui a deja un tip programme ───────────────────
  const { data: alreadyScheduled } = await supabaseAdmin
    .from('tips')
    .select('learner_id')
    .in('learner_id', learnerIds)
    .eq('next_scheduled', true)
    .eq('sent', false)

  const learnersWithScheduled = new Set((alreadyScheduled ?? []).map(t => t.learner_id))

  // ── 3. Trouver le dernier axe envoye pour alterner ────────────
  const { data: lastSentTips } = await supabaseAdmin
    .from('tips')
    .select('learner_id, axe_id')
    .in('learner_id', learnerIds)
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

  // Calculer le numero de semaine
  const now = new Date()
  const weekNumber = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)

  let generated = 0
  let skipped = 0
  const errors: string[] = []

  // ── 4. Pour chaque apprenant, pre-generer si necessaire ───────
  for (const learnerId of learnerIds) {
    // Skip si deja un tip programme
    if (learnersWithScheduled.has(learnerId)) {
      skipped++
      continue
    }

    const learnerAxes = axesByLearner.get(learnerId)!
    const lastAxeId = lastSentAxeByLearner.get(learnerId)

    // Choisir l'axe (alterner avec le dernier envoye)
    let targetAxe = learnerAxes[0]
    if (lastAxeId && learnerAxes.length > 1) {
      const otherAxe = learnerAxes.find(a => a.id !== lastAxeId)
      if (otherAxe) targetAxe = otherAxe
    }

    try {
      const ctx = await gatherLearnerContext(learnerId, targetAxe.id)
      if (!ctx) {
        console.log(`[PreGen] Skip ${learnerId} — contexte introuvable`)
        continue
      }

      const result = await generatePersonalizedTip(ctx, weekNumber)
      if (result) {
        generated++
        console.log(`[PreGen] Tip genere pour ${ctx.firstName} / "${targetAxe.subject}"`)
      } else {
        errors.push(`Echec generation pour ${learnerId}`)
      }
    } catch (err) {
      const msg = `Erreur ${learnerId}: ${err}`
      console.error(`[PreGen] ${msg}`)
      errors.push(msg)
    }
  }

  return NextResponse.json({
    message: 'Pre-generation terminee',
    generated,
    skipped,
    total_learners: learnerIds.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
