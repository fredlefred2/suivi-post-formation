export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getCurrentWeek } from '@/lib/utils'
import { isQuizWeek, QUIZ_QUESTIONS_PER_QUIZ } from '@/lib/types'
import TrainerGroupQuizClient from './QuizPageClient'

type QuestionRow = {
  id: string
  position: number
  type: 'qcm' | 'truefalse'
  question: string
  choices: string[]
  correct_index: number
  explanation: string | null
}

type QuizRow = {
  id: string
  week_number: number
  year: number
  generated_at: string
}

type MemberRanking = {
  learner_id: string
  first_name: string
  last_name: string
  quizzesDone: number       // nb quiz complétés
  totalCorrect: number      // somme des scores
  correctRate: number       // % bonnes réponses (sur quiz tentés)
}

type HistoryItem = {
  quizId: string
  week: number
  year: number
  generatedAt: string
  attemptsCount: number     // nb apprenants qui ont complété
  averageRate: number       // moyenne % bonnes réponses
}

export default async function TrainerGroupQuizPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Vérifier que le groupe appartient bien au formateur connecté
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, theme')
    .eq('id', params.id)
    .eq('trainer_id', user!.id)
    .single()

  if (!group) notFound()

  const { week, year } = getCurrentWeek()
  // TEST v1.29.4 — restriction semaine paire désactivée (à revert)
  const isCurrentWeekQuizWeek = true // isQuizWeek(week)

  // ── Quiz de la semaine courante ──
  let currentQuiz: QuizRow | null = null
  let currentQuestions: QuestionRow[] = []
  if (isCurrentWeekQuizWeek) {
    const { data } = await supabaseAdmin
      .from('quizzes')
      .select('id, week_number, year, generated_at')
      .eq('group_id', group.id)
      .eq('week_number', week)
      .eq('year', year)
      .maybeSingle()
    currentQuiz = data

    if (currentQuiz) {
      const { data: qs } = await supabaseAdmin
        .from('quiz_questions')
        .select('id, position, type, question, choices, correct_index, explanation')
        .eq('quiz_id', currentQuiz.id)
        .order('position')
      currentQuestions = (qs ?? []) as QuestionRow[]
    }
  }

  // ── Membres du groupe ──
  const { data: membersRaw } = await supabaseAdmin
    .from('group_members')
    .select('learner_id, profiles!inner(first_name, last_name)')
    .eq('group_id', group.id)

  const members = (membersRaw ?? []).map(m => ({
    learner_id: m.learner_id,
    first_name: (m.profiles as unknown as { first_name: string }).first_name,
    last_name: (m.profiles as unknown as { last_name: string }).last_name,
  }))

  const memberIds = members.map(m => m.learner_id)

  // ── Tous les quiz du groupe (pour historique et classement) ──
  const { data: allQuizzes } = await supabaseAdmin
    .from('quizzes')
    .select('id, week_number, year, generated_at')
    .eq('group_id', group.id)
    .order('year', { ascending: false })
    .order('week_number', { ascending: false })

  const quizIds = (allQuizzes ?? []).map(q => q.id)

  // ── Tous les attempts des membres sur tous les quiz du groupe ──
  let attempts: Array<{ quiz_id: string; learner_id: string; score: number; completed_at: string | null }> = []
  if (quizIds.length > 0 && memberIds.length > 0) {
    const { data } = await supabaseAdmin
      .from('quiz_attempts')
      .select('quiz_id, learner_id, score, completed_at')
      .in('quiz_id', quizIds)
      .in('learner_id', memberIds)
    attempts = data ?? []
  }

  // ── Classement ──
  const statsByLearner = new Map<string, { quizzesDone: number; totalCorrect: number }>()
  for (const m of members) {
    statsByLearner.set(m.learner_id, { quizzesDone: 0, totalCorrect: 0 })
  }
  for (const a of attempts) {
    if (!a.completed_at) continue
    const s = statsByLearner.get(a.learner_id)
    if (s) {
      s.quizzesDone++
      s.totalCorrect += a.score
    }
  }

  const ranking: MemberRanking[] = members
    .map(m => {
      const s = statsByLearner.get(m.learner_id) ?? { quizzesDone: 0, totalCorrect: 0 }
      const maxPossible = s.quizzesDone * QUIZ_QUESTIONS_PER_QUIZ
      const rate = maxPossible > 0 ? Math.round((s.totalCorrect / maxPossible) * 100) : 0
      return {
        learner_id: m.learner_id,
        first_name: m.first_name,
        last_name: m.last_name,
        quizzesDone: s.quizzesDone,
        totalCorrect: s.totalCorrect,
        correctRate: rate,
      }
    })
    .sort((a, b) => b.totalCorrect - a.totalCorrect || b.correctRate - a.correctRate)

  // ── Historique (par quiz) ──
  const history: HistoryItem[] = (allQuizzes ?? []).map(q => {
    const quizAttempts = attempts.filter(a => a.quiz_id === q.id && a.completed_at)
    const totalScore = quizAttempts.reduce((acc, a) => acc + a.score, 0)
    const maxPossible = quizAttempts.length * QUIZ_QUESTIONS_PER_QUIZ
    const avg = maxPossible > 0 ? Math.round((totalScore / maxPossible) * 100) : 0
    return {
      quizId: q.id,
      week: q.week_number,
      year: q.year,
      generatedAt: q.generated_at,
      attemptsCount: quizAttempts.length,
      averageRate: avg,
    }
  })

  // Exclure le quiz courant de l'historique si présent
  const pastHistory = currentQuiz
    ? history.filter(h => h.quizId !== currentQuiz!.id)
    : history

  return (
    <div className="space-y-4 pb-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] font-semibold flex-wrap" style={{ color: '#a0937c' }}>
        <Link href="/trainer/groups" className="hover:underline" style={{ color: '#1a1a2e' }}>
          ← Groupes
        </Link>
        <span>/</span>
        <span className="truncate">{group.name}</span>
        <span>/</span>
        <span className="font-extrabold" style={{ color: '#1a1a2e' }}>Quiz</span>
      </div>

      <TrainerGroupQuizClient
        groupId={group.id}
        groupName={group.name}
        theme={group.theme}
        currentWeek={week}
        currentYear={year}
        isQuizWeekCurrent={isCurrentWeekQuizWeek}
        currentQuiz={currentQuiz}
        currentQuestions={currentQuestions}
        memberCount={members.length}
        ranking={ranking}
        history={pastHistory}
      />
    </div>
  )
}
