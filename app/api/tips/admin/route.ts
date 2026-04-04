import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET : récupérer tous les tips d'un groupe (pour le formateur)
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const groupId = request.nextUrl.searchParams.get('groupId')
  if (!groupId) return NextResponse.json({ error: 'groupId requis' }, { status: 400 })

  // Vérifier que le formateur gère ce groupe (via admin pour éviter RLS)
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('id')
    .eq('id', groupId)
    .eq('trainer_id', user.id)
    .single()

  if (!group) return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 403 })

  // Récupérer les apprenants du groupe
  const { data: members } = await supabaseAdmin
    .from('group_members')
    .select('learner_id')
    .eq('group_id', groupId)

  const learnerIds = (members || []).map(m => m.learner_id)
  if (learnerIds.length === 0) return NextResponse.json({ tips: [] })

  // Récupérer les profils des apprenants
  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', learnerIds)

  const profileMap = new Map((profiles || []).map(p => [p.id, p]))

  // Récupérer tous les tips avec infos axe
  const { data: tips } = await supabaseAdmin
    .from('tips')
    .select('id, axe_id, learner_id, week_number, content, advice, sent, acted, read_at, next_scheduled, axe:axes(subject)')
    .in('learner_id', learnerIds)
    .order('learner_id')
    .order('axe_id')
    .order('week_number')

  // Enrichir avec le nom de l'apprenant
  const enriched = (tips || []).map(t => ({
    ...t,
    learner: profileMap.get(t.learner_id) ? {
      first_name: profileMap.get(t.learner_id)!.first_name,
      last_name: profileMap.get(t.learner_id)!.last_name,
    } : null,
  }))

  return NextResponse.json({ tips: enriched })
}

// PUT : modifier un tip
export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { tipId, content, advice } = await request.json()
  if (!tipId || !content) return NextResponse.json({ error: 'tipId et content requis' }, { status: 400 })

  const updateData: Record<string, string> = { content: content.trim() }
  if (advice !== undefined) updateData.advice = (advice || '').trim()

  const { error } = await supabaseAdmin
    .from('tips')
    .update(updateData)
    .eq('id', tipId)

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// POST : generer ou regenerer un tip personnalise
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const { generatePersonalizedTip } = await import('@/lib/generate-tips')
  const { gatherLearnerContext } = await import('@/lib/gather-learner-context')

  const { action, tipId, axeId, learnerId } = await request.json()

  // ── generate-next : generer le prochain tip pour un axe ───────
  if (action === 'generate-next' && axeId && learnerId) {
    const ctx = await gatherLearnerContext(learnerId, axeId)
    if (!ctx) return NextResponse.json({ error: 'Contexte introuvable' }, { status: 404 })

    // Calculer le numero de semaine
    const now = new Date()
    const weekNumber = Math.ceil(((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / 86400000 + new Date(now.getFullYear(), 0, 1).getDay() + 1) / 7)

    const result = await generatePersonalizedTip(ctx, weekNumber)
    if (!result) return NextResponse.json({ error: 'Erreur de génération' }, { status: 500 })

    return NextResponse.json({ success: true, tip: result })
  }

  // ── regenerate : regenerer un tip existant ────────────────────
  if (action === 'regenerate' && tipId) {
    // Recuperer le tip pour connaitre l'axe et l'apprenant
    const { data: currentTip } = await supabaseAdmin
      .from('tips')
      .select('axe_id, learner_id, week_number')
      .eq('id', tipId)
      .single()

    if (!currentTip) return NextResponse.json({ error: 'Tip introuvable' }, { status: 404 })

    const ctx = await gatherLearnerContext(currentTip.learner_id, currentTip.axe_id)
    if (!ctx) return NextResponse.json({ error: 'Contexte introuvable' }, { status: 404 })

    // Supprimer l'ancien tip
    await supabaseAdmin.from('tips').delete().eq('id', tipId)

    // Generer un nouveau
    const result = await generatePersonalizedTip(ctx, currentTip.week_number)
    if (!result) return NextResponse.json({ error: 'Erreur de régénération' }, { status: 500 })

    return NextResponse.json({ success: true, tip: result })
  }

  return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
}

// DELETE : supprimer un tip
export async function DELETE(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const tipId = request.nextUrl.searchParams.get('tipId')
  if (!tipId) return NextResponse.json({ error: 'tipId requis' }, { status: 400 })

  const { error } = await supabaseAdmin.from('tips').delete().eq('id', tipId)
  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  return NextResponse.json({ success: true })
}
