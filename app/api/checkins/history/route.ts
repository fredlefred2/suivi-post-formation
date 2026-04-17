import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET : renvoie l'historique des check-ins de l'apprenant (récents d'abord)
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('checkins')
    .select('id, week_number, year, weather, what_worked, difficulties, created_at')
    .eq('learner_id', user.id)
    .order('year', { ascending: false })
    .order('week_number', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  return NextResponse.json({ checkins: data ?? [] })
}
