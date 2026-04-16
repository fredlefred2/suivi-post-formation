import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type PromptType = 'checkin' | 'tip' | 'action' | 'quiz'
const VALID_TYPES: PromptType[] = ['checkin', 'tip', 'action', 'quiz']

// GET : renvoie tous les skips de l'apprenant connecté
// Utile pour l'orchestrateur OpenAppPrompt qui check avant d'afficher
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data, error } = await supabase
    .from('prompt_dismissals')
    .select('prompt_type, skipped_at')
    .eq('learner_id', user.id)

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  // Renvoyer sous forme de Record pour un check facile côté client
  const dismissals: Record<string, string> = {}
  for (const row of data || []) {
    dismissals[row.prompt_type] = row.skipped_at
  }

  return NextResponse.json({ dismissals })
}

// POST : enregistrer un skip (upsert sur learner_id + prompt_type)
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { promptType } = await request.json()

  if (!VALID_TYPES.includes(promptType)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }

  const { error } = await supabase
    .from('prompt_dismissals')
    .upsert({
      learner_id: user.id,
      prompt_type: promptType,
      skipped_at: new Date().toISOString(),
    }, { onConflict: 'learner_id,prompt_type' })

  if (error) {
    console.error('[prompt-dismiss] Erreur upsert:', error.message)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

// DELETE : reset un skip (quand on veut re-afficher la fenêtre — ex: nouveau tip arrive)
export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { promptType } = await request.json()

  if (!VALID_TYPES.includes(promptType)) {
    return NextResponse.json({ error: 'Type invalide' }, { status: 400 })
  }

  const { error } = await supabase
    .from('prompt_dismissals')
    .delete()
    .eq('learner_id', user.id)
    .eq('prompt_type', promptType)

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })

  return NextResponse.json({ success: true })
}
