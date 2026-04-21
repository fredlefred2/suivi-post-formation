export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { ActionFeedbackData } from '@/lib/types'
import { generateTeamNews } from '@/lib/team-news'
import TeamClient from './TeamClient'

export default async function TeamPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── Trouver le groupe de l'apprenant ──
  const { data: membership } = await admin
    .from('group_members')
    .select('group_id, groups!inner(id, name)')
    .eq('learner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Team</h1>
        <div className="card text-center py-8">
          <p className="text-gray-500">Vous n&apos;appartenez pas encore à un groupe.</p>
        </div>
      </div>
    )
  }

  const groupId = membership.group_id
  const group = membership.groups as unknown as { id: string; name: string }

  // ── Salle d'attente → accès bloqué ──
  if (group.name === "Salle d'attente") {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Team</h1>
        <div className="card text-center py-10 space-y-3">
          <span className="text-5xl">⏳</span>
          <p className="text-gray-700 font-medium">Vous êtes en salle d&apos;attente</p>
          <p className="text-sm text-gray-500">Votre formateur va bientôt vous affecter à un groupe. L&apos;espace Team sera alors accessible.</p>
        </div>
      </div>
    )
  }

  // ── Membres du groupe ──
  const { data: membersRaw } = await admin
    .from('group_members')
    .select('learner_id, profiles!inner(id, first_name, last_name)')
    .eq('group_id', groupId)

  type MemberRow = {
    learner_id: string
    profiles: { id: string; first_name: string; last_name: string }
  }

  const members = (membersRaw ?? []) as unknown as MemberRow[]
  const memberIds = members.map((m) => m.learner_id)

  // ── Axes + actions de tous les membres ──
  const { data: axesRaw } = memberIds.length > 0
    ? await admin
        .from('axes')
        .select('id, learner_id, subject, actions(id, description, created_at, learner_id, axe_id)')
        .in('learner_id', memberIds)
        .order('created_at')
    : { data: [] }

  type AxeRow = {
    id: string
    learner_id: string
    subject: string
    actions: Array<{ id: string; description: string; created_at: string; learner_id: string; axe_id: string }>
  }

  const axes = (axesRaw ?? []) as unknown as AxeRow[]

  // ── Construire learnerAxesMap pour le scoring ──
  const learnerAxesMap: Record<string, number[]> = {}
  axes.forEach((axe) => {
    if (!learnerAxesMap[axe.learner_id]) learnerAxesMap[axe.learner_id] = []
    learnerAxesMap[axe.learner_id].push(axe.actions?.length ?? 0)
  })

  // ── Construire la map noms ──
  const learnerNameMap: Record<string, string> = {}
  members.forEach((m) => {
    const p = m.profiles
    learnerNameMap[m.learner_id] = `${p.first_name} ${p.last_name}`
  })

  // ── Construire la map noms par axe pour les actions ──
  const axeSubjectMap: Record<string, string> = {}
  axes.forEach((axe) => {
    axeSubjectMap[axe.id] = axe.subject
  })

  // ── Actions des 7 derniers jours + activité 15j (pour le podium) ──
  const now = new Date()
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(now.getDate() - 7)
  sevenDaysAgo.setHours(0, 0, 0, 0)
  const cutoffStr = sevenDaysAgo.toISOString()

  const fifteenDaysAgo = new Date(now)
  fifteenDaysAgo.setDate(now.getDate() - 15)
  fifteenDaysAgo.setHours(0, 0, 0, 0)
  const fifteenCutoffStr = fifteenDaysAgo.toISOString()

  // Lundi courant pour le calcul météo
  const dayOfWeekNow = now.getDay()
  const diffToMonday = dayOfWeekNow === 0 ? 6 : dayOfWeekNow - 1
  const thisMonday = new Date(now)
  thisMonday.setHours(0, 0, 0, 0)
  thisMonday.setDate(now.getDate() - diffToMonday)

  const allActions = axes.flatMap((axe) =>
    (axe.actions ?? []).map((a) => ({
      ...a,
      axe_subject: axe.subject,
      axe_action_count: axe.actions?.length ?? 0,
      learner_name: learnerNameMap[axe.learner_id] ?? 'Inconnu',
      learner_first_name: members.find((m) => m.learner_id === axe.learner_id)?.profiles.first_name ?? '',
      learner_last_name: members.find((m) => m.learner_id === axe.learner_id)?.profiles.last_name ?? '',
    }))
  )

  const totalActions = allActions.length
  const recentActions = allActions
    .filter((a) => a.created_at >= cutoffStr)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Activité 15 derniers jours par apprenant (pour le tri du podium)
  const last15ActionsByLearner: Record<string, number> = {}
  const last15CheckinsByLearner: Record<string, number> = {}
  const last15QuizByLearner: Record<string, number> = {}
  memberIds.forEach(id => {
    last15ActionsByLearner[id] = 0
    last15CheckinsByLearner[id] = 0
    last15QuizByLearner[id] = 0
  })
  for (const a of allActions) {
    if (a.created_at >= fifteenCutoffStr) {
      const lid = (a as { learner_id: string }).learner_id
      last15ActionsByLearner[lid] = (last15ActionsByLearner[lid] ?? 0) + 1
    }
  }

  // Check-ins des 15 derniers jours par apprenant
  const { data: last15CheckinsRaw } = memberIds.length > 0
    ? await admin
        .from('checkins')
        .select('learner_id, created_at')
        .in('learner_id', memberIds)
        .gte('created_at', fifteenCutoffStr)
    : { data: [] as Array<{ learner_id: string; created_at: string }> }
  ;(last15CheckinsRaw ?? []).forEach(c => {
    last15CheckinsByLearner[c.learner_id] = (last15CheckinsByLearner[c.learner_id] ?? 0) + 1
  })

  // Quiz complétés des 15 derniers jours par apprenant (pour les membres du groupe)
  const { data: last15QuizRaw } = memberIds.length > 0
    ? await admin
        .from('quiz_attempts')
        .select('learner_id, completed_at')
        .in('learner_id', memberIds)
        .not('completed_at', 'is', null)
        .gte('completed_at', fifteenCutoffStr)
    : { data: [] as Array<{ learner_id: string; completed_at: string | null }> }
  ;(last15QuizRaw ?? []).forEach(q => {
    last15QuizByLearner[q.learner_id] = (last15QuizByLearner[q.learner_id] ?? 0) + 1
  })

  // News valorisantes (ticker du header)
  const newsList = await generateTeamNews({
    groupId,
    memberIds,
    members: members.map(m => ({ learner_id: m.learner_id, first_name: m.profiles.first_name })),
    currentUserId: user.id,
  })

  // ── Checkins pour la météo ──
  const { data: checkinsRaw } = memberIds.length > 0
    ? await admin
        .from('checkins')
        .select('learner_id, weather, created_at')
        .in('learner_id', memberIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ learner_id: string; weather: string; created_at: string }> }

  // Météo semaine passée (ISO : lundi précédent → dimanche)
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastMondayStr = lastMonday.toISOString()
  const thisMondayStrForWeather = thisMonday.toISOString()

  const lastWeekCheckins = (checkinsRaw ?? []).filter(
    (c) => c.created_at >= lastMondayStr && c.created_at < thisMondayStrForWeather
  )
  const weatherCounts = { sunny: 0, cloudy: 0, stormy: 0 }
  lastWeekCheckins.forEach((c) => {
    const w = c.weather as string
    if (w === 'sunny' || w === 'cloudy' || w === 'stormy') weatherCounts[w]++
  })
  const totalWithCheckin = weatherCounts.sunny + weatherCounts.cloudy + weatherCounts.stormy

  // ── Feedback pour les actions récentes ──
  const recentActionIds = recentActions.map((a) => a.id)

  const [{ data: likesData }, { data: commentsData }] = await Promise.all([
    recentActionIds.length > 0
      ? admin.from('action_likes')
          .select('action_id, trainer_id, profiles!inner(first_name, last_name)')
          .in('action_id', recentActionIds)
      : Promise.resolve({ data: [] as Array<{ action_id: string; trainer_id: string; profiles: { first_name: string; last_name: string } }> }),
    recentActionIds.length > 0
      ? admin.from('action_comments')
          .select('id, action_id, content, created_at, profiles!inner(first_name, last_name)')
          .in('action_id', recentActionIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; action_id: string; content: string; created_at: string; profiles: { first_name: string; last_name: string } }> }),
  ])

  const feedbackMap: Record<string, ActionFeedbackData> = {}
  recentActionIds.forEach((id) => {
    const likes = (likesData ?? []).filter((l) => l.action_id === id)
    const comments = (commentsData ?? []).filter((c) => c.action_id === id)
    feedbackMap[id] = {
      likes_count: likes.length,
      comments_count: comments.length,
      liked_by_me: likes.some((l) => l.trainer_id === user.id),
      likers: likes.map((l) => {
        const p = l.profiles as unknown as { first_name: string; last_name: string }
        return { first_name: p.first_name, last_name: p.last_name }
      }),
      comments: comments.map((c) => {
        const p = c.profiles as unknown as { first_name: string; last_name: string }
        return { id: c.id, content: c.content, created_at: c.created_at, trainer_first_name: p.first_name, trainer_last_name: p.last_name }
      }),
    }
  })

  // Check-in ouvert : vendredi (5), samedi (6), dimanche (0), lundi (1)
  const dayOfWeek = now.getDay()
  const isCheckinOpen = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0 || dayOfWeek === 1

  return (
    <TeamClient
      groupName={group.name}
      membersCount={members.length}
      totalActions={totalActions}
      recentActionsCount={recentActions.length}
      scoringData={memberIds.map((lid) => {
        const axesCounts = learnerAxesMap[lid] ?? []
        const total = axesCounts.reduce((a, b) => a + b, 0)
        return {
          id: lid,
          name: learnerNameMap[lid] ?? 'Inconnu',
          totalActions: total,
          last15Actions: last15ActionsByLearner[lid] ?? 0,
          last15Checkins: last15CheckinsByLearner[lid] ?? 0,
          last15Quizzes: last15QuizByLearner[lid] ?? 0,
          axesCounts,
        }
      })}
      recentActions={recentActions.map((a) => ({
        id: a.id,
        description: a.description,
        created_at: a.created_at,
        axe_subject: a.axe_subject,
        axe_action_count: a.axe_action_count,
        learner_first_name: a.learner_first_name,
        learner_last_name: a.learner_last_name,
      }))}
      feedbackMap={feedbackMap}
      news={newsList}
    />
  )
}
