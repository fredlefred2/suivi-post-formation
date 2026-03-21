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

  // Vérifier que le formateur gère ce groupe
  const { data: group } = await supabase
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

  // Récupérer tous les tips avec infos axe et apprenant
  const { data: tips } = await supabaseAdmin
    .from('tips')
    .select('id, axe_id, learner_id, week_number, content, sent, acted, axe:axes(subject), learner:profiles!tips_learner_id_fkey(first_name, last_name)')
    .in('learner_id', learnerIds)
    .order('learner_id')
    .order('axe_id')
    .order('week_number')

  return NextResponse.json({ tips: tips || [] })
}

// PUT : modifier un tip
export async function PUT(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { tipId, content } = await request.json()
  if (!tipId || !content) return NextResponse.json({ error: 'tipId et content requis' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('tips')
    .update({ content: content.trim() })
    .eq('id', tipId)

  if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  return NextResponse.json({ success: true })
}

// POST : ajouter un tip ou régénérer un tip via Claude
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { action, tipId, axeId, learnerId, weekNumber, content, groupTheme, axeSubject } = await request.json()

  if (action === 'add' && axeId && learnerId && weekNumber && content) {
    const { error } = await supabaseAdmin.from('tips').insert({
      axe_id: axeId,
      learner_id: learnerId,
      week_number: weekNumber,
      content: content.trim(),
    })
    if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'regenerate' && tipId && groupTheme && axeSubject) {
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'CLAUDE_API_KEY manquante' }, { status: 500 })

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-20250414',
        max_tokens: 100,
        messages: [{
          role: 'user',
          content: `Tu es coach en formation professionnelle. Contexte : formation "${groupTheme}", axe "${axeSubject}".
Génère UN SEUL micro-défi concret (1 phrase, max 120 car., tutoiement, actionnable en 1 journée).
Réponds UNIQUEMENT avec le texte du défi, sans guillemets ni ponctuation finale.`,
        }],
      }),
    })

    if (!response.ok) return NextResponse.json({ error: 'Erreur Claude API' }, { status: 500 })

    const data = await response.json()
    const newContent = data.content?.[0]?.text?.trim() || ''
    if (!newContent) return NextResponse.json({ error: 'Réponse vide' }, { status: 500 })

    const { error } = await supabaseAdmin
      .from('tips')
      .update({ content: newContent })
      .eq('id', tipId)

    if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    return NextResponse.json({ success: true, content: newContent })
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
