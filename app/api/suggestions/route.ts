import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suggestions
 * Génère 3 suggestions de résultat contextualisées via Claude,
 * à partir de l'action, du "avec qui" et du "dans quel cadre".
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API non configurée' }, { status: 500 })
  }

  const { action, who, where, axeSubject } = await request.json()
  if (!action || !who || !where) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
  }

  const prompt = `Tu es un coach pragmatique. Un apprenant vient de décrire une action qu'il a menée dans le cadre de sa formation.

Voici ce qu'il a fait :
- Action : "${action}"
- Avec qui : "${who}"
- Dans quel cadre : "${where}"
${axeSubject ? `- Axe de progrès : "${axeSubject}"` : ''}

Génère exactement 3 résultats concrets et réalistes que cette personne a pu observer suite à cette action. Chaque résultat doit :
- Être spécifique à la situation décrite (pas générique)
- Être formulé du point de vue de l'apprenant (à la première personne ou en décrivant ce qui s'est passé)
- Faire 1 phrase courte (max 80 caractères)
- Être positif mais crédible (pas exagéré)

Réponds UNIQUEMENT avec un tableau JSON de 3 strings, sans aucun texte avant ou après :
["...", "...", "..."]`

  try {
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

    const results: string[] = JSON.parse(jsonMatch[0])
    return NextResponse.json({ results: results.slice(0, 3) })
  } catch (err) {
    console.error('[Suggestions] Error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
