import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// POST /api/messages/read { senderId }
// Marque comme lus tous les messages reçus de cet expéditeur
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { senderId } = (await req.json()) as { senderId?: string }
  if (!senderId) return NextResponse.json({ error: 'senderId requis' }, { status: 400 })

  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('sender_id', senderId)
    .eq('receiver_id', user.id)
    .eq('is_read', false)

  if (error) { console.error('DB error:', error); return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }) }
  return NextResponse.json({ ok: true })
}
