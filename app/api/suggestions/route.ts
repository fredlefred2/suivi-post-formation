import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suggestions
 *
 * Trois modes :
 * - type:"actions"  → 3 suggestions d'actions
 * - type:"contexts" → 4 suggestions de contexte (adapté à l'axe + thème)
 * - type:"results"  → 3 suggestions de résultats
 *
 * Sonnet pour actions/résultats (qualité), Haiku pour contextes (rapidité).
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API non configurée' }, { status: 500 })
  }

  const body = await request.json()
  const type = body.type || 'results'

  let prompt: string

  if (type === 'actions') {
    // ── Suggestions d'actions ──
    const { axeSubject, axeDescription, groupTheme } = body
    if (!axeSubject) {
      return NextResponse.json({ error: 'axeSubject manquant' }, { status: 400 })
    }

    prompt = `Tu es coach terrain en développement professionnel. Un apprenant travaille sur un axe de progrès précis. Propose-lui 3 actions concrètes qu'il a pu faire CETTE SEMAINE.

═══ DONNÉES ═══
Axe de progrès : "${axeSubject}"
${axeDescription ? `Précision : "${axeDescription}"` : ''}
${groupTheme ? `Formation suivie : "${groupTheme}"` : ''}

═══ RÈGLE N°1 — PERTINENCE ═══
Les 3 suggestions doivent être en lien DIRECT et EXCLUSIF avec l'axe "${axeSubject}". Lis l'axe mot par mot. Chaque suggestion doit ÉVIDEMMENT concerner ce sujet précis. Si quelqu'un lit la suggestion sans connaître l'axe, il doit pouvoir DEVINER de quel axe il s'agit.
${axeDescription ? `Appuie-toi sur la précision donnée par l'apprenant : "${axeDescription}".` : ''}
${groupTheme ? `Ancre dans le contexte de la formation "${groupTheme}".` : ''}

═══ RÈGLE N°2 — CONCRET ═══
Chaque suggestion décrit UN GESTE PRÉCIS, un moment réel, un mot prononcé. On doit VOIR LA SCÈNE. Pas un concept, pas un objectif, pas une intention. N'intègre pas de notion de temps (minutes, secondes, etc ...), ni de chiffres (3 questions, 2 objections, ...)

═══ RÈGLE N°3 — FORMAT ═══
- Commence par "J'ai"
- Max 55 caractères
- Langage oral, naturel — comme raconté à un collègue
- Pas de jargon, pas de noms de méthodes ou modèles
- Variété : une facile, une qui demande un effort, une originale

═══ ANTI-EXEMPLES (à ne JAMAIS produire) ═══
- "J'ai pratiqué l'écoute active" ❌ concept, pas une action
- "J'ai travaillé ma posture" ❌ trop vague, aucune scène
- "J'ai mis en place une démarche" ❌ creux, bureaucratique
- "J'ai amélioré ma communication" ❌ intention, pas un geste

═══ BONS EXEMPLES (pour t'inspirer du NIVEAU de précision attendu) ═══
- "J'ai laissé du silence après ma question" ✅
- "J'ai dit non sans me justifier" ✅
- "J'ai reformulé ce qu'il venait de dire" ✅
- "J'ai coupé mon tel pendant l'entretien" ✅
- "J'ai noté les points clés avant d'appeler" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["J'ai...", "J'ai...", "J'ai..."]`

  } else if (type === 'contexts') {
    // ── Suggestions de contexte ──
    const { axeSubject, axeDescription, groupTheme, action } = body
    if (!axeSubject) {
      return NextResponse.json({ error: 'axeSubject manquant' }, { status: 400 })
    }

    prompt = `Tu es coach terrain. Un apprenant vient de déclarer une action liée à son axe de progrès. On lui demande "C'était dans quel contexte ?". Propose 4 contextes réalistes et variés.

═══ DONNÉES ═══
Action déclarée : "${action || ''}"
Axe de progrès : "${axeSubject}"
${axeDescription ? `Précision : "${axeDescription}"` : ''}
${groupTheme ? `Formation suivie : "${groupTheme}"` : ''}

═══ RÈGLES ═══
1. Chaque contexte doit être une SITUATION PROFESSIONNELLE concrète où cette action a pu se produire, en lien avec l'axe "${axeSubject}"${groupTheme ? ` et la formation "${groupTheme}"` : ''}.
2. Court : max 30 caractères.
3. C'est un LIEU ou un MOMENT professionnel — pas une personne.
4. Varié : des situations différentes (réunion, entretien, présentation, terrain, appel, etc.)
5. Adapté au métier et au contexte de formation de l'apprenant.

═══ ANTI-EXEMPLES ═══
- "Au travail" ❌ trop vague
- "Dans un cadre professionnel" ❌ creux
- "Lors d'un échange" ❌ générique

═══ BONS EXEMPLES (niveau de précision) ═══
- "En réunion d'équipe" ✅
- "En RV client" ✅
- "En prospection tél" ✅
- "Face à des clients" ✅
- "En brief du matin" ✅

Réponds UNIQUEMENT avec un tableau JSON de 4 strings :
["...", "...", "...", "..."]`

  } else {
    // ── Suggestions de résultats ──
    const { action, context, axeSubject, axeDescription, groupTheme } = body
    if (!action || !context) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    prompt = `Tu es coach terrain. Un apprenant vient de déclarer une action dans un contexte précis. Propose 3 résultats qu'il a pu OBSERVER après.

═══ CE QU'IL A FAIT ═══
Action : "${action}"
Contexte : "${context}"
${axeSubject ? `Axe de progrès : "${axeSubject}"` : ''}
${axeDescription ? `Précision : "${axeDescription}"` : ''}
${groupTheme ? `Formation : "${groupTheme}"` : ''}

═══ RÈGLE N°1 — SPÉCIFICITÉ ═══
Chaque résultat doit être LA CONSÉQUENCE DIRECTE et VISIBLE de "${action}" dans le contexte "${context}". Si on change l'action ou le contexte, le résultat ne doit PLUS fonctionner.

═══ RÈGLE N°2 — ON VOIT LA SCÈNE ═══
C'est ce que la personne a VU (réaction des autres), SENTI (son propre ressenti) ou OBTENU (effet mesurable).

═══ RÈGLE N°3 — FORMAT ═══
- Max 60 caractères
- 3 angles différents : réaction des autres / ressenti perso / effet concret
- Langage oral, vivant
- Pas de jargon

═══ BONS EXEMPLES (niveau de précision attendu) ═══
- "Il s'est plus exprimé que d'habitude" ✅
- "On a bouclé plus rapidement que d'habitude" ✅
- "J'ai obtenu plus d'informations que d'habitude" ✅
- "L'échange a été plus constructif" ✅
- "J'ai obtenu plus d'informations" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["...", "...", "..."]`
  }

  // Haiku pour les contextes (rapide), Sonnet pour le reste (qualité)
  const model = type === 'contexts'
    ? 'claude-haiku-4-5-20241022'
    : 'claude-sonnet-4-20250514'

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Suggestions] Claude API error:', response.status, errorText)
      return NextResponse.json({ error: 'Erreur API' }, { status: 502 })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[Suggestions] Parse error:', text)
      return NextResponse.json({ error: 'Erreur de format' }, { status: 500 })
    }

    const items: string[] = JSON.parse(jsonMatch[0])
    return NextResponse.json({ results: items })
  } catch (err) {
    console.error('[Suggestions] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
