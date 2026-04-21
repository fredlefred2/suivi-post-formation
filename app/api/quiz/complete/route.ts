import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { QUIZ_QUESTIONS_PER_QUIZ } from '@/lib/types'

/**
 * POST /api/quiz/complete
 * Body : { attemptId }
 * Vérifie que les 4 questions ont été finalisées, calcule le score,
 * marque completed_at. Retourne le score final.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { attemptId } = await request.json().catch(() => ({})) as { attemptId?: string }
  if (!attemptId) {
    return NextResponse.json({ error: 'attemptId manquant' }, { status: 400 })
  }

  const { data: attempt } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, learner_id, completed_at')
    .eq('id', attemptId)
    .maybeSingle()

  if (!attempt || attempt.learner_id !== user.id) {
    return NextResponse.json({ error: 'Attempt inaccessible' }, { status: 403 })
  }

  // Idempotent : si déjà complété, renvoyer le score actuel
  if (attempt.completed_at) {
    const { data: existing } = await supabaseAdmin
      .from('quiz_attempts')
      .select('score')
      .eq('id', attemptId)
      .single()
    return NextResponse.json({
      score: existing?.score ?? 0,
      total: QUIZ_QUESTIONS_PER_QUIZ,
      alreadyCompleted: true,
    })
  }

  // Charger toutes les réponses
  const { data: answers } = await supabaseAdmin
    .from('quiz_answers')
    .select('is_correct, time_ms')
    .eq('attempt_id', attemptId)

  const finalized = (answers ?? []).filter(a => a.time_ms !== null)
  if (finalized.length < QUIZ_QUESTIONS_PER_QUIZ) {
    return NextResponse.json({
      error: `${finalized.length}/${QUIZ_QUESTIONS_PER_QUIZ} questions répondues`,
    }, { status: 409 })
  }

  const score = finalized.filter(a => a.is_correct).length

  const { error: updErr } = await supabaseAdmin
    .from('quiz_attempts')
    .update({
      completed_at: new Date().toISOString(),
      score,
    })
    .eq('id', attemptId)

  if (updErr) {
    return NextResponse.json({ error: 'Erreur complétion' }, { status: 500 })
  }

  return NextResponse.json({
    score,
    total: QUIZ_QUESTIONS_PER_QUIZ,
    alreadyCompleted: false,
  })
}
