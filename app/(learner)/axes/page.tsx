import { createClient } from '@/lib/supabase/server'
import AxesClient from './AxesClient'

export default async function AxesPage({
  searchParams,
}: {
  searchParams: { index?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: axes } = await supabase
    .from('axes')
    .select('*, actions(*)')
    .eq('learner_id', user!.id)
    .order('created_at')

  const initialIndex = searchParams.index !== undefined
    ? Math.max(0, parseInt(searchParams.index) || 0)
    : 0

  return <AxesClient key={initialIndex} axes={axes ?? []} initialIndex={initialIndex} />
}
