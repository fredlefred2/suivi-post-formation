import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { generateTips } from '@/lib/generate-tips'

/**
 * POST /api/tips/generate-for-member
 * Génère les tips pour un apprenant ajouté à un groupe avec thème.
 * Appelé en fire-and-forget depuis le client après l'affectation.
 */
export async function POST(req: NextRequest) {
  // Vérifier l'authentification
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  // Vérifier que c'est un formateur
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'trainer') {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

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
      return NextResponse.json({ skipped: true, reason: 'no-theme' })
    }

    // Récupérer les axes de l'apprenant
    const { data: axes } = await supabaseAdmin
      .from('axes')
      .select('id, subject, description')
      .eq('learner_id', learnerId)

    if (!axes || axes.length === 0) {
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

    return NextResponse.json({ success: true, generated })
  } catch (err) {
    console.error('[Tips] Erreur génération:', err)
    return NextResponse.json({ error: 'Erreur génération' }, { status: 500 })
  }
}
