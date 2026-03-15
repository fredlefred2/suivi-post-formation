import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/messages?with=<userId>  → messages d'une conversation
// GET /api/messages                → liste des conversations
export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const withUser = req.nextUrl.searchParams.get('with')

  if (withUser) {
    // Messages d'une conversation spécifique
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, is_read, created_at')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${withUser}),and(sender_id.eq.${withUser},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: messages ?? [] })
  }

  // Liste des conversations (dernier message + unread count par interlocuteur)
  const { data: allMessages, error } = await supabase
    .from('messages')
    .select('id, sender_id, receiver_id, content, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Grouper par interlocuteur
  const convMap = new Map<string, { lastMessage: typeof allMessages[0]; unreadCount: number }>()
  for (const msg of allMessages ?? []) {
    const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
    if (!convMap.has(otherId)) {
      convMap.set(otherId, { lastMessage: msg, unreadCount: 0 })
    }
    if (!msg.is_read && msg.receiver_id === user.id) {
      convMap.get(otherId)!.unreadCount++
    }
  }

  // Récupérer les noms des interlocuteurs
  const otherIds = Array.from(convMap.keys())
  let profiles: Array<{ id: string; first_name: string; last_name: string }> = []
  if (otherIds.length > 0) {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', otherIds)
    profiles = data ?? []
  }

  const profileMap = new Map(profiles.map((p) => [p.id, p]))

  const conversations = otherIds
    .map((otherId) => {
      const conv = convMap.get(otherId)!
      const profile = profileMap.get(otherId)
      return {
        userId: otherId,
        firstName: profile?.first_name ?? '',
        lastName: profile?.last_name ?? '',
        lastMessage: conv.lastMessage.content,
        lastMessageAt: conv.lastMessage.created_at,
        lastMessageByMe: conv.lastMessage.sender_id === user.id,
        unreadCount: conv.unreadCount,
      }
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())

  return NextResponse.json({ conversations })
}

// POST /api/messages { receiverId, content }
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await req.json()
  const { receiverId, content } = body as { receiverId?: string; content?: string }

  if (!receiverId || !content?.trim()) {
    return NextResponse.json({ error: 'receiverId et content requis' }, { status: 400 })
  }

  if (content.length > 1000) {
    return NextResponse.json({ error: 'Message trop long (max 1000 caractères)' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({ sender_id: user.id, receiver_id: receiverId, content: content.trim() })
    .select('id, sender_id, receiver_id, content, is_read, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ message: data })
}
