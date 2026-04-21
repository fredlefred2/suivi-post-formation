import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentWeek } from '@/lib/utils'
import { isQuizWeek, QUIZ_QUESTIONS_PER_QUIZ } from '@/lib/types'

/**
 * GET /api/quiz/current
 * Renvoie l'état du quiz de la semaine en cours pour l'apprenant connecté :
 * - quiz de la semaine (s'il existe)
 * - attempt de l'apprenant (peut être null)
 * - nextPosition : la prochaine question à répondre (1..4) ou null si terminé
 * - answeredCount : nombre de questions déjà finalisées (répondues ou timeout)
 */
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { week, year } = getCurrentWeek()

  // Semaine impaire : pas de quiz cette semaine
  if (!isQuizWeek(week)) {
    return NextResponse.json({ quiz: null, attempt: null, nextPosition: null, answeredCount: 0, totalQuestions: QUIZ_QUESTIONS_PER_QUIZ })
  }

  // Trouver le groupe de l'apprenant
  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('group_id')
    .eq('learner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ quiz: null, attempt: null, nextPosition: null, answeredCount: 0, totalQuestions: QUIZ_QUESTIONS_PER_QUIZ })
  }

  // Quiz de la semaine pour ce groupe
  const { data: quiz } = await supabaseAdmin
    .from('quizzes')
    .select('id, week_number, year, generated_at')
    .eq('group_id', membership.group_id)
    .eq('week_number', week)
    .eq('year', year)
    .maybeSingle()

  if (!quiz) {
    return NextResponse.json({ quiz: null, attempt: null, nextPosition: null, answeredCount: 0, totalQuestions: QUIZ_QUESTIONS_PER_QUIZ })
  }

  // Attempt de l'apprenant
  const { data: attempt } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id, started_at, completed_at, score')
    .eq('quiz_id', quiz.id)
    .eq('learner_id', user.id)
    .maybeSingle()

  // Si déjà complété → rien à faire
  if (attempt?.completed_at) {
    return NextResponse.json({
      quiz,
      attempt,
      nextPosition: null,
      answeredCount: QUIZ_QUESTIONS_PER_QUIZ,
      totalQuestions: QUIZ_QUESTIONS_PER_QUIZ,
    })
  }

  // Sinon calculer la prochaine position à répondre
  let answeredCount = 0
  let nextPosition: number | null = 1

  if (attempt) {
    const { data: answers } = await supabaseAdmin
      .from('quiz_answers')
      .select('question_id, time_ms')
      .eq('attempt_id', attempt.id)

    // Charger les positions des questions répondues
    const finalizedIds = (answers ?? []).filter(a => a.time_ms !== null).map(a => a.question_id)
    answeredCount = finalizedIds.length

    if (finalizedIds.length > 0) {
      const { data: qs } = await supabaseAdmin
        .from('quiz_questions')
        .select('position')
        .in('id', finalizedIds)
      const maxAnswered = Math.max(0, ...(qs ?? []).map(q => q.position))
      nextPosition = maxAnswered < QUIZ_QUESTIONS_PER_QUIZ ? maxAnswered + 1 : null
    }
  }

  return NextResponse.json({
    quiz,
    attempt,
    nextPosition,
    answeredCount,
    totalQuestions: QUIZ_QUESTIONS_PER_QUIZ,
  })
}
