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
    .select('id, axe_id, learner_id, week_number, content, advice, sent, acted, axe:axes(subject)')
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

// POST : ajouter un tip ou régénérer un tip via Claude
export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { action, tipId, axeId, learnerId, weekNumber, content, advice, groupTheme, axeSubject } = await request.json()

  if (action === 'add' && axeId && learnerId && weekNumber && content) {
    const { error } = await supabaseAdmin.from('tips').insert({
      axe_id: axeId,
      learner_id: learnerId,
      week_number: weekNumber,
      content: content.trim(),
      advice: advice?.trim() || null,
    })
    if (error) return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (action === 'regenerate' && tipId && groupTheme && axeSubject) {
    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'CLAUDE_API_KEY manquante' }, { status: 500 })

    // Récupérer le tip à régénérer pour connaître son axe_id
    const { data: currentTip } = await supabaseAdmin.from('tips').select('axe_id').eq('id', tipId).single()

    // Récupérer tous les tips existants du même axe pour les exclure
    let existingList = ''
    if (currentTip) {
      const { data: siblings } = await supabaseAdmin
        .from('tips')
        .select('content')
        .eq('axe_id', currentTip.axe_id)
        .neq('id', tipId)
      if (siblings && siblings.length > 0) {
        existingList = '\n\nVoici les rappels déjà utilisés pour cet axe (NE PAS les reprendre, propose quelque chose de TOTALEMENT DIFFÉRENT) :\n' +
          siblings.map((s, i) => `${i + 1}. ${s.content}`).join('\n')
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: `Tu es coach en formation professionnelle. Contexte : formation "${groupTheme}", axe "${axeSubject}".
Génère UN rappel + UN conseil NOUVEAU et ORIGINAL :
1. RAPPEL ("le savais-tu ?") : un principe ou bonne pratique vue en formation (2-3 phrases, max 200 car., concret et opérationnel)
2. CONSEIL : une mise en pratique concrète pour la semaine (1-2 phrases, max 200 car., tutoiement)
IMPORTANT : NE JAMAIS citer de noms de modèles, frameworks, auteurs ou théoriciens. Décris l'idée simplement.
${existingList}
Réponds UNIQUEMENT en JSON : {"rappel": "...", "conseil": "..."}`,
        }],
      }),
    })

    if (!response.ok) return NextResponse.json({ error: 'Erreur Claude API' }, { status: 500 })

    const data = await response.json()
    const text = data.content?.[0]?.text?.trim() || ''
    let newContent = text
    let newAdvice: string | null = null

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        newContent = parsed.rappel || text
        newAdvice = parsed.conseil || null
      }
    } catch { /* fallback to raw text */ }

    if (!newContent) return NextResponse.json({ error: 'Réponse vide' }, { status: 500 })

    const { error } = await supabaseAdmin
      .from('tips')
      .update({ content: newContent, advice: newAdvice })
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
