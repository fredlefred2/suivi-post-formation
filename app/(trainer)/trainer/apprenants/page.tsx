import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ApprenantsClient from './ApprenantsClient'

export default async function ApprenantsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Tous les apprenants (via admin pour contourner le RLS)
  const { data: learners } = await admin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('role', 'learner')
    .order('last_name')

  // Groupes de ce formateur
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('trainer_id', user!.id)
    .order('name')

  // Membres actuels des groupes du formateur
  const groupIds = groups?.map((g) => g.id) ?? []
  const { data: members } = groupIds.length > 0
    ? await supabase
        .from('group_members')
        .select('learner_id, group_id')
        .in('group_id', groupIds)
    : { data: [] }

  // Construire la liste enrichie
  const learnersWithGroup = (learners ?? []).map((l) => {
    const membership = members?.find((m) => m.learner_id === l.id)
    const group = membership ? groups?.find((g) => g.id === membership.group_id) : null
    return {
      ...l,
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
    }
  })

  return (
    <ApprenantsClient
      learners={learnersWithGroup}
      groups={groups ?? []}
    />
  )
}
