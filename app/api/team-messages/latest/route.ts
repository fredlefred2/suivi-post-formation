import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

// GET /api/team-messages/latest
// Returns the latest team message from the trainer for the learner's group
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Find the learner's group and its trainer
  const { data: membership } = await admin
    .from('group_members')
    .select('group_id, groups!inner(trainer_id)')
    .eq('learner_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ message: null })
  }

  const groupId = membership.group_id
  const trainerId = (membership.groups as unknown as { trainer_id: string }).trainer_id

  // Get the latest team message from the trainer for this group
  const { data: msg } = await admin
    .from('team_messages')
    .select('id, content, created_at, profiles!inner(first_name)')
    .eq('group_id', groupId)
    .eq('sender_id', trainerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!msg) {
    return NextResponse.json({ message: null })
  }

  const p = msg.profiles as unknown as { first_name: string }

  return NextResponse.json({
    message: {
      id: msg.id,
      content: msg.content,
      senderFirstName: p.first_name,
      createdAt: msg.created_at,
    },
  })
}
