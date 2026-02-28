import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import GroupsClient from './GroupsClient'

export default async function GroupsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: groups } = await supabase
    .from('groups')
    .select('*, group_members(count)')
    .eq('trainer_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6 pb-4">
      <h1 className="page-title">Gestion des groupes</h1>
      <GroupsClient groups={groups ?? []} />
    </div>
  )
}
