export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import type { ActionFeedbackData } from '@/lib/types'
import AxesClient from './AxesClient'

export default async function AxesPage({
  searchParams,
}: {
  searchParams: { index?: string; onboarding?: string; highlight?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: axes } = await supabase
    .from('axes')
    .select('*, actions(*)')
    .eq('learner_id', user!.id)
    .order('created_at')

  // ── Fetch feedback (likes + commentaires) via admin client ────────────
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  type ActionRow = { id: string }
  const allActionIds = (axes ?? []).flatMap(
    (axe) => ((axe.actions ?? []) as ActionRow[]).map((a) => a.id)
  )

  const [{ data: likesData }, { data: commentsData }] = await Promise.all([
    allActionIds.length > 0
      ? admin.from('action_likes')
          .select('action_id, profiles!inner(first_name, last_name)')
          .in('action_id', allActionIds)
      : Promise.resolve({ data: [] as Array<{ action_id: string; profiles: { first_name: string; last_name: string } }> }),
    allActionIds.length > 0
      ? admin.from('action_comments')
          .select('id, action_id, content, created_at, profiles!inner(first_name, last_name)')
          .in('action_id', allActionIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; action_id: string; content: string; created_at: string; profiles: { first_name: string; last_name: string } }> }),
  ])

  const feedbackMap: Record<string, ActionFeedbackData> = {}
  allActionIds.forEach((id) => {
    const likes = (likesData ?? []).filter((l) => l.action_id === id)
    const comments = (commentsData ?? []).filter((c) => c.action_id === id)
    feedbackMap[id] = {
      likes_count: likes.length,
      comments_count: comments.length,
      liked_by_me: false, // L'apprenant ne like pas
      likers: likes.map((l) => {
        const p = l.profiles as unknown as { first_name: string; last_name: string }
        return { first_name: p.first_name, last_name: p.last_name }
      }),
      comments: comments.map((c) => {
        const p = c.profiles as unknown as { first_name: string; last_name: string }
        return { id: c.id, content: c.content, created_at: c.created_at, trainer_first_name: p.first_name, trainer_last_name: p.last_name }
      }),
    }
  })

  const initialIndex = searchParams.index !== undefined
    ? Math.max(0, parseInt(searchParams.index) || 0)
    : 0

  return <AxesClient key={initialIndex} axes={axes ?? []} initialIndex={initialIndex} feedbackMap={feedbackMap} onboarding={searchParams.onboarding} userId={user!.id} highlightAxeIdParam={searchParams.highlight} />
}
