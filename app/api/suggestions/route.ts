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

    prompt = `Tu es coach en développement professionnel. Un apprenant suit une formation et travaille sur un axe de progrès précis. Tu dois lui suggérer 3 actions concrètes qu'il a pu réaliser CETTE SEMAINE, en lien DIRECT avec son axe.

═══ DONNÉES DE L'APPRENANT ═══
Axe de progrès : "${axeSubject}"
${axeDescription ? `Précision sur l'axe : "${axeDescription}"` : ''}
${groupTheme ? `Thème de la formation : "${groupTheme}"` : ''}

═══ CONSIGNE CRITIQUE ═══
Tes suggestions DOIVENT être hyper-spécifiques à l'axe "${axeSubject}".
${axeDescription ? `L'apprenant a précisé : "${axeDescription}" — utilise ces détails.` : ''}
${groupTheme ? `La formation porte sur "${groupTheme}" — ancre tes suggestions dans ce contexte métier.` : ''}

Si l'axe parle de SILENCES et PAUSES → les 3 actions doivent concerner des silences, des pauses, du ralentissement de débit. PAS autre chose.
Si l'axe parle de PRÉPARATION → les 3 actions doivent concerner la préparation (intro, plan, conclusion). PAS autre chose.
Si l'axe parle de GROUPES DIFFICILES → les 3 actions doivent concerner la gestion de publics compliqués. PAS autre chose.

═══ FORMAT ═══
- Chaque suggestion commence par "J'ai"
- C'est un geste PRÉCIS, SITUÉ dans le temps — on voit la scène
- Max 55 caractères
- Langage oral naturel (comme si la personne racontait à un collègue)
- PAS de jargon, PAS de noms de méthodes

EXEMPLES DE CE QU'IL NE FAUT PAS FAIRE :
- "J'ai pratiqué l'écoute active" ❌ (concept abstrait)
- "J'ai travaillé ma posture" ❌ (trop vague)
- "J'ai mis en place une démarche" ❌ (creux)

EXEMPLES DE CE QU'IL FAUT FAIRE :
- Pour un axe "silences/pauses" : "J'ai compté 3 secondes avant de reprendre" ✅
- Pour un axe "préparation" : "J'ai écrit mon intro mot pour mot" ✅
- Pour un axe "groupes difficiles" : "J'ai recadré un bavard sans m'énerver" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["J'ai...", "J'ai...", "J'ai..."]`

  } else {
    // ── Suggestions de résultats ──
    const { action, who, axeSubject, axeDescription, groupTheme } = body
    if (!action || !who) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    prompt = `Tu es coach en développement professionnel. Un apprenant vient de déclarer une action précise. Tu dois lui suggérer 3 résultats qu'il a pu OBSERVER concrètement après cette action.

═══ CE QU'IL A FAIT ═══
Action : "${action}"
Avec qui : "${who}"
${axeSubject ? `Son axe de progrès : "${axeSubject}"` : ''}
${axeDescription ? `Précision sur l'axe : "${axeDescription}"` : ''}
${groupTheme ? `Thème de la formation : "${groupTheme}"` : ''}

═══ CONSIGNE CRITIQUE ═══
Chaque résultat doit être LA CONSÉQUENCE DIRECTE de "${action}" avec "${who}".
Le résultat doit être IMPOSSIBLE à réutiliser pour une autre action — il colle à celle-ci.

═══ FORMAT ═══
- C'est ce que la personne a VU, SENTI ou OBTENU
- Max 60 caractères
- 3 angles : la réaction de l'autre / le ressenti de l'apprenant / un effet concret
- Langage oral, vivant — on doit voir la scène

EXEMPLES DE CE QU'IL NE FAUT PAS FAIRE :
- "Ça s'est bien passé" ❌ (passe-partout)
- "L'échange a été constructif" ❌ (creux)

EXEMPLES DE CE QU'IL FAUT FAIRE :
- "Il a décroché les bras et s'est mis à parler" ✅
- "On a bouclé en 20 min au lieu d'une heure" ✅
- "J'étais moins stressé que d'habitude" ✅

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
