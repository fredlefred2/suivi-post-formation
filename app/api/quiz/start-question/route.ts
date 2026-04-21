import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { QUIZ_SECONDS_PER_QUESTION, QUIZ_QUESTIONS_PER_QUIZ } from '@/lib/types'

/**
 * POST /api/quiz/start-question
 * Body : { quizId }
 * Crée l'attempt si nécessaire, trouve la prochaine question à répondre,
 * crée (ou reprend) le row quiz_answers avec question_started_at serveur,
 * et renvoie la question sans la bonne réponse.
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

  // Vérifier que le quiz existe et appartient au groupe de l'apprenant
  const { data: quiz } = await supabaseAdmin
    .from('quizzes')
    .select('id, group_id')
    .eq('id', quizId)
    .maybeSingle()

  if (!quiz) {
    return NextResponse.json({ error: 'Quiz introuvable' }, { status: 404 })
  }

  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('learner_id')
    .eq('group_id', quiz.group_id)
    .eq('learner_id', user.id)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Quiz non accessible' }, { status: 403 })
  }

  // Trouver ou créer l'attempt
  let { data: attempt } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, completed_at')
    .eq('quiz_id', quizId)
    .eq('learner_id', user.id)
    .maybeSingle()

  if (attempt?.completed_at) {
    return NextResponse.json({ error: 'Quiz déjà terminé' }, { status: 409 })
  }

  if (!attempt) {
    const { data: newAttempt, error: attErr } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({ quiz_id: quizId, learner_id: user.id })
      .select('id, completed_at')
      .single()
    if (attErr || !newAttempt) {
      return NextResponse.json({ error: 'Erreur création attempt' }, { status: 500 })
    }
    attempt = newAttempt
  }

  // Charger les questions et les réponses existantes
  const [{ data: questions }, { data: answers }] = await Promise.all([
    supabaseAdmin
      .from('quiz_questions')
      .select('id, position, type, question, choices')
      .eq('quiz_id', quizId)
      .order('position'),
    supabaseAdmin
      .from('quiz_answers')
      .select('question_id, question_started_at, time_ms')
      .eq('attempt_id', attempt.id),
  ])

  if (!questions || questions.length !== QUIZ_QUESTIONS_PER_QUIZ) {
    return NextResponse.json({ error: 'Quiz mal formé' }, { status: 500 })
  }

  const answersMap = new Map((answers ?? []).map(a => [a.question_id, a]))

  // Trouver la prochaine question à répondre (par position)
  const nextQuestion = questions.find(q => {
    const existing = answersMap.get(q.id)
    return !existing || existing.time_ms === null  // pas de row OU row en cours
  })

  if (!nextQuestion) {
    return NextResponse.json({ error: 'Toutes les questions sont répondues — appelle /complete' }, { status: 409 })
  }

  // Row quiz_answers : existe déjà (reprise) ou à créer
  const existing = answersMap.get(nextQuestion.id)
  let questionStartedAt: string

  if (existing) {
    questionStartedAt = existing.question_started_at
  } else {
    const now = new Date().toISOString()
    const { error: ansErr } = await supabaseAdmin
      .from('quiz_answers')
      .insert({
        attempt_id: attempt.id,
        question_id: nextQuestion.id,
        question_started_at: now,
        selected_index: null,
        is_correct: false,
        time_ms: null,
      })
    if (ansErr) {
      return NextResponse.json({ error: 'Erreur démarrage question' }, { status: 500 })
    }
    questionStartedAt = now
  }

  // Calculer secondes restantes (clamp 0..15)
  const elapsedMs = Date.now() - new Date(questionStartedAt).getTime()
  const remainingMs = Math.max(0, QUIZ_SECONDS_PER_QUESTION * 1000 - elapsedMs)
  const secondsRemaining = Math.ceil(remainingMs / 1000)

  return NextResponse.json({
    attemptId: attempt.id,
    question: {
      id: nextQuestion.id,
      position: nextQuestion.position,
      type: nextQuestion.type,
      question: nextQuestion.question,
      choices: nextQuestion.choices,
    },
    secondsRemaining,
    totalQuestions: QUIZ_QUESTIONS_PER_QUIZ,
  })
}
