import { supabaseAdmin } from './supabase-admin'

export interface LearnerTipContext {
  // Axe
  axeId: string
  axeSubject: string
  axeDescription: string
  // Groupe
  groupTheme: string
  // Apprenant
  learnerId: string
  firstName: string
  weekInProgram: number
  // Niveau sur l'axe
  actionCount: number
  recentActions: string[]
  // Engagement global
  totalActions: number
  regularityPct: number
  checkinStreak: number
  likesReceived: number
  commentsReceived: number
  // Check-ins
  lastWeather: string | null
  weatherTrend: string // ↗️ ➡️ ↘️
  whatWorked: string | null
  difficulties: string | null
  // Tips precedents
  previousTips: Array<{ week: number; content: string; advice: string | null; acted: boolean }>
}

/**
 * Collecte toutes les donnees contextuelles d'un apprenant
 * pour generer un tip personnalise sur un axe donne.
 */
export async function gatherLearnerContext(
  learnerId: string,
  axeId: string
): Promise<LearnerTipContext | null> {
  // ── 1. Profil ─────────────────────────────────────────────────
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('first_name, created_at')
    .eq('id', learnerId)
    .single()

  if (!profile) return null

  const now = new Date()
  const joinDate = new Date(profile.created_at)
  const weekInProgram = Math.max(1, Math.ceil((now.getTime() - joinDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))

  // ── 2. Axe + actions ──────────────────────────────────────────
  const { data: axe } = await supabaseAdmin
    .from('axes')
    .select('subject, description')
    .eq('id', axeId)
    .single()

  if (!axe) return null

  const { data: axeActions } = await supabaseAdmin
    .from('actions')
    .select('id, description, created_at')
    .eq('axe_id', axeId)
    .order('created_at', { ascending: false })
    .limit(10)

  const actionCount = axeActions?.length ?? 0
  const recentActions = (axeActions ?? []).map(a => a.description)

  // ── 3. Groupe + theme ─────────────────────────────────────────
  const { data: membership } = await supabaseAdmin
    .from('group_members')
    .select('group_id, groups!inner(theme)')
    .eq('learner_id', learnerId)
    .limit(1)
    .maybeSingle()

  const groupTheme = (membership?.groups as unknown as { theme: string })?.theme ?? ''

  // ── 4. Check-ins ──────────────────────────────────────────────
  const { data: checkins } = await supabaseAdmin
    .from('checkins')
    .select('weather, what_worked, difficulties, week_number, year')
    .eq('learner_id', learnerId)
    .order('year', { ascending: false })
    .order('week_number', { ascending: false })
    .limit(4)

  const lastWeather = checkins?.[0]?.weather ?? null
  const whatWorked = (checkins?.[0] as Record<string, unknown>)?.what_worked as string | null ?? null
  const difficulties = (checkins?.[0] as Record<string, unknown>)?.difficulties as string | null ?? null

  // Tendance meteo (derniers check-ins)
  let weatherTrend = '➡️'
  if (checkins && checkins.length >= 2) {
    const weatherScore = (w: string) => w === 'sunny' ? 3 : w === 'cloudy' ? 2 : 1
    const recent = weatherScore(checkins[0].weather)
    const older = weatherScore(checkins[checkins.length - 1].weather)
    if (recent > older) weatherTrend = '↗️'
    else if (recent < older) weatherTrend = '↘️'
  }

  // Streak check-ins
  let checkinStreak = 0
  if (checkins && checkins.length > 0) {
    const sorted = [...checkins].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.week_number - a.week_number
    })
    let prevWeek = sorted[0].week_number
    let prevYear = sorted[0].year
    checkinStreak = 1
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].week_number === prevWeek - 1 && sorted[i].year === prevYear) {
        checkinStreak++
        prevWeek = sorted[i].week_number
      } else if (prevWeek === 1 && sorted[i].year === prevYear - 1 && sorted[i].week_number >= 51) {
        checkinStreak++
        prevWeek = sorted[i].week_number
        prevYear = sorted[i].year
      } else break
    }
  }

  // ── 5. Regularite globale ─────────────────────────────────────
  const { data: allActions } = await supabaseAdmin
    .from('actions')
    .select('created_at')
    .eq('learner_id', learnerId)

  const totalActions = allActions?.length ?? 0

  const actionWeeks = new Set((allActions ?? []).map(a => {
    const d = new Date(a.created_at)
    const yr = d.getFullYear()
    const wk = Math.ceil(((d.getTime() - new Date(yr, 0, 1).getTime()) / 86400000 + new Date(yr, 0, 1).getDay() + 1) / 7)
    return `${yr}-${wk}`
  }))
  const regularityPct = Math.min(100, Math.round((actionWeeks.size / weekInProgram) * 100))

  // ── 6. Likes et commentaires recus sur cet axe ────────────────
  const axeActionIds = (axeActions ?? []).map(a => a.id)
  let likesReceived = 0
  let commentsReceived = 0

  if (axeActionIds.length > 0) {
    const [{ count: likes }, { count: comments }] = await Promise.all([
      supabaseAdmin
        .from('action_likes')
        .select('*', { count: 'exact', head: true })
        .in('action_id', axeActionIds),
      supabaseAdmin
        .from('action_comments')
        .select('*', { count: 'exact', head: true })
        .in('action_id', axeActionIds),
    ])
    likesReceived = likes ?? 0
    commentsReceived = comments ?? 0
  }

  // ── 7. Tips precedents sur cet axe ────────────────────────────
  const { data: tips } = await supabaseAdmin
    .from('tips')
    .select('week_number, content, advice, acted')
    .eq('axe_id', axeId)
    .eq('learner_id', learnerId)
    .eq('sent', true)
    .order('week_number')

  const previousTips = (tips ?? []).map(t => ({
    week: t.week_number,
    content: t.content,
    advice: t.advice,
    acted: t.acted,
  }))

  return {
    axeId,
    axeSubject: axe.subject,
    axeDescription: axe.description || axe.subject,
    groupTheme,
    learnerId,
    firstName: profile.first_name.trim(),
    weekInProgram,
    actionCount,
    recentActions,
    totalActions,
    regularityPct,
    checkinStreak,
    likesReceived,
    commentsReceived,
    lastWeather,
    weatherTrend,
    whatWorked,
    difficulties,
    previousTips,
  }
}
