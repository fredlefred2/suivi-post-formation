export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import TrainerTipsManager from '@/app/components/TrainerTipsManager'

export default async function GroupDetailPage({ params }: { params: { id: string } }) {
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
        <Link href="/trainer/groups" className="text-sm text-indigo-600 hover:underline">
          ← Retour aux groupes
        </Link>
        <h1 className="page-title mt-2">{group.name}</h1>
        {group.theme && (
          <p className="text-sm text-gray-500 mt-1">📚 {group.theme}</p>
        )}
      </div>

      {/* Gestion des rappels & conseils */}
      <TrainerTipsManager groupId={params.id} groupTheme={group.theme || group.name} />
    </div>
  )
}
