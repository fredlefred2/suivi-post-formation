export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import TrainerGroupsListClient from './TrainerGroupsListClient'

export type GroupListItem = {
  id: string
  name: string
  theme: string | null
  memberCount: number
  avgWeather: 'sunny' | 'cloudy' | 'stormy' | null
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

  const memberCountMap: Record<string, number> = {}
  const learnersByGroup: Record<string, string[]> = {}
  ;(membersRaw ?? []).forEach((m) => {
    memberCountMap[m.group_id] = (memberCountMap[m.group_id] ?? 0) + 1
    if (!learnersByGroup[m.group_id]) learnersByGroup[m.group_id] = []
    learnersByGroup[m.group_id].push(m.learner_id)
  })

  const allLearnerIds = Array.from(new Set(membersRaw?.map((m) => m.learner_id) ?? []))

  // ── 3. Derniers check-ins pour météo moyenne ────────────────────
  // On prend le dernier check-in de chaque apprenant
  const { data: checkinsRaw } = allLearnerIds.length > 0
    ? await admin
        .from('checkins')
        .select('learner_id, weather')
        .in('learner_id', allLearnerIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ learner_id: string; weather: string }> }

  // Dernier check-in par apprenant
  const lastWeatherMap: Record<string, string> = {}
  ;(checkinsRaw ?? []).forEach((c) => {
    if (!lastWeatherMap[c.learner_id]) lastWeatherMap[c.learner_id] = c.weather
  })

  // Calcul météo moyenne par groupe
  function avgWeather(groupId: string): 'sunny' | 'cloudy' | 'stormy' | null {
    const members = learnersByGroup[groupId] ?? []
    const weathers = members.map((id) => lastWeatherMap[id]).filter(Boolean)
    if (weathers.length === 0) return null
    const scores = weathers.map((w) => w === 'sunny' ? 5 : w === 'cloudy' ? 3 : 1)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    if (avg >= 4) return 'sunny'
    if (avg >= 2) return 'cloudy'
    return 'stormy'
  }

  const groups: GroupListItem[] = (groupsRaw ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    theme: g.theme,
    memberCount: memberCountMap[g.id] ?? 0,
    avgWeather: avgWeather(g.id),
  }))

  // ── 4. Apprenants non affectés (salle d'attente) ────────────────
  const { data: allGroupMembers } = await admin
    .from('group_members')
    .select('learner_id')

  const allAssignedIds = new Set(allGroupMembers?.map((m) => m.learner_id) ?? [])

  const { data: allLearnerProfiles } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'learner')
    .order('last_name')

  const unassignedLearners = (allLearnerProfiles ?? [])
    .filter((p) => !allAssignedIds.has(p.id))

  return (
    <TrainerGroupsListClient
      groups={groups}
      unassignedLearners={unassignedLearners}
    />
  )
}
