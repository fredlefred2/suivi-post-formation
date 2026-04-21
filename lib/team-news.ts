import { supabaseAdmin } from './supabase-admin'

// Seuils paliers (alignés sur getDynamique dans axeHelpers.ts)
const THRESHOLDS = [
  { count: 1, icon: '🧪', label: 'Essai' },
  { count: 3, icon: '🔄', label: 'Habitude' },
  { count: 5, icon: '⚡', label: 'Réflexe' },
  { count: 7, icon: '👑', label: 'Maîtrise' },
]

// Jalons d'actions cumulées côté groupe
const GROUP_MILESTONES = [10, 25, 50, 100, 200, 500]

type Member = {
  learner_id: string
  first_name: string
}

type ActionRow = {
  axe_id: string
  learner_id: string
  created_at: string
}

/**
 * Génère une petite liste de news valorisantes pour le groupe
 * (à partir de l'activité des 7 derniers jours).
 * Pas de bruit, pas d'alerte, pas de culpabilisation.
 */
export async function generateTeamNews({
  groupId,
  memberIds,
  members,
  currentUserId,
}: {
  groupId: string
  memberIds: string[]
  members: Member[]
  currentUserId: string
}): Promise<string[]> {
  if (memberIds.length === 0) return []

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString()

  // ── Toutes les actions des membres (pour calculer les paliers avant/après cutoff) ──
  const { data: actionsRaw } = await supabaseAdmin
    .from('actions')
    .select('axe_id, learner_id, created_at')
    .in('learner_id', memberIds)

  const actions = (actionsRaw ?? []) as ActionRow[]
  const totalGroup = actions.length

  const firstNameById = new Map<string, string>()
  for (const m of members) firstNameById.set(m.learner_id, m.first_name)
  const displayName = (id: string) => id === currentUserId ? 'Toi' : (firstNameById.get(id) ?? 'Un membre')

  // ── Level-ups franchis dans la semaine ──
  // Pour chaque (axe, learner) : count avant cutoff et count total.
  // Si un palier est franchi entre les deux → level-up récent.
  const levelUps: Array<{ learnerId: string; icon: string; label: string }> = []
  const byAxeLearner = new Map<string, { before: number; after: number }>()
  for (const a of actions) {
    const key = `${a.axe_id}:${a.learner_id}`
    const bucket = byAxeLearner.get(key) ?? { before: 0, after: 0 }
    bucket.after++
    if (a.created_at < sevenDaysAgoStr) bucket.before++
    byAxeLearner.set(key, bucket)
  }
  byAxeLearner.forEach(({ before, after }, key) => {
    const learnerId = key.split(':')[1]
    for (const t of THRESHOLDS) {
      if (before < t.count && after >= t.count) {
        levelUps.push({ learnerId, icon: t.icon, label: t.label })
      }
    }
  })

  // ── First actions : apprenant qui a posté sa 1re action totale dans la semaine ──
  const firstActionsOfLearners: string[] = []
  firstNameById.forEach((_, learnerId) => {
    const learnerActions = actions.filter(a => a.learner_id === learnerId)
    if (learnerActions.length === 0) return
    const first = learnerActions.sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
    if (first.created_at >= sevenDaysAgoStr) {
      firstActionsOfLearners.push(learnerId)
    }
  })

  // ── Quiz cartons pleins récents ──
  const { data: attemptsRaw } = await supabaseAdmin
    .from('quiz_attempts')
    .select('learner_id, score, completed_at, quiz_id')
    .in('learner_id', memberIds)
    .not('completed_at', 'is', null)
    .gte('completed_at', sevenDaysAgoStr)

  // On a besoin du nombre de questions pour savoir si c'est un carton plein.
  // Les quiz ont 4 questions (QUIZ_QUESTIONS_PER_QUIZ), mais on reste générique.
  const { data: quizzesRaw } = await supabaseAdmin
    .from('quizzes')
    .select('id')
    .eq('group_id', groupId)
  const groupQuizIds = new Set((quizzesRaw ?? []).map(q => q.id))

  const cartonsPleins: string[] = []
  for (const a of (attemptsRaw ?? [])) {
    if (!groupQuizIds.has((a as { quiz_id: string }).quiz_id)) continue
    // Carton plein = score 4 (4 questions par quiz)
    if ((a as { score: number }).score >= 4) {
      cartonsPleins.push((a as { learner_id: string }).learner_id)
    }
  }

  // ── Jalon équipe (action cumulée franchie dans la semaine) ──
  const actionsBeforeCount = actions.filter(a => a.created_at < sevenDaysAgoStr).length
  const crossedMilestone = GROUP_MILESTONES.find(
    m => actionsBeforeCount < m && totalGroup >= m
  )

  // ── Tout le monde a été actif cette semaine ──
  const learnersActiveThisWeek = new Set<string>()
  for (const a of actions) {
    if (a.created_at >= sevenDaysAgoStr) learnersActiveThisWeek.add(a.learner_id)
  }
  const allActive = learnersActiveThisWeek.size === memberIds.length && memberIds.length > 1

  // ── Compose les messages (priorité aux events rares) ──
  const news: string[] = []

  // Level-ups
  for (const lu of levelUps) {
    const name = displayName(lu.learnerId)
    news.push(`${lu.icon} ${name} passe ${lu.label.toLowerCase()} sur un de ses axes`)
  }

  // Cartons pleins
  for (const id of cartonsPleins) {
    const name = displayName(id)
    news.push(`🎯 ${name} a fait 4/4 au dernier quiz — carton plein`)
  }

  // Premières actions
  for (const id of firstActionsOfLearners) {
    const name = displayName(id)
    news.push(`🌱 ${name} a posté sa première action`)
  }

  // Jalon équipe
  if (crossedMilestone) {
    news.push(`🏆 Le groupe passe la barre des ${crossedMilestone} actions cumulées`)
  }

  // Tout le monde actif
  if (allActive) {
    news.push(`✨ Cette semaine, tout le groupe a posté au moins une action`)
  }

  // Limiter à 4 news max pour ne pas saturer le ticker
  return news.slice(0, 4)
}
