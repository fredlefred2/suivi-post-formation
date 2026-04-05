export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import TrainerMessagesClient from './TrainerMessagesClient'

export default async function TrainerMessagesPage({ searchParams }: { searchParams: { with?: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Si un interlocuteur est précisé, chercher son nom
  let initialContact: { userId: string; name: string } | null = null
  if (searchParams.with) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', searchParams.with)
      .single()
    if (profile) {
      initialContact = {
        userId: searchParams.with,
        name: `${profile.first_name} ${profile.last_name}`,
      }
    }
  }

  // Fetch all learners belonging to the trainer's groups
  const { data: groupsRaw } = await admin
    .from('groups')
    .select('id, group_members(learner_id, profiles!inner(id, first_name, last_name))')
    .eq('trainer_id', user.id)

  type MemberRow = { learner_id: string; profiles: { id: string; first_name: string; last_name: string } }

  const allLearners: { id: string; name: string }[] = []
  const seen = new Set<string>()
  for (const g of groupsRaw ?? []) {
    for (const m of (g.group_members ?? []) as unknown as MemberRow[]) {
      if (!seen.has(m.learner_id)) {
        seen.add(m.learner_id)
        allLearners.push({ id: m.learner_id, name: `${m.profiles.first_name} ${m.profiles.last_name}` })
      }
    }
  }
  allLearners.sort((a, b) => a.name.localeCompare(b.name))

  return <TrainerMessagesClient currentUserId={user.id} initialContact={initialContact} allLearners={allLearners} />
}
