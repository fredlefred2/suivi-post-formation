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
    const { axeSubject, axeDescription, groupTheme } = body
    if (!axeSubject) {
      return NextResponse.json({ error: 'axeSubject manquant' }, { status: 400 })
    }

    prompt = `Contexte : une appli de suivi post-formation professionnelle. L'apprenant clique pour déclarer une action qu'il a menée cette semaine. On lui propose 3 suggestions pour l'inspirer.

Son axe de progrès : "${axeSubject}"
${axeDescription ? `Description de l'axe : "${axeDescription}"` : ''}
${groupTheme ? `Thème de la formation : "${groupTheme}"` : ''}

IMPORTANT : tes 3 suggestions DOIVENT être en lien DIRECT avec l'axe "${axeSubject}"${axeDescription ? ` (${axeDescription})` : ''}${groupTheme ? ` dans le contexte de la formation "${groupTheme}"` : ''}. Si l'axe parle de découverte client, les actions doivent concerner la découverte client. Si l'axe parle de prise de parole, les actions doivent concerner la prise de parole. JAMAIS d'actions génériques qui pourraient s'appliquer à n'importe quel axe.

Génère 3 suggestions d'actions. Règles STRICTES :
- Chaque suggestion commence par "J'ai"
- C'est une action PRÉCISE et SITUATIONNELLE qu'un professionnel a pu VRAIMENT faire cette semaine en lien DIRECT avec l'axe "${axeSubject}"${groupTheme ? ` et le thème "${groupTheme}"` : ''}
- Un moment, un geste concret, un mot prononcé — pas un concept
- Max 55 caractères
- Variées entre elles : une action facile/quotidienne, une qui demande un effort, une originale
- Pas de jargon de formation, pas de noms de méthodes ou modèles
- Langage naturel, oral, comme si la personne racontait à un collègue

MAUVAIS exemples (trop vagues, scolaires, passe-partout) :
- "J'ai pratiqué l'écoute active" ❌ (concept, pas une action)
- "J'ai mis en place une démarche" ❌ (vague)
- "J'ai travaillé sur mon assertivité" ❌ (pas concret)

BONS exemples (on voit la scène, c'est spécifique) :
- "J'ai laissé 5 secondes de silence après ma question" ✅
- "J'ai dit non sans me justifier pendant 10 minutes" ✅
- "J'ai reformulé en une phrase ce que mon client disait" ✅
- "J'ai coupé mon téléphone pendant l'entretien" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["J'ai...", "J'ai...", "J'ai..."]`

  } else {
    // ── Suggestions de résultats ──
    const { action, who, axeSubject, axeDescription, groupTheme } = body
    if (!action || !who) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    prompt = `Contexte : une appli de suivi post-formation professionnelle. L'apprenant vient de déclarer une action. On lui demande "Et alors, qu'est-ce que ça a donné ?" et on lui propose 3 résultats possibles.

Ce qu'il a fait : "${action}"
Avec qui : "${who}"
${axeSubject ? `Son axe de progrès : "${axeSubject}"` : ''}
${axeDescription ? `Description de l'axe : "${axeDescription}"` : ''}
${groupTheme ? `Thème de la formation : "${groupTheme}"` : ''}

Génère 3 résultats observables SPÉCIFIQUES à cette situation précise. Règles STRICTES :
- C'est ce que la personne a VU, SENTI ou OBTENU concrètement après avoir fait "${action}" avec "${who}"
- Chaque résultat doit être IMPOSSIBLE à réutiliser pour une autre action — il doit coller à celle-ci
- Max 60 caractères
- Diversifie les angles : un sur la réaction de l'autre personne, un sur le ressenti de l'apprenant, un sur un effet concret/mesurable
- Langage naturel, oral, vivant — on doit voir la scène

MAUVAIS exemples (interchangeables, bateaux, creux) :
- "Ça s'est bien passé" ❌
- "L'échange a été constructif" ❌
- "J'ai vu une amélioration" ❌

BONS exemples (on y est, c'est vivant) :
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
