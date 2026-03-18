export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCheckinContext } from '@/lib/utils'
import TrainerDashboardClient from './TrainerDashboardClient'
import type { GroupData, CheckinData, ActionData, UnassignedLearner } from './TrainerDashboardClient'

export default async function TrainerDashboardPage({
  searchParams,
}: {
  searchParams: { group?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const checkinCtx = getCheckinContext()
  const week = checkinCtx.checkinWeek
  const year = checkinCtx.checkinYear

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── 1. Groupes du formateur ───────────────────────────────────────────────
  const { data: groupsRaw } = await supabase
    .from('groups')
    .select('id, name')
    .eq('trainer_id', user!.id)
    .order('created_at', { ascending: false })

  const groupIds = groupsRaw?.map((g) => g.id) ?? []

  if (groupIds.length === 0) {
    return (
      <div className="space-y-6 pb-4">
        <div className="card text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">👥</p>
          <p>Vous n&apos;avez pas encore créé de groupe.</p>
        </div>
      </div>
    )
  }

  // ── 2. Membres de chaque groupe ───────────────────────────────────────────
  const { data: membersRaw } = await admin
    .from('group_members')
    .select('group_id, learner_id')
    .in('group_id', groupIds)

  const learnerIds = Array.from(new Set(membersRaw?.map((m) => m.learner_id) ?? []))

  // ── 3. Profils des apprenants (membres des groupes) ───────────────────────
  const { data: profiles } = learnerIds.length > 0
    ? await admin.from('profiles').select('id, first_name, last_name').in('id', learnerIds)
    : { data: [] as Array<{ id: string; first_name: string; last_name: string }> }

  const profileMap: Record<string, { first_name: string; last_name: string }> = {}
  profiles?.forEach((p) => { profileMap[p.id] = { first_name: p.first_name, last_name: p.last_name } })

  // Structure groupée
  const groups: GroupData[] = (groupsRaw ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    members: (membersRaw ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        learner_id: m.learner_id,
        first_name: profileMap[m.learner_id]?.first_name ?? '',
        last_name: profileMap[m.learner_id]?.last_name ?? '',
      })),
  }))

  // ── 4. Tous les check-ins ─────────────────────────────────────────────────
  const { data: checkinsRaw } = learnerIds.length > 0
    ? await admin
        .from('checkins')
        .select('learner_id, weather, week_number, year, created_at')
        .in('learner_id', learnerIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ learner_id: string; weather: string; week_number: number; year: number; created_at: string }> }

  const checkins: CheckinData[] = (checkinsRaw ?? []).map((c) => ({
    learner_id: c.learner_id,
    weather: c.weather,
    week_number: c.week_number,
    year: c.year,
    created_at: c.created_at,
  }))

  // ── 5. Actions avec axes ──────────────────────────────────────────────────
  const { data: actionsRaw } = learnerIds.length > 0
    ? await admin
        .from('actions')
        .select('id, description, created_at, learner_id, axe_id, axes(subject, actions(id))')
        .in('learner_id', learnerIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; description: string; created_at: string; learner_id: string; axe_id: string; axes: { subject: string; actions: { id: string }[] } | null }> }

  const allActionIds = (actionsRaw ?? []).map((a) => a.id)

  // Fetch feedback (likes + commentaires) pour TOUTES les actions
  const [{ data: likesDetailed }, { data: commentsDetailed }] = await Promise.all([
    allActionIds.length > 0
      ? admin.from('action_likes')
          .select('action_id, trainer_id, profiles!inner(first_name, last_name)')
          .in('action_id', allActionIds)
      : Promise.resolve({ data: [] as Array<{ action_id: string; trainer_id: string; profiles: { first_name: string; last_name: string } }> }),
    allActionIds.length > 0
      ? admin.from('action_comments')
          .select('id, action_id, trainer_id, content, created_at, profiles!inner(first_name, last_name)')
          .in('action_id', allActionIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; action_id: string; trainer_id: string; content: string; created_at: string; profiles: { first_name: string; last_name: string } }> }),
  ])

  const trainerId = user!.id

  type FeedbackEntry = { likes_count: number; comments_count: number; liked_by_me: boolean; likers: Array<{ first_name: string; last_name: string }>; comments: Array<{ id: string; content: string; created_at: string; trainer_first_name: string; trainer_last_name: string }> }
  const feedbackMap: Record<string, FeedbackEntry> = {}
  allActionIds.forEach((id) => {
    const likes = (likesDetailed ?? []).filter((l) => l.action_id === id)
    const comments = (commentsDetailed ?? []).filter((c) => c.action_id === id)
    feedbackMap[id] = {
      likes_count: likes.length,
      comments_count: comments.length,
      liked_by_me: likes.some((l) => l.trainer_id === trainerId),
      likers: likes.map((l) => {
        const p = l.profiles as unknown as { first_name: string; last_name: string }
        return { first_name: p.first_name, last_name: p.last_name }
      }),
      comments: comments.map((c) => {
        const p = c.profiles as unknown as { first_name: string; last_name: string }
        return {
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          trainer_first_name: p.first_name,
          trainer_last_name: p.last_name,
        }
      }),
    }
  })

  const emptyFeedback: FeedbackEntry = { likes_count: 0, comments_count: 0, liked_by_me: false, likers: [], comments: [] }

  const actions: ActionData[] = (actionsRaw ?? []).map((a) => {
    const axeData = a.axes as unknown as { subject: string; actions: { id: string }[] } | null
    return {
      id: a.id,
      description: a.description,
      created_at: a.created_at,
      learner_id: a.learner_id,
      learner_name: profileMap[a.learner_id]
        ? `${profileMap[a.learner_id].first_name} ${profileMap[a.learner_id].last_name}`
        : 'Inconnu',
      learner_first_name: profileMap[a.learner_id]?.first_name ?? '',
      learner_last_name: profileMap[a.learner_id]?.last_name ?? '',
      axe_subject: axeData?.subject ?? 'Axe inconnu',
      axe_action_count: axeData?.actions?.length ?? 0,
      feedback: feedbackMap[a.id] ?? emptyFeedback,
    }
  })

  // ── 6. Axes par apprenant (pour le scoring) ──────────────────────────────
  const { data: axesRaw } = learnerIds.length > 0
    ? await admin
        .from('axes')
        .select('id, learner_id, actions(id)')
        .in('learner_id', learnerIds)
        .order('created_at')
    : { data: [] as Array<{ id: string; learner_id: string; actions: { id: string }[] }> }

  const learnerAxesMap: Record<string, number[]> = {}
  ;(axesRaw ?? []).forEach((axe) => {
    if (!learnerAxesMap[axe.learner_id]) learnerAxesMap[axe.learner_id] = []
    learnerAxesMap[axe.learner_id].push((axe.actions as { id: string }[])?.length ?? 0)
  })

  // ── 7. Apprenants non affectés ─────────────────────────────────────────
  const { data: allGroupMembers } = await admin
    .from('group_members')
    .select('learner_id')

  const allAssignedIds = new Set(allGroupMembers?.map((m) => m.learner_id) ?? [])

  const { data: allLearnerProfiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'learner')
    .order('last_name')

  const unassignedLearners: UnassignedLearner[] = (allLearnerProfiles ?? [])
    .filter((p) => !allAssignedIds.has(p.id))

  return (
    <TrainerDashboardClient
      groups={groups}
      checkins={checkins}
      actions={actions}
      currentWeek={week}
      currentYear={year}
      isCheckinOpen={checkinCtx.isOpen}
      unassignedLearners={unassignedLearners}
      learnerAxesMap={learnerAxesMap}
      initialGroup={searchParams.group}
      currentUserId={user!.id}
    />
  )
}
