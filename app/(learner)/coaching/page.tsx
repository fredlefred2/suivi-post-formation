import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CoachingClient from './CoachingClient'

export default async function CoachingPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <CoachingClient userId={user.id} />
}
