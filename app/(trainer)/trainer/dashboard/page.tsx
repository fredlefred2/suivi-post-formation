export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import TrainerGroupsListClient from './TrainerGroupsListClient'

export type GroupListItem = {
  id: string
  name: string
  theme: string | null
  memberCount: number
  members: Array<{ learner_id: string; first_name: string; last_name: string }>
}

export default async function TrainerDashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // ── 1. Groupes du formateur ─────────────────────────────────────
  const { data: groupsRaw } = await supabase
    .from('groups')
    .select('id, name, theme')
    .eq('trainer_id', user!.id)
    .order('created_at', { ascending: false })

  const groupIds = groupsRaw?.map((g) => g.id) ?? []

  // ── 2. Membres par groupe ───────────────────────────────────────
  const { data: membersRaw } = groupIds.length > 0
    ? await admin
        .from('group_members')
        .select('group_id, learner_id')
        .in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string; learner_id: string }> }

  const allLearnerIds = Array.from(new Set(membersRaw?.map((m) => m.learner_id) ?? []))

  // ── 3. Profils ──────────────────────────────────────────────────
  const { data: profiles } = allLearnerIds.length > 0
    ? await admin.from('profiles').select('id, first_name, last_name').in('id', allLearnerIds)
    : { data: [] as Array<{ id: string; first_name: string; last_name: string }> }

  const profileMap: Record<string, { first_name: string; last_name: string }> = {}
  profiles?.forEach((p) => { profileMap[p.id] = { first_name: p.first_name, last_name: p.last_name } })

  // ── 4. Construction des groupes ─────────────────────────────────
  const groups: GroupListItem[] = (groupsRaw ?? []).map((g) => {
    const gMembers = (membersRaw ?? [])
      .filter((m) => m.group_id === g.id)
      .map((m) => ({
        learner_id: m.learner_id,
        first_name: profileMap[m.learner_id]?.first_name ?? '',
        last_name: profileMap[m.learner_id]?.last_name ?? '',
      }))
      .sort((a, b) => a.last_name.localeCompare(b.last_name, 'fr'))

    return {
      id: g.id,
      name: g.name,
      theme: g.theme,
      memberCount: gMembers.length,
      members: gMembers,
    }
  })

  // ── 5. Apprenants non affectés (salle d'attente) ────────────────
  // On ne prend que les apprenants déjà membres d'un groupe de CE formateur
  // qui auraient été retirés, ou les apprenants non affectés à aucun groupe
  const assignedToThisTrainer = new Set(allLearnerIds)

  const { data: allGroupMembers } = await admin
    .from('group_members')
    .select('learner_id')

  const allAssignedIds = new Set(allGroupMembers?.map((m) => m.learner_id) ?? [])

  // Apprenants inscrits mais dans aucun groupe
  const { data: allLearnerProfiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'learner')
    .order('last_name')

  const unassignedLearners = (allLearnerProfiles ?? [])
    .filter((p) => !allAssignedIds.has(p.id))
    // Exclure les profils sans nom (comptes fantômes/incomplets)
    .filter((p) => p.first_name && p.last_name)

  return (
    <TrainerGroupsListClient
      groups={groups}
      unassignedLearners={unassignedLearners}
    />
  )
}
