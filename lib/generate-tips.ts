import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface GenerateTipsParams {
  axeId: string
  learnerId: string
  axeSubject: string
  axeDescription: string
  groupTheme: string
  /** Nombre de tips à générer (default: 5) */
  count?: number
  /** Numéro de semaine de départ (default: 1) */
  startWeek?: number
  /** Si true, ignore la vérification "tips déjà existants" */
  force?: boolean
}

/**
 * Appelle Claude API pour générer 10 micro-défis hebdomadaires
 * et les stocke dans la table tips.
 */
export async function generateTips({
  axeId,
  learnerId,
  axeSubject,
  axeDescription,
  groupTheme,
  count = 5,
  startWeek = 1,
  force = false,
}: GenerateTipsParams): Promise<void> {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    console.error('[Tips] CLAUDE_API_KEY manquante')
    return
  }

  // Ne pas regénérer si des tips existent déjà pour cet axe (sauf si force=true)
  if (!force) {
    const { data: existing } = await supabaseAdmin
      .from('tips')
      .select('id')
      .eq('axe_id', axeId)
      .limit(1)

    if (existing && existing.length > 0) return
  }

  const prompt = `Tu es un coach en formation professionnelle. Tu as une approche pragmatique, opérationnelle, concrète et encourageante, sans être exagérément enthousiaste. Tu accompagnes un apprenant qui suit une formation, en vue d'ancrer des acquis et de le motiver à mener des actions. Tu vas mettre en place des conseils coaching pour lui ou elle, afin d'une part de lui rappeler des éléments vus en formation, et lui donner des conseils ultra personnalisés.
Le thème et le contenu de la formation portait sur "${groupTheme}"
L'apprenant travaille sur l'axe de progrès suivant :
- Intitulé : "${axeSubject}"
- Description : "${axeDescription}"

Génère exactement ${count} rappels hebdomadaires, chacun composé de :
1. Un RAPPEL ("Le tip") : un principe ou une bonne pratique vue en formation, décrit en un proverbe imaginaire / citation imaginaire / punchline. Le ton sera soit provocant, soit amusant. L'objectif est de déclencher l'attention immédiate par la surprise.
2. Un CONSEIL : une mise en pratique concrète pour la semaine, en 1-2 phrases (max 300 caractères). Actionnable en 1 journée de travail. Un truc SMART, mais que tu ne décomposes pas comme tel à la lettre.

Règles :
- Tutoiement. Ton et style plutôt oral mais bien écrit.
- L'apprenant a déjà vu l'essentiel de ce qui est précisé dans le thème de la formation, donc on n'annonce pas des évidences, mais des choses qui tiennent bien compte de ce qu'il sait déjà. En un mot, ce n'est pas seulement des rappels, c'est des rappels avec un petit truc en plus.
- Progressif : semaine 1 = principe de base et action simple, semaine ${count} = principe avancé et mise en pratique ambitieuse
- Concret, spécifique et opérationnel (pas de généralités) et si possible, adapté à ce que l'axe de travail choisi peut dire de la personne (si tu as un doute sur ce point, tu laisses tomber)
- Adapté au contexte professionnel en fonction des détails que tu as sur le thème de la formation.
- NE JAMAIS citer de noms de modèles, frameworks, auteurs ou théoriciens (pas de "Fenêtre de Johari", pas de "Porter", pas de "Hersey & Blanchard", etc.). Les seuls tolérés, ponctuellement, sont : Triangle toxique, DESC, OSBD, DISC, Drivers de Berne
- Décris l'idée avec des mots simples, sur un ton léger mais pas familier, volontiers un peu provocant mais jamais agressif.
- Chaque rappel aborde un sujet bien distinct. Pas plusieurs rappels sur le même sujet.

Réponds UNIQUEMENT avec un tableau JSON, sans aucun texte avant ou après :
[{"rappel": "...", "conseil": "..."}, ...]`

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
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('[Tips] Claude API error:', response.status, await response.text())
      return
    }

    const data = await response.json()
    const text = data.content?.[0]?.text || ''

    // Extraire le JSON du texte
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[Tips] Impossible de parser les tips:', text)
      return
    }

    const tips: Array<{ rappel: string; conseil: string } | string> = JSON.parse(jsonMatch[0])
    if (!Array.isArray(tips) || tips.length === 0) {
      console.error('[Tips] Tips vides ou invalides:', tips)
      return
    }

    // Insérer les tips en base (max count)
    const rows = tips.slice(0, count).map((tip, i) => {
      const isNew = typeof tip === 'object' && tip.rappel
      return {
        axe_id: axeId,
        learner_id: learnerId,
        week_number: startWeek + i,
        content: isNew ? (tip as any).rappel.trim() : String(tip).trim(),
        advice: isNew ? (tip as any).conseil.trim() : null,
      }
    })

    const { error } = await supabaseAdmin.from('tips').insert(rows)
    if (error) {
      console.error('[Tips] Erreur insertion:', error.message)
    } else {
      console.log(`[Tips] ${rows.length} tips générés pour axe ${axeId}`)
    }
  } catch (err) {
    console.error('[Tips] Erreur génération:', err)
  }
}

// ──────────────────────────────────────────────────────────────────
// Generation personnalisee : 1 tip a la fois, contexte complet
// ──────────────────────────────────────────────────────────────────

import type { LearnerTipContext } from './gather-learner-context'

const WEATHER_LABELS: Record<string, string> = {
  sunny: 'au beau fixe (sunny)',
  cloudy: 'mitigee (cloudy)',
  stormy: 'difficile (stormy)',
}

/**
 * Genere UN tip personnalise a partir du contexte complet de l'apprenant.
 * Retourne le tip insere ou null en cas d'erreur.
 */
export async function generatePersonalizedTip(
  ctx: LearnerTipContext,
  weekNumber: number
): Promise<{ id: string; content: string; advice: string | null } | null> {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    console.error('[Tips] CLAUDE_API_KEY manquante')
    return null
  }

  // Interpretations calculees
  const regularityComment = ctx.regularityPct >= 75
    ? 'Tres regulier, il maintient le rythme.'
    : ctx.regularityPct >= 40
    ? 'Regularite moyenne, il a besoin d\'etre relance.'
    : 'Peu regulier, il decroche ou demarre a peine.'

  const engagementComment = ctx.checkinStreak >= 3
    ? `Bonne dynamique : ${ctx.checkinStreak} check-ins consecutifs.`
    : ctx.checkinStreak === 0
    ? 'Aucun check-in recent, desengagement possible.'
    : `Engagement fragile : seulement ${ctx.checkinStreak} check-in(s) recent(s).`

  const socialComment = (ctx.likesReceived + ctx.commentsReceived) > 3
    ? 'Bien integre socialement (likes/commentaires recus).'
    : 'Peu d\'interactions sociales sur ses actions.'

  const prompt = `Tu es un coach en formation professionnelle. Approche pragmatique, operationnelle, concrete et encourageante — sans etre exagerement enthousiaste. Tutoiement, ton oral mais bien ecrit.

CONTEXTE FORMATION :
- Theme de la formation : "${ctx.groupTheme}"
- Axe de progres travaille : "${ctx.axeSubject}"
- Description de l'axe : "${ctx.axeDescription}"

CONTEXTE APPRENANT (${ctx.firstName}) :
- Semaine ${ctx.weekInProgram} dans le programme
- ${ctx.actionCount} action(s) sur cet axe, ${ctx.totalActions} au total
${ctx.recentActions.length > 0 ? `- Dernieres actions : ${ctx.recentActions.slice(0, 5).join(' | ')}` : '- Aucune action enregistree sur cet axe'}
- Regularite : ${ctx.regularityPct}% → ${regularityComment}
- ${engagementComment}
- ${socialComment}
${ctx.lastWeather ? `- Derniere meteo declaree : ${WEATHER_LABELS[ctx.lastWeather] || ctx.lastWeather} (tendance ${ctx.weatherTrend})` : '- Pas de meteo declaree'}
${ctx.whatWorked ? `- Ce qui a marche recemment : "${ctx.whatWorked}"` : ''}
${ctx.difficulties ? `- Difficultes exprimees : "${ctx.difficulties}"` : ''}

${ctx.previousTips.length > 0 ? `TIPS PRECEDENTS (NE PAS reprendre les memes sujets) :
${ctx.previousTips.map((t, i) => `${i + 1}. [S.${t.week}${t.acted ? ' ✅' : ''}] ${t.content}`).join('\n')}` : 'Aucun tip precedent.'}

GENERE UN TIP compose de :
1. RAPPEL : une idee cle liee a la formation, reformulee avec tes mots. Pas de citation inventee ni de punchline artificielle. C'est un rappel qui fait mouche parce qu'il est pertinent par rapport a ce que vit l'apprenant.
2. CONSEIL : Max 500 caracteres. Actionnable en 1 journee de travail. Tiens compte de ce que l'apprenant a deja fait (ou pas fait), de sa meteo, de ses difficultes.

REGLES :
- NE JAMAIS citer de noms de modeles, frameworks, auteurs ou theoriciens sauf : Triangle toxique, DESC, OSBD, DISC, Drivers de Berne
- Chaque tip doit aborder un sujet different des precedents
- Le conseil doit etre specifique et contextuali, pas generique

Reponds UNIQUEMENT en JSON : {"rappel": "...", "conseil": "..."}`

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
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[Tips] Claude API error:', response.status, errText)
      return null
    }

    const data = await response.json()
    const text = data.content?.[0]?.text?.trim() || ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[Tips] Impossible de parser le tip:', text)
      return null
    }

    const parsed = JSON.parse(jsonMatch[0])
    const content = (parsed.rappel || '').trim()
    const advice = (parsed.conseil || '').trim() || null

    if (!content) {
      console.error('[Tips] Contenu vide')
      return null
    }

    // Annuler tout autre next_scheduled pour cet apprenant
    await supabaseAdmin
      .from('tips')
      .update({ next_scheduled: false })
      .eq('learner_id', ctx.learnerId)
      .eq('next_scheduled', true)

    // Inserer le tip
    const { data: inserted, error } = await supabaseAdmin
      .from('tips')
      .insert({
        axe_id: ctx.axeId,
        learner_id: ctx.learnerId,
        week_number: weekNumber,
        content,
        advice,
        next_scheduled: true,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Tips] Erreur insertion:', error.message)
      return null
    }

    console.log(`[Tips] Tip personnalise genere pour ${ctx.firstName} / axe ${ctx.axeSubject} (S.${weekNumber})`)
    return { id: inserted.id, content, advice }
  } catch (err) {
    console.error('[Tips] Erreur generation personnalisee:', err)
    return null
  }
}
