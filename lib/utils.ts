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
