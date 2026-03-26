import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTips } from '@/lib/generate-tips'

/**
 * POST /api/tips/generate-for-member
 * Génère les tips pour un apprenant ajouté à un groupe avec thème.
 * Appelé en fire-and-forget depuis le client après l'affectation.
 */
export async function POST(req: NextRequest) {
  const { learnerId, groupId } = await req.json()
  if (!learnerId || !groupId) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  try {
    // Vérifier que le groupe a un thème (pas salle d'attente)
    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('name, theme')
      .eq('id', groupId)
      .single()

    if (!group?.theme || group.name.toLowerCase().includes('salle d\'attente')) {
      console.log(`[Tips] Skipped: pas de thème pour le groupe ${group?.name || groupId}`)
      return NextResponse.json({ skipped: true, reason: 'no-theme' })
    }

    // Récupérer les axes de l'apprenant
    const { data: axes } = await supabaseAdmin
      .from('axes')
      .select('id, subject, description')
      .eq('learner_id', learnerId)

    if (!axes || axes.length === 0) {
      console.log(`[Tips] Skipped: pas d'axes pour l'apprenant ${learnerId}`)
      return NextResponse.json({ skipped: true, reason: 'no-axes' })
    }

    let generated = 0
    for (const axe of axes) {
      const { data: existing } = await supabaseAdmin
        .from('tips')
        .select('id')
        .eq('axe_id', axe.id)
        .limit(1)

      if (existing && existing.length > 0) continue

      console.log(`[Tips] Génération pour ${axe.subject} (groupe ${group.name})`)
      await generateTips({
        axeId: axe.id,
        learnerId,
        axeSubject: axe.subject,
        axeDescription: axe.description || axe.subject,
        groupTheme: group.theme,
      })
      generated++
    }

    console.log(`[Tips] Terminé: ${generated} axes générés pour ${learnerId}`)
    return NextResponse.json({ success: true, generated })
  } catch (err) {
    console.error('[Tips] Erreur génération:', err)
    return NextResponse.json({ error: 'Erreur génération' }, { status: 500 })
  }
}
