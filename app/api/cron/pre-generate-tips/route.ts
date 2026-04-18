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

  // ── 4. Liste des apprenants à traiter (ceux sans tip déjà programmé) ──
  const toProcess = learnerIds.filter((id) => !learnersWithScheduled.has(id))
  const skipped = learnerIds.length - toProcess.length

  // Cap dur pour éviter le timeout Vercel (cron hobby = 60s, pro = 300s).
  // Avec la concurrence limitée à 5 et ~3s par génération Claude, on tient
  // ~100 apprenants en 60s. Au-delà, on laisse pour la prochaine exécution.
  const MAX_PER_RUN = 100
  const CONCURRENCY = 5
  const batch = toProcess.slice(0, MAX_PER_RUN)
  const deferred = toProcess.length - batch.length

  let generated = 0
  const errors: string[] = []

  // Worker qui traite un apprenant (choix d'axe + génération)
  async function processOne(learnerId: string) {
    const learnerAxes = axesByLearner.get(learnerId)!
    const lastAxeId = lastSentAxeByLearner.get(learnerId)

    // Choisir l'axe (alterner avec le dernier envoyé)
    let targetAxe = learnerAxes[0]
    if (lastAxeId && learnerAxes.length > 1) {
      const otherAxe = learnerAxes.find((a) => a.id !== lastAxeId)
      if (otherAxe) targetAxe = otherAxe
    }

    try {
      const ctx = await gatherLearnerContext(learnerId, targetAxe.id)
      if (!ctx) {
        console.log(`[PreGen] Skip ${learnerId.slice(0, 8)} — contexte introuvable`)
        return { ok: false }
      }
      const result = await generatePersonalizedTip(ctx, weekNumber)
      if (result) {
        console.log(`[PreGen] Tip genere pour learner ${learnerId.slice(0, 8)} / axe ${targetAxe.id.slice(0, 8)}`)
        return { ok: true }
      }
      errors.push(`Echec generation pour ${learnerId.slice(0, 8)}`)
      return { ok: false }
    } catch (err) {
      const msg = `Erreur ${learnerId.slice(0, 8)}: ${err}`
      console.error(`[PreGen] ${msg}`)
      errors.push(msg)
      return { ok: false }
    }
  }

  // Exécution par vagues concurrentes (5 en parallèle max — évite de
  // saturer l'API Claude et respecte les quotas)
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const slice = batch.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(slice.map(processOne))
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.ok) generated++
    }
  }

  return NextResponse.json({
    message: 'Pre-generation terminee',
    generated,
    skipped,
    deferred, // apprenants reportés (au-delà du cap MAX_PER_RUN)
    total_learners: learnerIds.length,
    errors: errors.length > 0 ? errors : undefined,
  })
}
