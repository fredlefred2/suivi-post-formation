export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ApprenantsPage({
  searchParams,
}: {
  searchParams: { group?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Groupes de ce formateur
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('trainer_id', user!.id)
    .order('name')

  if (!groups || groups.length === 0) {
    redirect('/trainer/groups')
  }

  const groupIds = groups.map((g) => g.id)

  // Tous les membres de tous les groupes du formateur
  const { data: allMembers } = await supabase
    .from('group_members')
    .select('learner_id, group_id, profiles!inner(first_name, last_name)')
    .in('group_id', groupIds)

  if (!allMembers || allMembers.length === 0) {
    redirect('/trainer/groups')
  }

  // Déterminer le groupe cible
  let targetGroupId = searchParams.group
  if (!targetGroupId || targetGroupId === 'all' || targetGroupId === 'unassigned' || !groupIds.includes(targetGroupId)) {
    targetGroupId = ''
  }

  // Chercher les membres du groupe cible
  let groupMembers = targetGroupId
    ? allMembers.filter((m) => m.group_id === targetGroupId)
    : []

  // Si pas de membres dans le groupe cible, trouver le premier groupe avec des membres
  if (groupMembers.length === 0) {
    for (const g of groups) {
      const gm = allMembers.filter((m) => m.group_id === g.id)
      if (gm.length > 0) {
        groupMembers = gm
        targetGroupId = g.id
        break
      }
    }
  }

  if (groupMembers.length === 0 || !targetGroupId) {
    redirect('/trainer/groups')
  }

  // Trier alphabétiquement et rediriger vers le premier apprenant
  const sorted = groupMembers.sort((a, b) => {
    const pa = a.profiles as unknown as { first_name: string; last_name: string }
    const pb = b.profiles as unknown as { first_name: string; last_name: string }
    return `${pa.first_name} ${pa.last_name}`.localeCompare(`${pb.first_name} ${pb.last_name}`, 'fr')
  })

  redirect(`/trainer/learner/${sorted[0].learner_id}?from=apprenants&group=${targetGroupId}`)
}
