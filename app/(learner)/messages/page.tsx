export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import MessagesClient from './MessagesClient'

export default async function MessagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Trouver le formateur de l'apprenant via son groupe
  const { data: membership } = await admin
    .from('group_members')
    .select('group_id, groups!inner(trainer_id)')
    .eq('learner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Messages</h1>
        <div className="card text-center py-8">
          <p className="text-gray-500">Vous n&apos;appartenez pas encore à un groupe.</p>
        </div>
      </div>
    )
  }

  const trainerId = (membership.groups as unknown as { trainer_id: string }).trainer_id

  // Récupérer le nom du formateur
  const { data: trainerProfile } = await admin
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', trainerId)
    .single()

  const trainerName = trainerProfile
    ? `${trainerProfile.first_name} ${trainerProfile.last_name}`
    : 'Formateur'

  return (
    <MessagesClient
      currentUserId={user.id}
      trainerId={trainerId}
      trainerName={trainerName}
    />
  )
}
