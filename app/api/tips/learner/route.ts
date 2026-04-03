import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: tips } = await supabaseAdmin
    .from('tips')
    .select('id, axe_id, week_number, content, advice, sent, acted, axe:axes(subject)')
    .eq('learner_id', user.id)
    .order('axe_id')
    .order('week_number', { ascending: false })

  return NextResponse.json({ tips: tips || [] })
}
