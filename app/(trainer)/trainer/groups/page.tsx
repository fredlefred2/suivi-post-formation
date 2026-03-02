export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import GroupsClient from './GroupsClient'

export default async function GroupsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Groupes du formateur avec count
  const { data: groups } = await supabase
    .from('groups')
    .select('*, group_members(count)')
    .eq('trainer_id', user!.id)
    .order('created_at', { ascending: false })

  const groupIds = groups?.map((g) => g.id) ?? []

  // Membres de tous les groupes
  const { data: membersRaw } = groupIds.length > 0
    ? await admin
        .from('group_members')
        .select('group_id, learner_id')
        .in('group_id', groupIds)
    : { data: [] as Array<{ group_id: string; learner_id: string }> }

  const learnerIds = Array.from(new Set(membersRaw?.map((m) => m.learner_id) ?? []))

  // Profils des apprenants
  const { data: profiles } = learnerIds.length > 0
    ? await admin.from('profiles').select('id, first_name, last_name').in('id', learnerIds)
    : { data: [] as Array<{ id: string; first_name: string; last_name: string }> }

  const profileMap: Record<string, { first_name: string; last_name: string }> = {}
  profiles?.forEach((p) => { profileMap[p.id] = { first_name: p.first_name, last_name: p.last_name } })

  // Structure enrichie : membres par groupe
  const membersMap: Record<string, Array<{ learner_id: string; first_name: string; last_name: string }>> = {}
  ;(membersRaw ?? []).forEach((m) => {
    if (!membersMap[m.group_id]) membersMap[m.group_id] = []
    membersMap[m.group_id].push({
      learner_id: m.learner_id,
      first_name: profileMap[m.learner_id]?.first_name ?? '',
      last_name: profileMap[m.learner_id]?.last_name ?? '',
    })
  })

  return (
    <div className="space-y-6 pb-4">
      <h1 className="page-title">Gestion des groupes</h1>
      <GroupsClient groups={groups ?? []} membersMap={membersMap} />
    </div>
  )
}
