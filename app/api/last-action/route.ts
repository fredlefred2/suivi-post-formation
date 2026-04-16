import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET : renvoie la date de la dernière action de l'apprenant + nb jours écoulés
// Utilisé par l'orchestrateur pour décider d'afficher la fenêtre "J'ai agi"
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: lastAction } = await supabase
    .from('actions')
    .select('created_at')
    .eq('learner_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastAction) {
    // Aucune action jamais — on considère "ancien"
    return NextResponse.json({ lastActionAt: null, daysSince: null, isStale: false })
  }

  const lastDate = new Date(lastAction.created_at)
  const now = new Date()
  const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

  return NextResponse.json({
    lastActionAt: lastAction.created_at,
    daysSince,
    isStale: daysSince >= 10,
  })
}
