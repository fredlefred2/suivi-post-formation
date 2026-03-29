export const runtime = 'edge'

import { NextRequest } from 'next/server'
import type { GroupReportData } from '@/lib/pdf/report-types'

export async function POST(request: NextRequest) {
  try {
    const data: GroupReportData = await request.json()

    const apiKey = process.env.CLAUDE_API_KEY
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Clé API manquante' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Construire le contexte pour Claude (compact)
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
          actions: (l.axeActions[i] ?? []).slice(0, 4),
        })),
        whatWorked: l.whatWorked.slice(0, 3),
        difficulties: l.difficulties.slice(0, 3),
        weatherTrend: l.weatherHistory.slice(-6).map(w => w.weather).join(' → '),
      }
    })

    const prompt = `Tu rédiges l'analyse d'un rapport de suivi post-formation pour le MANAGER des participants.

## DONNÉES
Groupe : ${data.groupName} | ${data.participantCount} participants | ${data.totalActions} actions | Régularité ${data.groupRegularityPct}% | Climat ${data.groupClimatScore !== undefined ? data.groupClimatScore.toFixed(1) + '/5' : 'N/A'} | ${data.learners[0]?.weeksSinceJoin ?? 0} semaines

## PARTICIPANTS
${JSON.stringify(learnersContext)}

## PRODUIS CE JSON (rien d'autre)
{
  "groupSummary": "3-4 phrases courtes, factuel, pro",
  "learnerAnalyses": [{"learnerId":"id","practice":"2 phrases max","toImprove":"1 phrase","managerActions":["Action 1","Action 2"]}],
  "alerts": [{"learnerId":"id","learnerName":"Nom","level":"red|yellow|green","message":"Court"}],
  "managerRecommendations": ["Reco 1","Reco 2","Reco 3"]
}

RÈGLES : concis, pas de jargon formation, comportements observables, bienveillant. red=inactif, yellow=vigilance, green=positif. 1 alerte+1 analyse par participant.`

    // Appel Claude en STREAMING
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        stream: true,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!claudeRes.ok) {
      const errText = await claudeRes.text()
      console.error('[AI Analysis] Claude API error:', claudeRes.status, errText)
      return new Response(JSON.stringify({ error: 'Erreur API Claude' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Streamer la réponse vers le client pour éviter le timeout Edge 30s
    // On forward les text deltas de Claude, le client assemblera le JSON
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = claudeRes.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const jsonStr = line.slice(6).trim()
                if (jsonStr === '[DONE]') continue

                try {
                  const event = JSON.parse(jsonStr)
                  if (event.type === 'content_block_delta' && event.delta?.text) {
                    // Envoyer le delta de texte au client
                    controller.enqueue(encoder.encode(event.delta.text))
                  }
                } catch {
                  // Ignorer les lignes non-JSON
                }
              }
            }
          }
        } catch (err) {
          console.error('[AI Analysis] Stream error:', err)
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    })
  } catch (err) {
    console.error('[AI Analysis] Erreur:', err)
    return new Response(JSON.stringify({ error: 'Erreur serveur' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
