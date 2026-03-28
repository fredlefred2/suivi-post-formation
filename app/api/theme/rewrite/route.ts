import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { theme } = await request.json()

    if (!theme || typeof theme !== 'string' || theme.trim().length < 5) {
      return NextResponse.json(
        { error: 'Le thème doit contenir au moins 5 caractères' },
        { status: 400 },
      )
    }

    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })
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
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Tu es un expert en ingénierie pédagogique pour la formation professionnelle continue.

L'utilisateur a saisi un thème de formation, souvent sous forme de liste à puces, de mots-clés ou de notes rapides. Ton travail est de le réécrire de façon professionnelle, structurée et détaillée.

RÈGLES :
- Garde TOUS les éléments mentionnés par l'utilisateur, ne supprime rien
- Reformule de façon claire et professionnelle
- Structure avec des tirets (pas de numéros)
- Ajoute des précisions pédagogiques si le contenu est trop vague (ex: "communication" → "Communication assertive : techniques d'écoute active, reformulation, expression des besoins")
- Reste fidèle à l'intention de l'utilisateur, ne rajoute pas de thèmes qui n'ont rien à voir
- Maximum 8-10 lignes
- Pas de titre, pas d'introduction, pas de conclusion
- Réponds UNIQUEMENT avec le texte reformulé, rien d'autre

THÈME À RÉÉCRIRE :
${theme.trim()}`,
        }],
      }),
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Erreur API' }, { status: 500 })
    }

    const data = await response.json()
    const rewritten = data.content?.[0]?.text?.trim() || ''

    return NextResponse.json({ rewritten })
  } catch (err) {
    console.error('Erreur réécriture thème:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la réécriture du thème' },
      { status: 500 },
    )
  }
}
