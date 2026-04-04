export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrainerTipsManager from '@/app/components/TrainerTipsManager'

export default async function GroupDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { learner?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: group } = await supabase
    .from('groups')
    .select('*')
    .eq('id', params.id)
    .eq('trainer_id', user!.id)
    .single()

  if (!group) notFound()

  return (
    <div className="space-y-6 pb-4">
      <div>
        <Link href="/trainer/groups" className="text-sm hover:underline" style={{ color: '#1a1a2e' }}>
          ← Retour aux groupes
        </Link>
        <h1 className="page-title mt-2">{group.name}</h1>
      </div>

      {/* Gestion des rappels & conseils */}
      <TrainerTipsManager
        groupId={params.id}
        groupTheme={group.theme || group.name}
        initialLearnerId={searchParams.learner}
      />
    </div>
  )
}
