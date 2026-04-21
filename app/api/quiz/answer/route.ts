import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { QUIZ_SECONDS_PER_QUESTION } from '@/lib/types'

/**
 * POST /api/quiz/answer
 * Body : { attemptId, questionId, selectedIndex }  (selectedIndex peut être null = pas de choix)
 * Valide le timer serveur (15s), compare à correct_index, update quiz_answers,
 * renvoie la correction + explication pour l'UI.
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({})) as {
    attemptId?: string
    questionId?: string
    selectedIndex?: number | null
  }

  if (!body.attemptId || !body.questionId) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  // Vérifier l'attempt appartient à l'apprenant
  const { data: attempt } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, learner_id, completed_at')
    .eq('id', body.attemptId)
    .maybeSingle()

  if (!attempt || attempt.learner_id !== user.id) {
    return NextResponse.json({ error: 'Attempt inaccessible' }, { status: 403 })
  }

  if (attempt.completed_at) {
    return NextResponse.json({ error: 'Quiz déjà terminé' }, { status: 409 })
  }

  // Lire le row quiz_answers (doit exister, créé par start-question)
  const { data: answerRow } = await supabaseAdmin
    .from('quiz_answers')
    .select('id, question_started_at, time_ms')
    .eq('attempt_id', body.attemptId)
    .eq('question_id', body.questionId)
    .maybeSingle()

  if (!answerRow) {
    return NextResponse.json({ error: 'Question non démarrée' }, { status: 400 })
  }

  if (answerRow.time_ms !== null) {
    return NextResponse.json({ error: 'Question déjà répondue' }, { status: 409 })
  }

  // Lire la question avec la bonne réponse (jamais renvoyée au client côté start-question)
  const { data: question } = await supabaseAdmin
    .from('quiz_questions')
    .select('correct_index, explanation, choices')
    .eq('id', body.questionId)
    .maybeSingle()

  if (!question) {
    return NextResponse.json({ error: 'Question introuvable' }, { status: 404 })
  }

  // Valider le timer serveur
  const elapsedMs = Date.now() - new Date(answerRow.question_started_at).getTime()
  const timedOut = elapsedMs > QUIZ_SECONDS_PER_QUESTION * 1000

  // Si timeout → selectedIndex forcé à null. Sinon on garde ce qu'a envoyé le client.
  const selectedIndex = timedOut ? null : (
    typeof body.selectedIndex === 'number' ? body.selectedIndex : null
  )

  // Validation de borne pour selectedIndex (sinon null)
  const safeSelectedIndex =
    typeof selectedIndex === 'number' &&
    selectedIndex >= 0 &&
    selectedIndex < (question.choices as string[]).length
      ? selectedIndex
      : null

  const isCorrect = safeSelectedIndex !== null && safeSelectedIndex === question.correct_index

  // Update
  const { error: updErr } = await supabaseAdmin
    .from('quiz_answers')
    .update({
      selected_index: safeSelectedIndex,
      is_correct: isCorrect,
      time_ms: Math.min(elapsedMs, QUIZ_SECONDS_PER_QUESTION * 1000),
      answered_at: new Date().toISOString(),
    })
    .eq('id', answerRow.id)

  if (updErr) {
    return NextResponse.json({ error: 'Erreur enregistrement' }, { status: 500 })
  }

  return NextResponse.json({
    isCorrect,
    timedOut,
    correctIndex: question.correct_index,
    explanation: question.explanation,
    selectedIndex: safeSelectedIndex,
  })
}
