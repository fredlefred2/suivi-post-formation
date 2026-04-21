import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentWeek } from '@/lib/utils'
import { generateQuizForGroup } from '@/lib/generate-quiz'
import { isQuizWeek } from '@/lib/types'

// Peut prendre 15-30s (appel Claude)
export const maxDuration = 60

/**
 * POST /api/trainer/quiz/regenerate
 * Body : { groupId }
 * Génère (ou régénère en remplaçant les questions) le quiz de la semaine
 * ISO paire en cours pour le groupe ciblé. Réservé au formateur propriétaire.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { groupId } = await request.json().catch(() => ({})) as { groupId?: string }
  if (!groupId) {
    return NextResponse.json({ error: 'groupId manquant' }, { status: 400 })
  }

  // Vérifier que le formateur connecté possède ce groupe
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('id, theme, trainer_id')
    .eq('id', groupId)
    .maybeSingle()

  if (!group || group.trainer_id !== user.id) {
    return NextResponse.json({ error: 'Groupe inaccessible' }, { status: 403 })
  }

  const theme = (group.theme ?? '').trim()
  if (theme.length < 20) {
    return NextResponse.json({ error: 'Brief trop court — écris au moins 20 caractères.' }, { status: 400 })
  }

  const { week, year } = getCurrentWeek()
  if (!isQuizWeek(week)) {
    return NextResponse.json({ error: `Semaine ${week} impaire — pas de quiz cette semaine.` }, { status: 400 })
  }

  const result = await generateQuizForGroup({
    groupId,
    theme,
    weekNumber: week,
    year,
    force: true,
  })

  if (!result) {
    return NextResponse.json({ error: 'Erreur de génération — réessaie dans quelques instants.' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    quizId: result.quizId,
    questions: result.questions,
  })
}
