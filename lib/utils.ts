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
 * Retourne le lundi d'une semaine ISO donnée.
 */
export function getMondayOfISOWeek(week: number, year: number): Date {
  const jan4 = new Date(year, 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const monday = new Date(startOfWeek1)
  monday.setDate(startOfWeek1.getDate() + (week - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  return monday
}

/**
 * Formate une date courte en français : "lun. 9 mars"
 */
function formatShortDate(date: Date): string {
  const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`
}

/**
 * Formate le label d'une semaine avec dates : "Semaine 11 (lun. 9 → ven. 13 mars 2026)"
 */
export function formatWeekWithDates(week: number, year: number): string {
  const monday = getMondayOfISOWeek(week, year)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return `Semaine ${week} (${formatShortDate(monday)} → ${formatShortDate(friday)} ${year})`
}

/**
 * Contexte de check-in : détermine si la fenêtre est ouverte (vendredi → lundi)
 * et pour quelle semaine.
 *
 * - Vendredi/Samedi/Dimanche : check-in pour la semaine ISO courante
 * - Lundi : check-in pour la semaine ISO précédente (dernière chance)
 * - Mardi → Jeudi : pas de check-in disponible
 */
export function getCheckinContext(): {
  isOpen: boolean
  checkinWeek: number
  checkinYear: number
  weekLabel: string
} {
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=dim, 1=lun, ..., 5=ven, 6=sam

  const { week: currentWeek, year: currentYear } = getCurrentWeek()

  // Mardi(2) → Jeudi(4) : fenêtre fermée
  if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    return {
      isOpen: false,
      checkinWeek: currentWeek,
      checkinYear: currentYear,
      weekLabel: '',
    }
  }

  // Lundi(1) : check-in pour la semaine précédente
  if (dayOfWeek === 1) {
    let targetWeek = currentWeek - 1
    let targetYear = currentYear
    if (targetWeek <= 0) {
      targetYear--
      targetWeek = 52
    }
    return {
      isOpen: true,
      checkinWeek: targetWeek,
      checkinYear: targetYear,
      weekLabel: formatWeekWithDates(targetWeek, targetYear),
    }
  }

  // Vendredi(5), Samedi(6), Dimanche(0) : check-in pour la semaine courante
  // Attention : dimanche (0) est le dernier jour de la semaine ISO courante
  // mais le getCurrentWeek() renvoie déjà la bonne semaine pour ven/sam
  // Pour dimanche, getCurrentWeek() pourrait renvoyer la semaine suivante
  // car ISO semaine commence le lundi. Recalculons pour être sûr.
  if (dayOfWeek === 0) {
    // Dimanche : la semaine ISO à évaluer est celle qui vient de finir
    // = semaine courante ISO - 0 (dimanche fait partie de la semaine précédente en ISO)
    // En fait, en ISO, dimanche est le jour 7 de la semaine, donc getCurrentWeek
    // devrait retourner la bonne semaine. Mais vérifions en prenant le vendredi d'avant.
    const lastFriday = new Date(now)
    lastFriday.setDate(now.getDate() - 2) // dim - 2 = ven
    const jan4 = new Date(lastFriday.getFullYear(), 0, 4)
    const startOfWeek1 = new Date(jan4)
    startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
    const diff = lastFriday.getTime() - startOfWeek1.getTime()
    const targetWeek = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
    const targetYear = lastFriday.getFullYear()
    return {
      isOpen: true,
      checkinWeek: targetWeek,
      checkinYear: targetYear,
      weekLabel: formatWeekWithDates(targetWeek, targetYear),
    }
  }

  // Vendredi(5) ou Samedi(6) : semaine ISO courante
  return {
    isOpen: true,
    checkinWeek: currentWeek,
    checkinYear: currentYear,
    weekLabel: formatWeekWithDates(currentWeek, currentYear),
  }
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
 * Nombre de jours calendaires écoulés entre `from` et `to`, calculé
 * dans le fuseau Europe/Paris (les apprenants sont en France).
 *
 * Différent de `Math.floor((to - from) / 86400000)` qui compte des
 * tranches de 24h glissantes et peut sous-compter d'un jour selon
 * l'heure exacte des deux dates.
 *
 * Exemple : action hier à 23h Paris, on vérifie à 9h aujourd'hui
 *   - Math.floor(elapsed ms / 86400000) = 0 (faux : c'est "hier")
 *   - parisCalendarDaysBetween = 1 ✓
 */
export function parisCalendarDaysBetween(
  from: Date | string,
  to: Date | string = new Date()
): number {
  const f = typeof from === 'string' ? new Date(from) : from
  const t = typeof to === 'string' ? new Date(to) : to
  const fmt = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const get = (d: Date, type: string) => Number(
    fmt.formatToParts(d).find((p) => p.type === type)!.value
  )
  const fUtc = Date.UTC(get(f, 'year'), get(f, 'month') - 1, get(f, 'day'))
  const tUtc = Date.UTC(get(t, 'year'), get(t, 'month') - 1, get(t, 'day'))
  return Math.floor((tUtc - fUtc) / (24 * 3600 * 1000))
}

/**
 * Un apprenant est éligible aux alertes (check-in, relance, etc.)
 * dès qu'il est inscrit depuis au moins 5 jours calendaires (Paris).
 *
 * Règle :
 *   - Inscrit un jeudi → pas de check-in le lendemain (vendredi)
 *   - Inscrit un vendredi ou dimanche → pas de check-in à remplir cette
 *     fenêtre ven-lun, le premier check-in sera vendredi suivant
 *
 * Le seuil 5 jours laisse toujours assez de marge pour que le prochain
 * vendredi matin soit déjà au-delà du seuil, quelle que soit l'heure
 * d'inscription.
 */
export function isEligibleForAlerts(createdAt: string | Date): boolean {
  return parisCalendarDaysBetween(createdAt) >= 5
}
