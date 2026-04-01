import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * GET /api/maquette — utilitaire temporaire pour préparer la démo
 * ?action=delete-checkin&email=xxx  → supprime le dernier check-in
 * ?action=force-tip&email=xxx      → marque un tip sent + non acted
 * ?action=info&email=xxx           → infos sur l'apprenant
 */
export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')
  const email = req.nextUrl.searchParams.get('email')

  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  // Trouver le user via auth puis profiles
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
  const authUser = users?.find(u => u.email === email)
  if (!authUser) return NextResponse.json({ error: 'auth user not found' }, { status: 404 })

  const learnerId = authUser.id

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name')
    .eq('id', learnerId)
    .single()

  if (action === 'info') {
    const [{ data: checkins }, { data: tips }] = await Promise.all([
      supabaseAdmin.from('checkins').select('id, week_number, year, created_at').eq('learner_id', learnerId).order('created_at', { ascending: false }).limit(3),
      supabaseAdmin.from('tips').select('id, content, week_number, sent, acted, axe_id').eq('learner_id', learnerId).order('week_number'),
    ])
    return NextResponse.json({ profile, checkins, tips })
  }

  if (action === 'delete-checkin') {
    const { data: lastCheckin } = await supabaseAdmin
      .from('checkins')
      .select('id, week_number, year')
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!lastCheckin) return NextResponse.json({ error: 'no checkin found' })

    const { error } = await supabaseAdmin.from('checkins').delete().eq('id', lastCheckin.id)
    return NextResponse.json({ deleted: lastCheckin, error: error?.message })
  }

  if (action === 'force-tip') {
    // Trouver un tip non envoyé et le marquer sent
    const { data: tip } = await supabaseAdmin
      .from('tips')
      .select('id, content, week_number')
      .eq('learner_id', learnerId)
      .eq('sent', false)
      .order('week_number')
      .limit(1)
      .single()

    if (!tip) return NextResponse.json({ error: 'no unsent tip found' })

    const { error } = await supabaseAdmin
      .from('tips')
      .update({ sent: true, acted: false })
      .eq('id', tip.id)

    return NextResponse.json({ forced: tip, error: error?.message })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
