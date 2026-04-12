import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/suggestions
 *
 * Trois modes :
 * - type:"contexts" → 4 suggestions de contexte (étape 2)
 * - type:"actions"  → 3 suggestions d'actions (étape 3)
 * - type:"results"  → 3 suggestions de résultats (étape 4)
 *
 * Flow : Axe → Contexte → Action → Résultat
 * Sonnet pour tout.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'API non configurée' }, { status: 500 })
  }

  const body = await request.json()
  const type = body.type || 'results'

  let prompt: string

  if (type === 'contexts') {
    // ── Suggestions de contexte (étape 2) ──
    const { axeSubject, axeDescription, groupTheme } = body
    if (!axeSubject) {
      return NextResponse.json({ error: 'axeSubject manquant' }, { status: 400 })
    }

    prompt = `Tu es coach dans YAPLUKA, une application mobile de suivi post-formation professionnelle. Après une formation en présentiel, les apprenants utilisent l'appli chaque semaine pour déclarer les bonnes pratiques qu'ils ont mises en œuvre sur le terrain.

L'apprenant est en train de déclarer une nouvelle action via un chat guidé. Il a choisi son axe de progrès. On lui demande maintenant "C'était dans quel contexte ?". Tu dois lui proposer 4 contextes professionnels réalistes et variés.

L'objectif : lui faciliter la saisie en lui proposant des situations qu'il reconnaît immédiatement, pour qu'il n'ait pas à réfléchir ni à taper.

═══ DONNÉES DE L'APPRENANT ═══
Axe de progrès : "${axeSubject}"
${axeDescription ? `Précision sur l'axe : "${axeDescription}"` : ''}
${groupTheme ? `Thème de la formation suivie : "${groupTheme}"` : ''}

═══ RÈGLES ═══
1. Chaque contexte doit être une SITUATION PROFESSIONNELLE concrète où une bonne pratique liée à l'axe "${axeSubject}"${groupTheme ? ` et à la formation "${groupTheme}"` : ''} a pu être mise en œuvre.
2. Court : max 30 caractères.
3. C'est un MOMENT professionnel du type : réunion, réunion équipe, RDV Négo, RDV client, échange téléphonique, Visio, entretien 1:1, Prospection, échange informel
4. Pas de prénom, pas de nom, pas de marque.
5. Adapté au métier et au contexte de formation de l'apprenant.

═══ ANTI-EXEMPLES ═══
- "Au travail" ❌ trop vague
- "Dans un cadre professionnel" ❌ creux
- "Lors d'un échange" ❌ générique

═══ BONS EXEMPLES ═══
- "En réunion d'équipe" ✅
- "Pendant un RDV client" ✅
- "Lors d'une présentation" ✅
- "En brief du matin" ✅
- "Au téléphone avec un prospect" ✅
- "Face à un groupe" ✅

Réponds UNIQUEMENT avec un tableau JSON de 4 strings :
["...", "...", "...", "..."]`

  } else if (type === 'actions') {
    // ── Suggestions d'actions (étape 3) ──
    const { axeSubject, axeDescription, groupTheme, context } = body
    if (!axeSubject) {
      return NextResponse.json({ error: 'axeSubject manquant' }, { status: 400 })
    }

    prompt = `Tu es coach dans YAPLUKA, une application mobile de suivi post-formation professionnelle. Après une formation en présentiel, les apprenants utilisent l'appli chaque semaine pour déclarer les bonnes pratiques qu'ils ont mises en œuvre sur le terrain.

L'apprenant est en train de déclarer une nouvelle action via un chat guidé. Il a choisi son axe de progrès et son contexte. On lui demande maintenant "Qu'est-ce que tu as fait ?". Tu dois lui proposer 3 actions concrètes.

L'objectif : l'encourager en lui montrant des bonnes pratiques qu'il reconnaît, simplifier sa saisie, et l'aider à clarifier ce qu'il a fait concrètement.

═══ DONNÉES DE L'APPRENANT ═══
Axe de progrès : "${axeSubject}"
${axeDescription ? `Précision sur l'axe : "${axeDescription}"` : ''}
${groupTheme ? `Thème de la formation suivie : "${groupTheme}"` : ''}
${context ? `Contexte déclaré : "${context}"` : ''}

═══ RÈGLE N°1 — PERTINENCE ═══
Les 3 suggestions doivent être des BONNES PRATIQUES liées au thème de la formation "${groupTheme || ''}" et à l'axe "${axeSubject}". C'est le thème + l'axe + la précision + le contexte qui déterminent les suggestions. Si quelqu'un lit la suggestion sans connaître l'axe, il doit pouvoir DEVINER de quel axe il s'agit.
${axeDescription ? `Appuie-toi sur la précision donnée par l'apprenant : "${axeDescription}".` : ''}
${context ? `L'apprenant a déclaré que c'était "${context}" — adapte les suggestions à cette situation.` : ''}

═══ RÈGLE N°2 — CONCRET ═══
Chaque suggestion décrit UNE action ou une attitude, un moment réel, en lien avec les bonnes pratiques liées au thème de la formation et à l'axe de l'apprenant. Pas un concept, pas un objectif, pas une intention. Pas de notion de temps (minutes, secondes), pas de chiffres (3 questions, 2 objections), pas de prénom, pas de marque.

═══ RÈGLE N°3 — FORMAT ═══
- Commence par "J'ai"
- Max 55 caractères
- Langage oral, naturel — comme raconté à un collègue
- Pas de jargon, pas de noms de méthodes ou modèles
- Variété : une facile, une qui demande un effort, une originale

═══ ANTI-EXEMPLES ═══
- "J'ai pratiqué l'écoute active" ❌ concept, pas une action
- "J'ai travaillé ma posture" ❌ trop vague
- "J'ai mis en place une démarche" ❌ creux, bureaucratique
- "J'ai amélioré ma communication" ❌ intention, pas un geste

═══ BONS EXEMPLES ═══
- "J'ai laissé du silence après ma question" ✅
- "J'ai dit non sans me justifier" ✅
- "J'ai reformulé ce qu'il venait de dire" ✅
- "J'ai coupé mon tel pendant l'entretien" ✅
- "J'ai noté les points clés avant d'appeler" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["J'ai...", "J'ai...", "J'ai..."]`

  } else {
    // ── Suggestions de résultats (étape 4) ──
    const { action, context, axeSubject, axeDescription, groupTheme } = body
    if (!action || !context) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    prompt = `Tu es coach dans YAPLUKA, une application mobile de suivi post-formation professionnelle. Après une formation en présentiel, les apprenants utilisent l'appli chaque semaine pour déclarer les bonnes pratiques qu'ils ont mises en œuvre sur le terrain.

L'apprenant est en train de déclarer une nouvelle action via un chat guidé. Il a choisi son axe, son contexte et son action. On lui demande maintenant "Qu'est-ce que ça a donné ?". Tu dois lui proposer 3 résultats qu'il a pu observer.

L'objectif : l'aider à prendre conscience des effets positifs de sa mise en pratique, l'encourager à continuer, et simplifier sa saisie.

═══ DONNÉES DE L'APPRENANT ═══
Action déclarée : "${action}"
Contexte : "${context}"
${axeSubject ? `Axe de progrès : "${axeSubject}"` : ''}
${axeDescription ? `Précision sur l'axe : "${axeDescription}"` : ''}
${groupTheme ? `Thème de la formation : "${groupTheme}"` : ''}

═══ RÈGLE N°1 — SPÉCIFICITÉ ═══
Chaque résultat doit être un EFFET BÉNÉFIQUE de la mise en œuvre de "${action}" dans le contexte "${context}", en lien avec l'axe "${axeSubject || ''}" et la formation "${groupTheme || ''}". C'est les 5 données réunies (thème + axe + précision + contexte + action) qui déterminent les résultats. Si on change l'action ou le contexte, le résultat ne doit PLUS fonctionner.

═══ RÈGLE N°2 ═══
C'est ce que la personne a observé (réaction des autres), ressenti (son propre ressenti) ou obtenu (effet mesurable). Ces éléments sont des effets bénéfiques issus des bonnes pratiques vues en formation, et mises en œuvre par l'apprenant. Pas de geste/regard/moue d'un interlocuteur, pas de prénom, pas de marque, pas de timing précis (minutes, secondes).

═══ RÈGLE N°3 — FORMAT ═══
- Max 60 caractères
- 3 angles différents : réaction des autres / ressenti perso / résultat obtenu
- Langage oral, vivant
- Pas de jargon

═══ ANTI-EXEMPLES ═══
- "Ça s'est bien passé" ❌ passe-partout
- "L'échange a été constructif" ❌ creux
- "J'ai vu une amélioration" ❌ vague
- "La communication était meilleure" ❌ générique

═══ BONS EXEMPLES ═══
- "Plus d'ouverture et d'informations reçues" ✅
- "On a bouclé plus rapidement" ✅
- "J'étais moins stressé que d'habitude" ✅
- "Il m'a posé des questions" ✅
- "Il a accepté ma proposition" ✅
- "Il a réagi positivement" ✅

Réponds UNIQUEMENT avec un tableau JSON de 3 strings :
["...", "...", "..."]`
  }

  // Haiku pour les contextes (rapide, suffisant), Sonnet pour actions/résultats (qualité)
  const model = type === 'contexts'
    ? 'claude-3-5-haiku-20241022'
    : 'claude-sonnet-4-20250514'
  const max_tokens = type === 'contexts' ? 150 : 300

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
        max_tokens,
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
