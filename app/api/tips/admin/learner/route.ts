import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET : récupérer tous les tips d'un apprenant spécifique (pour le formateur)
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const learnerId = request.nextUrl.searchParams.get('learnerId')
  if (!learnerId) return NextResponse.json({ error: 'learnerId requis' }, { status: 400 })

  // Vérifier que le formateur a accès à cet apprenant
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups!inner(trainer_id)')
    .eq('learner_id', learnerId)
    .eq('groups.trainer_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // Récupérer les tips avec infos axe (incluant created_at pour le tri)
  const { data: tips } = await supabaseAdmin
    .from('tips')
    .select('id, axe_id, week_number, content, advice, sent, acted, read_at, next_scheduled, axe:axes(subject, created_at)')
    .eq('learner_id', learnerId)
    .order('week_number')

  // Grouper par axe
  const axeMap = new Map<string, { axeId: string; axeSubject: string; axeCreatedAt: string; tips: typeof tips }>()

  for (const tip of tips || []) {
    const axeId = tip.axe_id
    const axeData = (tip as Record<string, unknown>).axe as { subject: string; created_at: string } | null
    const axeSubject = axeData?.subject ?? 'Axe'
    const axeCreatedAt = axeData?.created_at ?? ''
    if (!axeMap.has(axeId)) {
      axeMap.set(axeId, { axeId, axeSubject, axeCreatedAt, tips: [] })
    }
    axeMap.get(axeId)!.tips!.push(tip)
  }

  // Trier les axes par created_at (même ordre que la page apprenant)
  const sorted = Array.from(axeMap.values()).sort((a, b) =>
    a.axeCreatedAt.localeCompare(b.axeCreatedAt)
  )

  // Retourner sans axeCreatedAt (pas utile côté client)
  return NextResponse.json({
    axeTips: sorted.map(({ axeCreatedAt, ...rest }) => rest),
  })
}
