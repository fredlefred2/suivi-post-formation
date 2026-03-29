// ── Types partagés pour les rapports PDF ──
// Fichier séparé sans dépendance à jsPDF (compatible Edge runtime)

export type WeekWeather = {
  week: number
  year: number
  weather: 'sunny' | 'cloudy' | 'stormy'
}

export type LearnerReportData = {
  id: string
  firstName: string
  lastName: string
  createdAt: string
  axes: string[]
  axeActionCounts: number[]
  axeActions: string[][]      // descriptions des actions par axe
  totalActions: number
  weeksSinceJoin: number
  avgActionsPerWeek: number
  /** % de semaines où l'apprenant a fait au moins 1 action */
  regularityPct: number
  weatherHistory: WeekWeather[]
  weatherSummary: { sunny: number; cloudy: number; stormy: number }
  whatWorked: string[]
  difficulties: string[]
}

export type GroupReportData = {
  groupName: string
  trainerName: string
  generatedAt: string
  participantCount: number
  totalAxes: number
  totalActions: number
  avgActionsPerWeek: number
  avgActionsPerAxe: number
  /** Nombre d'apprenants ayant au moins 1 action */
  activeLearnersCount: number
  /** Moyenne des régularités individuelles (0-100) */
  groupRegularityPct: number
  /** Note climat sur 5 (moyenne des moyennes individuelles : sunny=5, cloudy=3, stormy=1) */
  groupClimatScore?: number
  weatherHistory: Array<{ week: number; year: number; weather: string }>
  weatherSummary: { sunny: number; cloudy: number; stormy: number }
  learners: LearnerReportData[]
}
