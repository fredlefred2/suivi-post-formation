import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * POST /api/trainer/quiz/delete
 * Body : { quizId }
 * Supprime un quiz si aucun apprenant ne l'a commencé.
 * ON DELETE CASCADE vire questions / attempts / answers.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { quizId } = await request.json().catch(() => ({})) as { quizId?: string }
  if (!quizId) {
    return NextResponse.json({ error: 'quizId manquant' }, { status: 400 })
  }

  // Vérifier appartenance
  const { data: quiz } = await supabaseAdmin
    .from('quizzes')
    .select('id, group_id')
    .eq('id', quizId)
    .maybeSingle()

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz introuvable' }, { status: 404 })
  }

  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('trainer_id')
    .eq('id', quiz.group_id)
    .single()

  if (!group || group.trainer_id !== user.id) {
    return NextResponse.json({ error: 'Quiz inaccessible' }, { status: 403 })
  }

  // Bloquer si au moins un apprenant a commencé (started_at est NOT NULL par défaut,
  // donc toute tentative = engagement — même si pas encore de réponse finalisée)
  const { count } = await supabaseAdmin
    .from('quiz_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('quiz_id', quizId)

  if ((count ?? 0) > 0) {
    return NextResponse.json({
      error: `${count} apprenant${count! > 1 ? 's ont' : ' a'} déjà commencé ce quiz — suppression impossible.`,
    }, { status: 409 })
  }

  const { error: delErr } = await supabaseAdmin
    .from('quizzes')
    .delete()
    .eq('id', quizId)

  if (delErr) {
    return NextResponse.json({ error: 'Erreur suppression' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
