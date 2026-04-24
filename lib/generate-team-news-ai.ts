import { supabaseAdmin } from './supabase-admin'

type ActionLite = { learner_id: string; axe_id: string; description: string; created_at: string }
type AxeLite = { id: string; learner_id: string; subject: string }

/** Cache max TTL — au-delà, on re-calcule (fallback hardcoded si Claude indispo) */
export const TEAM_NEWS_CACHE_TTL_DAYS = 8

/**
 * Lit les news narratives cachées pour un groupe.
 * Retourne null si pas de cache ou cache trop vieux.
 */
export async function readCachedTeamNews(groupId: string): Promise<string[] | null> {
  const { data } = await supabaseAdmin
    .from('team_news_cache')
    .select('generated_at, news')
    .eq('group_id', groupId)
    .maybeSingle()

  if (!data) return null

  const ageMs = Date.now() - new Date(data.generated_at).getTime()
  if (ageMs > TEAM_NEWS_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000) return null

  const news = data.news
  if (!Array.isArray(news)) return null
  return news.filter(n => typeof n === 'string') as string[]
}

/**
 * Génère avec Claude puis persiste en cache les news narratives d'un groupe.
 * Appelée par le cron hebdomadaire et (rarement) à la volée.
 */
export async function generateAndCacheTeamNews(groupId: string): Promise<string[] | null> {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    console.error('[TeamNewsAI] CLAUDE_API_KEY manquante')
    return null
  }

  // ── Charger contexte groupe ──
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('id, name, theme')
    .eq('id', groupId)
    .maybeSingle()
  if (!group) {
    console.error('[TeamNewsAI] Groupe introuvable:', groupId)
    return null
  }

  const { data: membersRaw } = await supabaseAdmin
    .from('group_members')
    .select('learner_id, profiles!inner(first_name, last_name)')
    .eq('group_id', groupId)

  type MemberRow = { learner_id: string; profiles: { first_name: string; last_name: string } }
  const members = (membersRaw ?? []) as unknown as MemberRow[]
  const memberIds = members.map(m => m.learner_id)
  if (memberIds.length === 0) return null

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const sevenDaysAgoStr = sevenDaysAgo.toISOString()

  // Axes + actions totaux des membres (pour détecter level-ups)
  const { data: axesRaw } = await supabaseAdmin
    .from('axes')
    .select('id, learner_id, subject')
    .in('learner_id', memberIds)
  const axes = (axesRaw ?? []) as AxeLite[]

  const { data: actionsRaw } = await supabaseAdmin
    .from('actions')
    .select('learner_id, axe_id, description, created_at')
    .in('learner_id', memberIds)
    .order('created_at', { ascending: false })
  const actions = (actionsRaw ?? []) as ActionLite[]

  // Check-ins 7j
  const { data: checkinsRaw } = await supabaseAdmin
    .from('checkins')
    .select('learner_id')
    .in('learner_id', memberIds)
    .gte('created_at', sevenDaysAgoStr)
  const checkinsCount = (checkinsRaw ?? []).length

  // Quiz complétés 7j
  const { data: quizAttemptsRaw } = await supabaseAdmin
    .from('quiz_attempts')
    .select('learner_id, score, completed_at, quiz_id')
    .in('learner_id', memberIds)
    .not('completed_at', 'is', null)
    .gte('completed_at', sevenDaysAgoStr)

  // ── Agrégats pour le prompt ──
  const firstNameById = new Map(members.map(m => [m.learner_id, m.profiles.first_name]))

  // Actions 7 jours par apprenant
  type WeekAgg = { firstName: string; actions7d: Array<{ axe_subject: string; description: string }>; totalActions: number }
  const weekAgg = new Map<string, WeekAgg>()
  for (const m of members) {
    weekAgg.set(m.learner_id, { firstName: m.profiles.first_name, actions7d: [], totalActions: 0 })
  }
  for (const a of actions) {
    const agg = weekAgg.get(a.learner_id)
    if (!agg) continue
    agg.totalActions++
    if (a.created_at >= sevenDaysAgoStr) {
      const axe = axes.find(x => x.id === a.axe_id)
      agg.actions7d.push({ axe_subject: axe?.subject ?? '?', description: a.description })
    }
  }

  // Level-ups (par axe, par apprenant) sur les 7 derniers jours
  const thresholds = [
    { count: 1, label: 'Essai' },
    { count: 3, label: 'Habitude' },
    { count: 5, label: 'Réflexe' },
    { count: 7, label: 'Maîtrise' },
  ]
  const byAxeLearner = new Map<string, { before: number; after: number; axe_subject: string; learner_id: string }>()
  for (const a of actions) {
    const key = `${a.axe_id}:${a.learner_id}`
    const axe = axes.find(x => x.id === a.axe_id)
    const bucket = byAxeLearner.get(key) ?? { before: 0, after: 0, axe_subject: axe?.subject ?? '?', learner_id: a.learner_id }
    bucket.after++
    if (a.created_at < sevenDaysAgoStr) bucket.before++
    byAxeLearner.set(key, bucket)
  }
  const levelUps: Array<{ firstName: string; axe_subject: string; label: string }> = []
  byAxeLearner.forEach(({ before, after, axe_subject, learner_id }) => {
    for (const t of thresholds) {
      if (before < t.count && after >= t.count) {
        const firstName = firstNameById.get(learner_id) ?? ''
        if (firstName) levelUps.push({ firstName, axe_subject, label: t.label })
      }
    }
  })

  // Premières actions de la semaine (apprenant qui poste sa 1re action ever)
  const firstActions: string[] = []
  firstNameById.forEach((firstName, learnerId) => {
    const actsOfLearner = actions.filter(a => a.learner_id === learnerId)
    if (actsOfLearner.length === 0) return
    const sorted = [...actsOfLearner].sort((a, b) => a.created_at.localeCompare(b.created_at))
    if (sorted[0].created_at >= sevenDaysAgoStr) firstActions.push(firstName)
  })

  // Quiz parfaits 7j (score = 4)
  const perfectQuizzes: string[] = []
  for (const q of (quizAttemptsRaw ?? [])) {
    if ((q as { score: number }).score >= 4) {
      const firstName = firstNameById.get((q as { learner_id: string }).learner_id)
      if (firstName) perfectQuizzes.push(firstName)
    }
  }
  const quizCompleted = (quizAttemptsRaw ?? []).length

  // Jalons groupe
  const actionsBeforeCount = actions.filter(a => a.created_at < sevenDaysAgoStr).length
  const totalGroup = actions.length
  const milestones = [10, 25, 50, 100, 200, 500]
  const crossedMilestone = milestones.find(m => actionsBeforeCount < m && totalGroup >= m)

  // ── Construire le bloc contexte pour Claude ──
  const weekBreakdown: string[] = []
  weekAgg.forEach(({ firstName, actions7d }) => {
    if (actions7d.length === 0) return
    const bySubject = new Map<string, number>()
    for (const a of actions7d) {
      bySubject.set(a.axe_subject, (bySubject.get(a.axe_subject) ?? 0) + 1)
    }
    const detail = Array.from(bySubject.entries())
      .map(([subject, count]) => `${count}× "${subject}"`)
      .join(', ')
    weekBreakdown.push(`- ${firstName} : ${actions7d.length} action(s) cette semaine — ${detail}`)
  })

  const contextBlock = `
GROUPE : "${group.name}"${group.theme ? ` (formation : ${group.theme.slice(0, 200)})` : ''}
${members.length} apprenant(s) : ${members.map(m => m.profiles.first_name).join(', ')}

ACTIONS DE LA SEMAINE ÉCOULÉE :
${weekBreakdown.length > 0 ? weekBreakdown.join('\n') : '- Aucune action cette semaine'}

LEVEL-UPS FRANCHIS :
${levelUps.length > 0 ? levelUps.map(l => `- ${l.firstName} passe ${l.label} sur "${l.axe_subject}"`).join('\n') : '- Aucun palier franchi'}

PREMIÈRES ACTIONS (apprenants qui ont démarré cette semaine) :
${firstActions.length > 0 ? firstActions.map(n => `- ${n}`).join('\n') : '- Aucune'}

QUIZ : ${quizCompleted} quiz répondu(s) cette semaine, ${perfectQuizzes.length > 0 ? `4/4 par : ${perfectQuizzes.join(', ')}` : 'aucun carton plein'}.
CHECK-INS : ${checkinsCount} check-in(s) cette semaine (total membres : ${members.length}).
ACTIONS CUMULÉES DU GROUPE : ${totalGroup}${crossedMilestone ? ` (cap des ${crossedMilestone} franchi cette semaine !)` : ''}
`.trim()

  const prompt = `Tu es rédacteur d'un petit fil d'actu chaleureux pour une équipe en formation. À partir du contexte ci-dessous, rédige **4 à 6 news courtes et variées** qui résument les moments marquants de la semaine pour l'équipe.

${contextBlock}

RÈGLES DE RÉDACTION :
- Chaque news = UNE phrase courte (max 90 caractères), en français, tutoiement naturel.
- Commence par un emoji qui colle (👑 pour Maîtrise, 🔥 pour régularité, 🌱 pour démarrage, 🃏 pour quiz, 💪 pour effort, 🏆 pour jalon équipe, 📚 pour thématique, etc.).
- **Groupe les apprenants quand ils ont bossé sur un thème proche** : "Marie et Hélène ont bossé sur l'écoute active cette semaine" — même si les libellés d'axes sont différents, si tu perçois un sujet commun, tu le nommes.
- **Focus individuel** quand un apprenant a posté plusieurs actions sur un même axe : "Tim a renforcé sa négo : 2 actions cette semaine".
- **Première action** = événement marquant : "Thomas a franchi le pas avec sa première action".
- **Jalon équipe** (cap franchi) à mettre en avant si applicable.
- Varie les tournures. Évite la répétition ("X fait Y", "Y fait Z", "Z fait W" → c'est mou).
- JAMAIS de ton compétitif, JAMAIS de "le meilleur", JAMAIS de classement numéroté.
- JAMAIS de jargon marketing ("top performer", "champions", "leader").
- Ton : celui d'un coach grand-frère/grande-sœur qui observe son équipe avec bienveillance.

Réponds UNIQUEMENT avec un tableau JSON de strings, sans markdown, sans préambule :
["news 1", "news 2", "news 3", "news 4"]

Rien d'autre.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('[TeamNewsAI] Claude error:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const text = (data.content?.[0]?.text ?? '').trim()

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[TeamNewsAI] Pas de tableau JSON. Réponse:', text.slice(0, 500))
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('[TeamNewsAI] JSON invalide:', err)
      return null
    }

    if (!Array.isArray(parsed)) return null
    const news = parsed
      .filter(n => typeof n === 'string')
      .map(n => (n as string).trim())
      .filter(n => n.length > 0 && n.length <= 200)
      .slice(0, 6)

    if (news.length === 0) return null

    // Upsert dans le cache
    const { error: upsertErr } = await supabaseAdmin
      .from('team_news_cache')
      .upsert(
        { group_id: groupId, news, generated_at: new Date().toISOString() },
        { onConflict: 'group_id' }
      )
    if (upsertErr) {
      console.error('[TeamNewsAI] Erreur upsert cache:', upsertErr.message)
      // On retourne quand même les news (elles ne seront juste pas cachées)
    }

    console.log(`[TeamNewsAI] ${news.length} news générées et cachées pour group=${groupId.slice(0, 8)}`)
    return news
  } catch (err) {
    console.error('[TeamNewsAI] Exception Claude:', err)
    return null
  }
}
