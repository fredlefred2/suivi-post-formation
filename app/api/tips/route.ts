import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET : récupère le tip courant (le dernier envoyé et non encore agi)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Chercher le tip le plus récent envoyé mais pas encore "relevé"
  const { data: tip } = await supabase
    .from('tips')
    .select('id, content, advice, week_number, acted, axe_id, axe:axes(subject)')
    .eq('learner_id', user.id)
    .eq('sent', true)
    .eq('acted', false)
    .order('week_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ tip })
}

// PATCH : marquer un tip comme "relevé" ou "passé"
export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { tipId, acted } = await request.json()

  const { error } = await supabase
    .from('tips')
    .update({ acted })
    .eq('id', tipId)
    .eq('learner_id', user.id)

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  return NextResponse.json({ success: true })
}
