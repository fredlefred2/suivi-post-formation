import type { GroupReportData } from './group-report'

// ── Types retournés par l'analyse IA ──

export type LearnerAIAnalysis = {
  learnerId: string
  /** Ce que l'apprenant met en pratique sur le terrain (2-3 phrases, langage manager) */
  practice: string
  /** Ce qui reste à travailler (1-2 phrases) */
  toImprove: string
  /** Comment le manager peut l'aider (2-3 actions concrètes) */
  managerActions: string[]
}

export type AlertLevel = 'red' | 'yellow' | 'green'

export type LearnerAlert = {
  learnerId: string
  learnerName: string
  level: AlertLevel
  message: string
}

export type AIReportAnalysis = {
  /** Synthèse narrative du groupe pour le manager (3-5 phrases) */
  groupSummary: string
  /** Analyse individuelle par apprenant */
  learnerAnalyses: LearnerAIAnalysis[]
  /** Alertes triées par gravité */
  alerts: LearnerAlert[]
  /** Recommandations pour le manager (3-4 items) */
  managerRecommendations: string[]
}

// ── Fonction d'appel Claude ──

export async function generateAIAnalysis(data: GroupReportData): Promise<AIReportAnalysis | null> {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    console.error('[AI Report] CLAUDE_API_KEY manquante')
    return null
  }

  // Construire le contexte pour Claude
  const learnersContext = data.learners.map((l) => {
    const totalWeathers = l.weatherSummary.sunny + l.weatherSummary.cloudy + l.weatherSummary.stormy
    const climatScore = totalWeathers > 0
      ? ((l.weatherSummary.sunny * 5 + l.weatherSummary.cloudy * 3 + l.weatherSummary.stormy * 1) / totalWeathers).toFixed(1)
      : 'aucun check-in'

    return {
      id: l.id,
      name: `${l.firstName} ${l.lastName}`,
      totalActions: l.totalActions,
      weeksSinceJoin: l.weeksSinceJoin,
      regularityPct: l.regularityPct,
      climatScore,
      axes: l.axes.map((axe, i) => ({
        subject: axe,
        actionCount: l.axeActionCounts[i] ?? 0,
        actions: (l.axeActions[i] ?? []).slice(0, 6), // max 6 pour limiter les tokens
      })),
      whatWorked: l.whatWorked,
      difficulties: l.difficulties,
      weatherTrend: l.weatherHistory.map(w => w.weather).join(' → '),
    }
  })

  const prompt = `Tu rédiges l'analyse IA d'un rapport de suivi post-formation. Ce rapport est destiné au MANAGER des participants (pas au formateur).

Le manager :
- N'est pas expert en pédagogie ni en techniques de formation
- Veut comprendre l'implication et les progrès concrets de ses collaborateurs
- Veut savoir comment il peut soutenir la démarche au quotidien
- Lit ce rapport en 5 minutes max

## DONNÉES DU GROUPE

Groupe : ${data.groupName}
Participants : ${data.participantCount}
Actions totales : ${data.totalActions}
Régularité moyenne : ${data.groupRegularityPct}%
Climat moyen : ${data.groupClimatScore !== undefined ? data.groupClimatScore.toFixed(1) + '/5' : 'non disponible'}
Durée du suivi : ${data.learners[0]?.weeksSinceJoin ?? 0} semaines

## DONNÉES PAR PARTICIPANT

${JSON.stringify(learnersContext, null, 2)}

## CE QUE TU DOIS PRODUIRE

Réponds UNIQUEMENT avec un objet JSON (pas de texte autour) avec cette structure :

{
  "groupSummary": "Synthèse en 3-5 phrases. Ton factuel et professionnel. Pas de jargon formation. Mentionne ce qui va bien, ce qui reste à travailler, et la tendance générale.",
  "learnerAnalyses": [
    {
      "learnerId": "id du participant",
      "practice": "Ce qu'il met en pratique sur le terrain en 2-3 phrases. Traduis les actions en comportements observables par le manager. Pas de jargon.",
      "toImprove": "Ce qui reste à travailler en 1-2 phrases. Factuel, pas accusateur.",
      "managerActions": ["Action concrète 1 pour le manager", "Action concrète 2", "Action concrète 3"]
    }
  ],
  "alerts": [
    {
      "learnerId": "id",
      "learnerName": "Prénom Nom",
      "level": "red|yellow|green",
      "message": "Message court pour le manager"
    }
  ],
  "managerRecommendations": ["Recommandation 1", "Recommandation 2", "Recommandation 3"]
}

## RÈGLES

- Pas de jargon formation (pas de CABP, DISC, objection isolée, etc.)
- Traduis chaque compétence en comportement observable sur le terrain
- Les recommandations doivent être actionnables par un manager, pas par un formateur
- Ton professionnel, factuel, bienveillant
- Quand un collaborateur est en difficulté, ne pas alarmer mais donner des clés concrètes
- Alertes : red = inactif ou en difficulté sérieuse, yellow = progression partielle ou point de vigilance, green = bonne dynamique à valoriser
- Chaque participant doit avoir exactement 1 alerte et 1 analyse
- Les managerActions doivent être des phrases que le manager peut appliquer dès cette semaine`

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
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('[AI Report] Claude API error:', response.status, await response.text())
      return null
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || ''

    // Extraire le JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[AI Report] Impossible de parser la réponse:', text)
      return null
    }

    const analysis: AIReportAnalysis = JSON.parse(jsonMatch[0])

    // Validation basique
    if (!analysis.groupSummary || !analysis.learnerAnalyses || !analysis.alerts) {
      console.error('[AI Report] Réponse incomplète:', analysis)
      return null
    }

    return analysis
  } catch (err) {
    console.error('[AI Report] Erreur:', err)
    return null
  }
}
