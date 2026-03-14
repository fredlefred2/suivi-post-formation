import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/team-messages?groupId=<id>         → messages des 7 derniers jours
// GET /api/team-messages?groupId=<id>&all=true → tout l'historique (200 max)
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const groupId = req.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId requis' }, { status: 400 })

  const all = req.nextUrl.searchParams.get('all') === 'true'

  let query = supabase
    .from('team_messages')
    .select('id, group_id, sender_id, content, created_at, profiles!inner(first_name, last_name)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (all) {
    query = query.limit(200)
  } else {
    // 7 derniers jours seulement
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    query = query.gte('created_at', sevenDaysAgo.toISOString()).limit(30)
  }

  const { data: messages, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Renverser pour avoir du plus ancien au plus récent
  const sorted = (messages ?? []).reverse().map((m) => {
    const p = m.profiles as unknown as { first_name: string; last_name: string }
    return {
      id: m.id,
      senderId: m.sender_id,
      senderFirstName: p.first_name,
      senderLastName: p.last_name,
      content: m.content,
      createdAt: m.created_at,
    }
  })

  return NextResponse.json({ messages: sorted })
}

// POST /api/team-messages { groupId, content }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  // Only trainers can post team messages
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'trainer') {
    return NextResponse.json({ error: 'Seul le formateur peut envoyer des messages team' }, { status: 403 })
  }

  const body = await req.json()
  const { groupId, content } = body as { groupId?: string; content?: string }

  if (!groupId || !content?.trim()) {
    return NextResponse.json({ error: 'groupId et content requis' }, { status: 400 })
  }

  if (content.length > 500) {
    return NextResponse.json({ error: 'Message trop long (max 500 caractères)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('team_messages')
    .insert({ group_id: groupId, sender_id: user.id, content: content.trim() })
    .select('id, group_id, sender_id, content, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}
