import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/**
 * Retourne le numéro de semaine ISO et l'année courante.
 */
export function getCurrentWeek(): { week: number; year: number } {
  const now = new Date()
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const diff = now.getTime() - startOfWeek1.getTime()
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return { week, year: now.getFullYear() }
}

/**
 * Formate une date en français (ex: "lundi 3 juin 2024").
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Formate "Semaine N — YYYY".
 */
export function formatWeek(week: number, year: number): string {
  return `Semaine ${week} — ${year}`
}

/**
 * Retourne le nombre de semaines écoulées depuis une date.
 */
export function weeksSince(dateStr: string): number {
  const created = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - created.getTime()
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000))
}

/**
 * Retourne le nombre de check-ins attendus depuis l'inscription.
 * Le 1er check-in est attendu le 2e vendredi suivant la date d'inscription.
 * Ensuite, un check-in est attendu chaque vendredi.
 */
export function expectedCheckins(createdAt: string): number {
  const created = new Date(createdAt)

  // 1er vendredi strictement après l'inscription
  const d = new Date(created)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const daysToNextFriday = (5 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysToNextFriday)

  // 2e vendredi après l'inscription (premier check-in attendu)
  d.setDate(d.getDate() + 7)
  d.setHours(9, 0, 0, 0)

  const now = new Date()
  if (now < d) return 0

  const diffMs = now.getTime() - d.getTime()
  return Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1
}

/**
 * Calcule le streak (série de semaines consécutives avec check-in).
 */
export function calculateStreak(
  checkins: Array<{ week_number: number; year: number }>,
  currentWeek: number,
  currentYear: number
): number {
  const weekSet = new Set(checkins.map(c => `${c.year}-${c.week_number}`))
  if (weekSet.size === 0) return 0

  let streak = 0
  let w = currentWeek
  let y = currentYear

  // Si la semaine courante est faite, on la compte
  if (weekSet.has(`${y}-${w}`)) {
    streak++
  }

  // Remonter dans le temps semaine par semaine
  while (true) {
    w--
    if (w <= 0) { y--; w = 52 }
    if (weekSet.has(`${y}-${w}`)) {
      streak++
    } else {
      break
    }
  }

  return streak
}

/**
 * Retourne la date du 2e vendredi suivant une date d'inscription.
 */
export function secondFridayAfter(createdAt: string): Date {
  const created = new Date(createdAt)
  const d = new Date(created)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const daysToNextFriday = (5 - day + 7) % 7 || 7
  d.setDate(d.getDate() + daysToNextFriday + 7)
  d.setHours(9, 0, 0, 0)
  return d
}
