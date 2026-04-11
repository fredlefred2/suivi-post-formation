import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suggestions
 *
 * Deux modes :
 * - type:"actions" → génère 3 suggestions d'actions via Haiku
 * - type:"results" → génère 3 suggestions de résultats via Haiku
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
    const { axeSubject, groupTheme } = body
    if (!axeSubject) {
      return NextResponse.json({ error: 'axeSubject manquant' }, { status: 400 })
    }

    prompt = `Contexte : une appli de suivi post-formation. L'apprenant clique pour déclarer une action qu'il a menée cette semaine. On lui propose 3 suggestions pour l'aider.

Axe de progrès de l'apprenant : "${axeSubject}"
${groupTheme ? `Thème de la formation : "${groupTheme}"` : ''}

Génère 3 suggestions d'actions. Règles STRICTES :
- Chaque suggestion commence par "J'ai"
- C'est une action PRÉCISE et SITUATIONNELLE : un moment, un geste, un mot, pas un concept
- Max 50 caractères
- Variées entre elles : une facile/quotidienne, une qui demande du courage, une originale
- Pas de jargon de formation, pas de noms de méthodes
- Langage naturel, comme si la personne racontait à un collègue

MAUVAIS exemples (trop vagues, scolaires) :
- "J'ai pratiqué l'écoute active" ❌
- "J'ai mis en place une démarche collaborative" ❌
- "J'ai travaillé sur mon assertivité" ❌

BONS exemples (précis, vivants) :
- "J'ai laissé un silence de 5 secondes après ma question" ✅
- "J'ai dit non à mon chef sans me justifier 10 minutes" ✅
- "J'ai reformulé en une phrase ce que mon client venait de dire" ✅
- "J'ai coupé mon téléphone pendant un entretien" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["J'ai...", "J'ai...", "J'ai..."]`

  } else {
    // ── Suggestions de résultats ──
    const { action, who, axeSubject } = body
    if (!action || !who) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    prompt = `Contexte : une appli de suivi post-formation. L'apprenant vient de déclarer une action. On lui demande "Et alors, qu'est-ce que ça a donné ?" et on lui propose 3 résultats possibles.

Ce qu'il a fait : "${action}"
Avec qui : "${who}"
${axeSubject ? `Axe de progrès : "${axeSubject}"` : ''}

Génère 3 résultats observables. Règles STRICTES :
- C'est ce que la personne a VU, SENTI ou OBTENU concrètement
- Spécifique à cette action et cet interlocuteur — pas interchangeable
- Max 60 caractères
- Un résultat sur la réaction de l'autre, un sur le ressenti de l'apprenant, un sur la suite concrète
- Langage naturel et oral, pas de langue de bois

MAUVAIS exemples (bateaux, interchangeables) :
- "Ça s'est bien passé" ❌
- "L'échange a été constructif" ❌
- "J'ai vu une différence" ❌

BONS exemples (on voit la scène) :
- "Il a décroché les bras et s'est mis à parler" ✅
- "Elle m'a dit « c'est la première fois qu'on me demande ça »" ✅
- "On a bouclé en 20 min au lieu d'une heure" ✅
- "J'étais moins stressé que d'habitude, ça m'a surpris" ✅

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
        model: 'claude-haiku-4-5-20241022',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('[Suggestions] Claude API error:', response.status)
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
