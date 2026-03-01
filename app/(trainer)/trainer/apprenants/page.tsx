export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import ApprenantsClient from './ApprenantsClient'

export default async function ApprenantsPage({
  searchParams,
}: {
  searchParams: { group?: string }
}) {
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

  // ── Bornes de la semaine courante (lundi → dimanche) ─────────────────────
  const now = new Date()
  const dayOfWeek = now.getDay() // 0=dim, 1=lun…
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  // ── Stats par apprenant : axes + actions ──────────────────────────────────
  const assignedLearnerIds = Array.from(new Set(members?.map((m) => m.learner_id) ?? []))

  const [{ data: axesData }, { data: actionsData }] = await Promise.all([
    assignedLearnerIds.length > 0
      ? admin.from('axes').select('learner_id').in('learner_id', assignedLearnerIds)
      : Promise.resolve({ data: [] as Array<{ learner_id: string }> }),
    assignedLearnerIds.length > 0
      ? admin.from('actions').select('learner_id, created_at').in('learner_id', assignedLearnerIds)
      : Promise.resolve({ data: [] as Array<{ learner_id: string; created_at: string }> }),
  ])

  const statsMap: Record<string, { axesCount: number; actionsTotal: number; actionsThisWeek: number }> = {}
  assignedLearnerIds.forEach((id) => {
    const learnerAxes = (axesData ?? []).filter((a) => a.learner_id === id)
    const learnerActions = (actionsData ?? []).filter((a) => a.learner_id === id)
    const thisWeek = learnerActions.filter((a) => {
      const d = new Date(a.created_at)
      return d >= monday && d <= sunday
    })
    statsMap[id] = {
      axesCount: learnerAxes.length,
      actionsTotal: learnerActions.length,
      actionsThisWeek: thisWeek.length,
    }
  })

  // Construire la liste enrichie
  const learnersWithGroup = (learners ?? []).map((l) => {
    const membership = members?.find((m) => m.learner_id === l.id)
    const group = membership ? groups?.find((g) => g.id === membership.group_id) : null
    return {
      ...l,
      groupId: group?.id ?? null,
      groupName: group?.name ?? null,
      stats: statsMap[l.id] ?? null,
    }
  })

  return (
    <ApprenantsClient
      learners={learnersWithGroup}
      groups={groups ?? []}
      initialGroup={searchParams.group ?? 'all'}
    />
  )
}
