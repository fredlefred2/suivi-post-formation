export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCheckinContext } from '@/lib/utils'
import GroupDetailClient from './GroupDetailClient'

export type GroupMember = {
  learner_id: string
  first_name: string
  last_name: string
  totalActions: number
  actionsThisWeek: number
  lastWeather: string | null
  axeActionCounts: number[]  // nombre d'actions par axe, pour les badges niveaux
}

export type GroupAction = {
  id: string
  description: string
  created_at: string
  learner_id: string
  learner_first_name: string
  learner_last_name: string
  axe_subject: string
  axe_action_count: number
  likes_count: number
  comments_count: number
}

export default async function GroupDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── 1. Groupe ──────────────────────────────────────────────────
  const { data: group } = await supabase
    .from('groups')
    .select('id, name, theme')
    .eq('id', params.id)
    .eq('trainer_id', user!.id)
    .single()

  if (!group) notFound()

  const checkinCtx = getCheckinContext()

  // ── 2. Membres du groupe ────────────────────────────────────────
  const { data: membersRaw } = await admin
    .from('group_members')
    .select('learner_id')
    .eq('group_id', params.id)

  const learnerIds = membersRaw?.map((m) => m.learner_id) ?? []

  if (learnerIds.length === 0) {
    return (
      <GroupDetailClient
        group={group}
        members={[]}
        recentActions={[]}
        pendingCheckins={[]}
        avgWeather={null}
        actionsThisWeek={0}
        currentUserId={user!.id}
      />
    )
  }

  // ── 3. Profils ──────────────────────────────────────────────────
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', learnerIds)

  const profileMap: Record<string, { first_name: string; last_name: string }> = {}
  profiles?.forEach((p) => { profileMap[p.id] = { first_name: p.first_name, last_name: p.last_name } })

  // ── 4. Check-ins ────────────────────────────────────────────────
  const { data: checkinsRaw } = await admin
    .from('checkins')
    .select('learner_id, weather, week_number, year')
    .in('learner_id', learnerIds)
    .order('created_at', { ascending: false })

  // Dernier weather par apprenant
  const lastWeatherMap: Record<string, string> = {}
  ;(checkinsRaw ?? []).forEach((c) => {
    if (!lastWeatherMap[c.learner_id]) lastWeatherMap[c.learner_id] = c.weather
  })

  // Qui a fait le check-in cette semaine ?
  const checkedInThisWeek = new Set(
    (checkinsRaw ?? [])
      .filter((c) => c.week_number === checkinCtx.checkinWeek && c.year === checkinCtx.checkinYear)
      .map((c) => c.learner_id)
  )

  const pendingCheckins = learnerIds
    .filter((id) => !checkedInThisWeek.has(id))
    .map((id) => profileMap[id]?.first_name ?? '?')

  // Météo moyenne
  const weathers = Object.values(lastWeatherMap)
  let avgWeather: string | null = null
  if (weathers.length > 0) {
    const scores = weathers.map((w) => w === 'sunny' ? 5 : w === 'cloudy' ? 3 : 1)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    avgWeather = avg >= 4 ? 'sunny' : avg >= 2 ? 'cloudy' : 'stormy'
  }

  // ── 5. Actions + axes ───────────────────────────────────────────
  const { data: actionsRaw } = await admin
    .from('actions')
    .select('id, description, created_at, learner_id, axe_id, axes(subject, actions(id))')
    .in('learner_id', learnerIds)
    .order('created_at', { ascending: false })

  const allActionIds = (actionsRaw ?? []).map((a) => a.id)

  // Feedback counts
  const [{ data: likesRaw }, { data: commentsRaw }] = await Promise.all([
    allActionIds.length > 0
      ? admin.from('action_likes').select('action_id').in('action_id', allActionIds)
      : Promise.resolve({ data: [] as Array<{ action_id: string }> }),
    allActionIds.length > 0
      ? admin.from('action_comments').select('action_id').in('action_id', allActionIds)
      : Promise.resolve({ data: [] as Array<{ action_id: string }> }),
  ])

  const likesCount: Record<string, number> = {}
  ;(likesRaw ?? []).forEach((l) => { likesCount[l.action_id] = (likesCount[l.action_id] ?? 0) + 1 })
  const commentsCount: Record<string, number> = {}
  ;(commentsRaw ?? []).forEach((c) => { commentsCount[c.action_id] = (commentsCount[c.action_id] ?? 0) + 1 })

  // Actions récentes (20 dernières)
  const recentActions: GroupAction[] = (actionsRaw ?? []).slice(0, 20).map((a) => {
    const axeData = a.axes as unknown as { subject: string; actions: { id: string }[] } | null
    return {
      id: a.id,
      description: a.description,
      created_at: a.created_at,
      learner_id: a.learner_id,
      learner_first_name: profileMap[a.learner_id]?.first_name ?? '',
      learner_last_name: profileMap[a.learner_id]?.last_name ?? '',
      axe_subject: axeData?.subject ?? 'Axe inconnu',
      axe_action_count: axeData?.actions?.length ?? 0,
      likes_count: likesCount[a.id] ?? 0,
      comments_count: commentsCount[a.id] ?? 0,
    }
  })

  // Actions cette semaine
  const now = new Date()
  const dayOfWeek = now.getDay() || 7
  const mondayThisWeek = new Date(now)
  mondayThisWeek.setDate(now.getDate() - dayOfWeek + 1)
  mondayThisWeek.setHours(0, 0, 0, 0)
  const actionsThisWeek = (actionsRaw ?? []).filter((a) => new Date(a.created_at) >= mondayThisWeek).length

  // ── 6. Axes par apprenant (pour scoring/niveaux) ────────────────
  const { data: axesRaw } = await admin
    .from('axes')
    .select('id, learner_id, actions(id)')
    .in('learner_id', learnerIds)
    .order('created_at')

  const axeActionCountsByLearner: Record<string, number[]> = {}
  ;(axesRaw ?? []).forEach((axe) => {
    if (!axeActionCountsByLearner[axe.learner_id]) axeActionCountsByLearner[axe.learner_id] = []
    axeActionCountsByLearner[axe.learner_id].push((axe.actions as { id: string }[])?.length ?? 0)
  })

  // Actions totales et cette semaine par apprenant
  const actionsByLearner: Record<string, { total: number; thisWeek: number }> = {}
  ;(actionsRaw ?? []).forEach((a) => {
    if (!actionsByLearner[a.learner_id]) actionsByLearner[a.learner_id] = { total: 0, thisWeek: 0 }
    actionsByLearner[a.learner_id].total++
    if (new Date(a.created_at) >= mondayThisWeek) actionsByLearner[a.learner_id].thisWeek++
  })

  // ── 7. Construire les membres ───────────────────────────────────
  const members: GroupMember[] = learnerIds.map((id) => ({
    learner_id: id,
    first_name: profileMap[id]?.first_name ?? '',
    last_name: profileMap[id]?.last_name ?? '',
    totalActions: actionsByLearner[id]?.total ?? 0,
    actionsThisWeek: actionsByLearner[id]?.thisWeek ?? 0,
    lastWeather: lastWeatherMap[id] ?? null,
    axeActionCounts: axeActionCountsByLearner[id] ?? [],
  }))

  // Trier par total actions desc
  members.sort((a, b) => b.totalActions - a.totalActions)

  return (
    <GroupDetailClient
      group={group}
      members={members}
      recentActions={recentActions}
      pendingCheckins={pendingCheckins}
      avgWeather={avgWeather}
      actionsThisWeek={actionsThisWeek}
      currentUserId={user!.id}
    />
  )
}
