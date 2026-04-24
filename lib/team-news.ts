import { supabaseAdmin } from './supabase-admin'

// Seuils paliers (alignés sur getDynamique dans axeHelpers.ts)
const THRESHOLDS = [
  { count: 1, icon: '🧪', label: 'Essai', verb: 'démarre' },
  { count: 3, icon: '🔄', label: 'Habitude', verb: 'passe en' },
  { count: 5, icon: '⚡', label: 'Réflexe', verb: 'franchit' },
  { count: 7, icon: '👑', label: 'Maîtrise', verb: 'atteint la' },
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

// Rotation de variantes — rend le ticker moins répétitif si plusieurs events du même type
function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

/**
 * Génère une petite liste de news valorisantes pour le groupe
 * (à partir de l'activité des 7 derniers jours).
 * Formulations variées, tournures valorisantes, pas de bruit.
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

  const firstNameById = new Map<string, string>()
  for (const m of members) firstNameById.set(m.learner_id, m.first_name)
  const displayName = (id: string) => id === currentUserId ? 'Toi' : (firstNameById.get(id) ?? 'Un membre')
  const verbConjugated = (id: string, thirdPerson: string, secondPerson: string) =>
    id === currentUserId ? secondPerson : thirdPerson

  // ── Toutes les actions des membres ──
  const { data: actionsRaw } = await supabaseAdmin
    .from('actions')
    .select('axe_id, learner_id, created_at')
    .in('learner_id', memberIds)

  const actions = (actionsRaw ?? []) as ActionRow[]
  const totalGroup = actions.length

  // ── Level-ups franchis dans la semaine ──
  const levelUps: Array<{ learnerId: string; icon: string; label: string; verb: string }> = []
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
        levelUps.push({ learnerId, icon: t.icon, label: t.label, verb: t.verb })
      }
    }
  })

  // ── First actions ──
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

  const { data: quizzesRaw } = await supabaseAdmin
    .from('quizzes')
    .select('id')
    .eq('group_id', groupId)
  const groupQuizIds = new Set((quizzesRaw ?? []).map(q => q.id))

  const cartonsPleins: string[] = []
  let totalQuizAnswered = 0
  for (const a of (attemptsRaw ?? [])) {
    if (!groupQuizIds.has((a as { quiz_id: string }).quiz_id)) continue
    totalQuizAnswered++
    if ((a as { score: number }).score >= 4) {
      cartonsPleins.push((a as { learner_id: string }).learner_id)
    }
  }

  // ── Jalon équipe ──
  const actionsBeforeCount = actions.filter(a => a.created_at < sevenDaysAgoStr).length
  const crossedMilestone = GROUP_MILESTONES.find(
    m => actionsBeforeCount < m && totalGroup >= m
  )

  // ── Streaks d'actions dans la semaine (3+ actions) ──
  const weekActionsCount = new Map<string, number>()
  for (const a of actions) {
    if (a.created_at >= sevenDaysAgoStr) {
      weekActionsCount.set(a.learner_id, (weekActionsCount.get(a.learner_id) ?? 0) + 1)
    }
  }
  const streakers: Array<{ learnerId: string; count: number }> = []
  weekActionsCount.forEach((count, learnerId) => {
    if (count >= 3) streakers.push({ learnerId, count })
  })

  // ── Tout le monde actif ──
  const allActive = weekActionsCount.size === memberIds.length && memberIds.length > 1

  // ── Check-ins de la semaine (ambiance équipe) ──
  const { data: checkinsRaw } = await supabaseAdmin
    .from('checkins')
    .select('learner_id')
    .in('learner_id', memberIds)
    .gte('created_at', sevenDaysAgoStr)
  const checkinsCount = (checkinsRaw ?? []).length
  const allCheckedIn = checkinsCount === memberIds.length && memberIds.length > 1

  // ── Nombre total d'actions cette semaine ──
  const weekTotal = Array.from(weekActionsCount.values()).reduce((a, b) => a + b, 0)

  // ═════════════════════════════════════════════════════
  // Composition des messages (formulations variées et vivantes)
  // ═════════════════════════════════════════════════════
  const news: string[] = []

  // Level-ups — priorité absolue
  levelUps.forEach((lu, i) => {
    const name = displayName(lu.learnerId)
    const self = lu.learnerId === currentUserId
    const variants = [
      `${lu.icon} ${name} ${verbConjugated(lu.learnerId, lu.verb + ' ' + lu.label, 'passes en ' + lu.label)} sur un de ${self ? 'tes' : 'ses'} axes`,
      `${lu.icon} ${name} ${verbConjugated(lu.learnerId, 'débloque le niveau', 'débloques le niveau')} ${lu.label}`,
    ]
    if (lu.label === 'Maîtrise') {
      variants.push(`${lu.icon} ${name} ${verbConjugated(lu.learnerId, 'maîtrise un axe de progrès', 'maîtrises un axe de progrès')} — respect`)
    }
    news.push(pick(variants, i))
  })

  // Cartons pleins
  cartonsPleins.forEach((id, i) => {
    const name = displayName(id)
    const self = id === currentUserId
    const variants = [
      `🃏 ${name} ${self ? 'as' : 'a'} fait 4/4 au dernier quiz — carton plein`,
      `🏅 ${self ? 'Tu as' : name + ' a'} tout bon au dernier quiz`,
      `🎉 4 sur 4 pour ${name} au dernier quiz — joli coup`,
    ]
    news.push(pick(variants, i))
  })

  // Premières actions
  firstActionsOfLearners.forEach((id, i) => {
    const name = displayName(id)
    const self = id === currentUserId
    const variants = [
      `🌱 ${name} ${self ? 'viens' : 'vient'} de poster ${self ? 'ta' : 'sa'} toute première action`,
      `🎉 Première action pour ${name} — bienvenue dans le mouvement`,
      `👋 ${name} ${self ? 'franchis' : 'franchit'} le premier pas avec une action`,
    ]
    news.push(pick(variants, i))
  })

  // Streaks d'actions (3+ cette semaine)
  streakers.forEach((s, i) => {
    const name = displayName(s.learnerId)
    const self = s.learnerId === currentUserId
    const variants = [
      `🔥 ${name} ${self ? 'enchaînes' : 'enchaîne'} ${s.count} actions cette semaine`,
      `💪 ${s.count} actions pour ${name} cette semaine — le rythme est là`,
    ]
    news.push(pick(variants, i))
  })

  // Jalon équipe
  if (crossedMilestone) {
    const variants = [
      `🏆 Le groupe passe la barre des ${crossedMilestone} actions cumulées`,
      `📈 Cap des ${crossedMilestone} actions franchi côté équipe — bravo à tous`,
      `🎪 ${crossedMilestone} actions au compteur du groupe`,
    ]
    news.push(pick(variants, 0))
  }

  // Tout le monde actif
  if (allActive) {
    news.push(`✨ Tout le groupe a posté au moins une action cette semaine`)
  }

  // Tout le monde a fait son check-in
  if (allCheckedIn) {
    news.push(`🤝 100% de check-ins cette semaine — équipe soudée`)
  }

  // Bilan factuel si pas grand chose ne s'est passé
  if (news.length === 0 && weekTotal > 0) {
    news.push(`📣 ${weekTotal} action${weekTotal > 1 ? 's' : ''} dans l'équipe cette semaine`)
  }
  if (news.length === 0 && totalQuizAnswered > 0) {
    news.push(`🃏 ${totalQuizAnswered} quiz répondu${totalQuizAnswered > 1 ? 's' : ''} dans l'équipe cette semaine`)
  }

  // Limiter à 6 news max (était 4 — on a plus de variété désormais)
  return news.slice(0, 6)
}
