import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCurrentWeek } from '@/lib/utils'
import TrainerDashboardClient from './TrainerDashboardClient'
import type { GroupData, CheckinData, ActionData, UnassignedLearner } from './TrainerDashboardClient'

export default async function TrainerDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { week, year } = getCurrentWeek()

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
        <h1 className="page-title">Tableau de bord formateur</h1>
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

  const learnerIds = [...new Set(membersRaw?.map((m) => m.learner_id) ?? [])]

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

  // ── 5. Actions récentes avec axes ─────────────────────────────────────────
  const { data: actionsRaw } = learnerIds.length > 0
    ? await admin
        .from('actions')
        .select('id, description, created_at, learner_id, axes(subject)')
        .in('learner_id', learnerIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; description: string; created_at: string; learner_id: string; axes: { subject: string } | null }> }

  const actions: ActionData[] = (actionsRaw ?? []).map((a) => ({
    id: a.id,
    description: a.description,
    created_at: a.created_at,
    learner_id: a.learner_id,
    learner_name: profileMap[a.learner_id]
      ? `${profileMap[a.learner_id].first_name} ${profileMap[a.learner_id].last_name}`
      : 'Inconnu',
    axe_subject: (a.axes as { subject: string } | null)?.subject ?? 'Axe inconnu',
  }))

  // ── 6. Apprenants non affectés à aucun groupe ─────────────────────────────
  // Tous les learner_id présents dans group_members (tous formateurs confondus)
  const { data: allGroupMembers } = await admin
    .from('group_members')
    .select('learner_id')

  const allAssignedIds = new Set(allGroupMembers?.map((m) => m.learner_id) ?? [])

  // Tous les profils avec role = learner
  const { data: allLearnerProfiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'learner')
    .order('last_name')

  const unassignedLearners: UnassignedLearner[] = (allLearnerProfiles ?? [])
    .filter((p) => !allAssignedIds.has(p.id))

  return (
    <div className="space-y-6 pb-4">
      <h1 className="page-title">Tableau de bord formateur</h1>
      <TrainerDashboardClient
        groups={groups}
        checkins={checkins}
        actions={actions}
        currentWeek={week}
        currentYear={year}
        unassignedLearners={unassignedLearners}
      />
    </div>
  )
}
