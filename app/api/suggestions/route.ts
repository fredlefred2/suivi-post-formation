import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suggestions
 *
 * Deux modes :
 * - type:"actions" → génère 3 suggestions d'actions via Haiku (rapide + pas cher)
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

    prompt = `Tu es un coach en formation professionnelle. Un apprenant travaille sur cet axe de progrès : "${axeSubject}".
${groupTheme ? `Le thème de la formation : "${groupTheme}".` : ''}

Génère exactement 3 actions concrètes et simples que cette personne a pu réaliser cette semaine en lien avec cet axe. Chaque action doit :
- Commencer par "J'ai..."
- Être spécifique et concrète (pas vague)
- Faire 1 phrase courte (max 60 caractères)
- Être réaliste et faisable en une journée de travail
- Être variée (pas 3 fois la même idée)

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["J'ai...", "J'ai...", "J'ai..."]`

  } else {
    // ── Suggestions de résultats ──
    const { action, who, axeSubject } = body
    if (!action || !who) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    prompt = `Tu es un coach pragmatique. Un apprenant vient de décrire une action qu'il a menée dans le cadre de sa formation.

Voici ce qu'il a fait :
- Action : "${action}"
- Avec qui : "${who}"
${axeSubject ? `- Axe de progrès : "${axeSubject}"` : ''}

Génère exactement 3 résultats concrets et réalistes que cette personne a pu observer suite à cette action. Chaque résultat doit :
- Être spécifique à la situation décrite (pas générique)
- Être formulé du point de vue de l'apprenant (à la première personne ou en décrivant ce qui s'est passé)
- Faire 1 phrase courte (max 80 caractères)
- Être positif mais crédible (pas exagéré)

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
