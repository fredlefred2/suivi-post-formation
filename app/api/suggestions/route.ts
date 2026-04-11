import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suggestions
 *
 * Deux modes :
 * - type:"actions" → génère 3 suggestions d'actions via Claude
 * - type:"results" → génère 3 suggestions de résultats via Claude
 *
 * Utilise claude-sonnet-4-20250514 pour la qualité des suggestions.
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
Chaque suggestion décrit UN GESTE PRÉCIS, un moment réel, un mot prononcé. On doit VOIR LA SCÈNE. Pas un concept, pas un objectif, pas une intention.

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
- "J'ai laissé 5 sec de silence après ma question" ✅
- "J'ai dit non sans me justifier" ✅
- "J'ai reformulé en une phrase ce qu'il venait de dire" ✅
- "J'ai coupé mon tel pendant l'entretien" ✅
- "J'ai noté 3 points clés avant d'appeler" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["J'ai...", "J'ai...", "J'ai..."]`

  } else {
    // ── Suggestions de résultats ──
    const { action, who, axeSubject, axeDescription, groupTheme } = body
    if (!action || !who) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    prompt = `Tu es coach terrain. Un apprenant vient de déclarer une action. Propose 3 résultats qu'il a pu OBSERVER après.

═══ CE QU'IL A FAIT ═══
Action : "${action}"
Avec qui : "${who}"
${axeSubject ? `Axe de progrès : "${axeSubject}"` : ''}
${axeDescription ? `Précision : "${axeDescription}"` : ''}
${groupTheme ? `Formation : "${groupTheme}"` : ''}

═══ RÈGLE N°1 — SPÉCIFICITÉ ═══
Chaque résultat doit être LA CONSÉQUENCE DIRECTE et VISIBLE de "${action}" avec "${who}". Si on change l'action ou le "avec qui", le résultat ne doit PLUS fonctionner. C'est le test : est-ce que ce résultat colle UNIQUEMENT à cette situation ?

═══ RÈGLE N°2 — ON VOIT LA SCÈNE ═══
C'est ce que la personne a VU (réaction de l'autre), SENTI (son propre ressenti) ou OBTENU (effet mesurable). Un résultat = un moment précis.

═══ RÈGLE N°3 — FORMAT ═══
- Max 60 caractères
- 3 angles différents : réaction de l'autre / ressenti perso / effet concret
- Langage oral, vivant
- Pas de jargon

═══ ANTI-EXEMPLES ═══
- "Ça s'est bien passé" ❌ passe-partout
- "L'échange a été constructif" ❌ creux
- "J'ai vu une amélioration" ❌ vague
- "La communication était meilleure" ❌ générique

═══ BONS EXEMPLES (niveau de précision attendu) ═══
- "Il a décroché les bras et s'est mis à parler" ✅
- "Elle m'a dit « c'est la 1ère fois qu'on me demande ça »" ✅
- "On a bouclé en 20 min au lieu d'une heure" ✅
- "J'étais moins stressé que d'habitude, ça m'a surpris" ✅
- "Il a souri et m'a posé une question en retour" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["...", "...", "..."]`
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
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
    return NextResponse.json({ results: items.slice(0, 3) })
  } catch (err) {
    console.error('[Suggestions] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
