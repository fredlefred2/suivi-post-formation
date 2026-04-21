export type Role = 'learner' | 'trainer'
export type Weather = 'sunny' | 'cloudy' | 'stormy'
export type Difficulty = 'facile' | 'moyen' | 'difficile'

export type Profile = {
  id: string
  role: Role
  first_name: string
  last_name: string
  created_at: string
}

export type Group = {
  id: string
  name: string
  theme: string | null
  trainer_id: string
  created_at: string
}

export type GroupMember = {
  id: string
  group_id: string
  learner_id: string
  joined_at: string
}

export type Axe = {
  id: string
  learner_id: string
  subject: string
  description: string | null
  initial_score: number
  difficulty: Difficulty
  created_at: string
}

export type Action = {
  id: string
  axe_id: string
  learner_id: string
  description: string
  completed: boolean
  created_at: string
}

export type Checkin = {
  id: string
  learner_id: string
  week_number: number
  year: number
  weather: Weather
  what_worked: string | null
  difficulties: string | null
  created_at: string
}

export type AxisScore = {
  id: string
  axe_id: string
  learner_id: string
  score: number
  week_number: number
  year: number
  created_at: string
}

export const WEATHER_LABELS: Record<Weather, string> = {
  sunny: '☀️ Ça roule !',
  cloudy: '⛅ Mitigé',
  stormy: '⛈️ Difficile',
}

export const WEATHER_COLORS: Record<Weather, string> = {
  sunny: 'bg-amber-200 text-amber-900',
  cloudy: 'bg-sky-200 text-sky-900',
  stormy: 'bg-red-200 text-red-900',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facile: '🟢 Facile',
  moyen: '🟡 Intermédiaire',
  difficile: '🔴 Difficile',
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  facile: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  moyen: 'bg-amber-100 text-amber-800 border-amber-300',
  difficile: 'bg-red-100 text-red-800 border-red-300',
}

// ── Feedback sur les actions (likes & commentaires) ──

export type ActionLike = {
  id: string
  action_id: string
  trainer_id: string
  created_at: string
}

export type ActionComment = {
  id: string
  action_id: string
  trainer_id: string
  content: string
  created_at: string
}

export type ActionFeedbackData = {
  likes_count: number
  comments_count: number
  liked_by_me: boolean
  likers: Array<{ first_name: string; last_name: string }>
  comments: Array<{
    id: string
    content: string
    created_at: string
    trainer_first_name: string
    trainer_last_name: string
  }>
}

// ─────────────────────────────────────────────────────────
// Quiz bimensuels (v1.29.4) — semaines ISO paires, jeudi 8h
// ─────────────────────────────────────────────────────────

export type QuizQuestionType = 'qcm' | 'truefalse'

export type Quiz = {
  id: string
  group_id: string
  week_number: number
  year: number
  theme_snapshot: string
  generated_at: string
}

export type QuizQuestion = {
  id: string
  quiz_id: string
  position: number        // 1..4
  type: QuizQuestionType
  question: string
  choices: string[]       // QCM : 4 items · vrai/faux : 2 items
  correct_index: number
  explanation: string | null
}

export type QuizAttempt = {
  id: string
  quiz_id: string
  learner_id: string
  started_at: string
  completed_at: string | null
  score: number           // 0..4 (nb bonnes réponses)
}

export type QuizAnswer = {
  id: string
  attempt_id: string
  question_id: string
  question_started_at: string
  selected_index: number | null   // null si hors délai
  is_correct: boolean
  time_ms: number | null
  answered_at: string
}

// Constantes quiz
export const QUIZ_QUESTIONS_PER_QUIZ = 4
export const QUIZ_SECONDS_PER_QUESTION = 60
export const QUIZ_BRIEF_MAX_LENGTH = 2000

// Un quiz existe uniquement les semaines ISO paires
export function isQuizWeek(weekNumber: number): boolean {
  return weekNumber % 2 === 0
}
