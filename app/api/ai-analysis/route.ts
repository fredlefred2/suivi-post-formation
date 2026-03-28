export const runtime = 'edge'

import { NextRequest, NextResponse } from 'next/server'
import type { GroupReportData } from '@/lib/pdf/group-report'
import type { AIReportAnalysis } from '@/lib/pdf/ai-analysis'

export async function POST(request: NextRequest) {
  try {
    const data: GroupReportData = await request.json()

    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Clé API manquante' }, { status: 500 })
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
          actions: (l.axeActions[i] ?? []).slice(0, 6),
        })),
        whatWorked: l.whatWorked,
        difficulties: l.difficulties,
        weatherTrend: l.weatherHistory.map(w => w.weather).join(' → '),
      }
    })

    const prompt = `Tu rédiges l'analyse d'un rapport de suivi post-formation. Ce rapport est destiné au MANAGER des participants (pas au formateur).

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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[AI Analysis] Claude API error:', response.status, errText)
      return NextResponse.json({ error: 'Erreur API Claude' }, { status: 500 })
    }

    const result = await response.json()
    const text = result.content?.[0]?.text || ''

    // Extraire le JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Réponse invalide' }, { status: 500 })
    }

    const analysis: AIReportAnalysis = JSON.parse(jsonMatch[0])

    if (!analysis.groupSummary || !analysis.learnerAnalyses || !analysis.alerts) {
      return NextResponse.json({ error: 'Réponse incomplète' }, { status: 500 })
    }

    return NextResponse.json(analysis)
  } catch (err) {
    console.error('[AI Analysis] Erreur:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
