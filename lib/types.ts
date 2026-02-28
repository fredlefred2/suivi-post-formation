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
  sunny: 'bg-yellow-100 text-yellow-800',
  cloudy: 'bg-blue-100 text-blue-800',
  stormy: 'bg-red-100 text-red-800',
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  facile: '🟢 Facile',
  moyen: '🟡 Moyen',
  difficile: '🔴 Difficile',
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  facile: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  moyen: 'bg-amber-50 text-amber-700 border-amber-200',
  difficile: 'bg-red-50 text-red-700 border-red-200',
}
