import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CoachingClient from './CoachingClient'

export default async function CoachingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name')
    .eq('id', user.id)
    .single()

  return <CoachingClient userId={user.id} firstName={profile?.first_name || ''} />
}
