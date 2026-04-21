import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { regenerateSingleQuestion } from '@/lib/generate-quiz'

// Appel Claude — peut prendre ~10-20s
export const maxDuration = 60

/**
 * POST /api/trainer/quiz/regenerate-question
 * Body : { quizId, questionId }
 * Régénère une seule question d'un quiz existant (même type).
 * Refuse si au moins 1 apprenant a déjà répondu à cette question.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { quizId, questionId } = await request.json().catch(() => ({})) as {
    quizId?: string
    questionId?: string
  }
  if (!quizId || !questionId) {
    return NextResponse.json({ error: 'quizId et questionId requis' }, { status: 400 })
  }

  // Vérifier que le formateur possède bien le groupe du quiz
  const { data: quiz } = await supabaseAdmin
    .from('quizzes')
    .select('id, group_id, week_number, theme_snapshot')
    .eq('id', quizId)
    .maybeSingle()

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz introuvable' }, { status: 404 })
  }

  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('trainer_id, theme')
    .eq('id', quiz.group_id)
    .single()

  if (!group || group.trainer_id !== user.id) {
    return NextResponse.json({ error: 'Quiz inaccessible' }, { status: 403 })
  }

  // Utiliser le thème actuel du groupe (si modifié depuis la génération initiale)
  // sinon fallback sur le theme_snapshot du quiz
  const effectiveTheme = (group.theme ?? '').trim() || quiz.theme_snapshot

  const result = await regenerateSingleQuestion({
    quizId,
    questionId,
    theme: effectiveTheme,
    weekNumber: quiz.week_number,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
