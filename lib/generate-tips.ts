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

  // Construire les blocs contextuels conditionnels
  const actionBlock = ctx.recentActions.length > 0
    ? `ACTIONS RECENTES sur cet axe (${ctx.actionCount} au total) :
${ctx.recentActions.slice(0, 5).map((a, i) => `  ${i + 1}. "${a}"`).join('\n')}
→ Fais reference a au moins une de ces actions dans ton conseil (cite-la naturellement).`
    : `Pas encore d'action sur cet axe. Propose un premier pas tres simple et encourageant.`

  const weatherBlock = ctx.lastWeather
    ? `METEO DECLAREE : ${WEATHER_LABELS[ctx.lastWeather] || ctx.lastWeather} (tendance ${ctx.weatherTrend})
${ctx.whatWorked ? `  - Ce qui a marche : "${ctx.whatWorked}"` : ''}
${ctx.difficulties ? `  - Difficulte exprimee : "${ctx.difficulties}"` : ''}
→ Adapte ton ton a cette meteo. Si stormy : empathie + petit pas. Si cloudy : encourager. Si sunny : challenger doucement.
${ctx.difficulties ? `→ Fais reference a la difficulte exprimee dans ton conseil, avec bienveillance.` : ''}`
    : ''

  const prompt = `Tu es un coach bienveillant et pragmatique en formation professionnelle. Tu tutoies l'apprenant dans le RAPPEL et dans le CONSEIL. Ton oral, naturel, bien ecrit. Tu encourages sans etre mielleux. Tu ne juges JAMAIS — meme si l'apprenant n'a pas fait grand-chose, tu restes positif et tu proposes un petit pas accessible.

IMPORTANT SUR LE TON :
- JAMAIS de formulations qui pointent un manque ("tu n'as rien fait", "sans check-in, sans premier pas", "tu decroches", "desengagement"). C'est culpabilisant.
- JAMAIS de "mais" qui annule ce qui precede ("c'est bien, MAIS...")
- Si l'apprenant a peu agi : propose simplement un premier geste, sans souligner ce qui n'a pas ete fait
- Si la meteo est mauvaise : empathie d'abord, puis une suggestion douce
- Ton de grand frere/grande soeur qui a de l'experience, pas de prof qui corrige

FORMATION : "${ctx.groupTheme}"
AXE TRAVAILLE : "${ctx.axeSubject}" (${ctx.axeDescription})

APPRENANT : ${ctx.firstName}, semaine ${ctx.weekInProgram}
${ctx.totalActions > 0 ? `- ${ctx.totalActions} actions au total, regularite ${ctx.regularityPct}%` : '- En phase de demarrage'}
${ctx.checkinStreak > 0 ? `- ${ctx.checkinStreak} check-in(s) consecutif(s)` : ''}
${ctx.likesReceived > 0 ? `- ${ctx.likesReceived} like(s) recu(s) sur ses actions` : ''}

${actionBlock}

${weatherBlock}

${ctx.previousTips.length > 0 ? `TIPS DEJA ENVOYES (ne PAS reprendre ces sujets) :
${ctx.previousTips.map((t, i) => `${i + 1}. [S.${t.week}${t.acted ? ' ✅' : ''}] ${t.content}`).join('\n')}` : ''}

GENERE UN TIP :

RAPPEL (2-3 phrases, tutoiement) : Un principe ou une idee cle de la formation, en lien avec ce que vit ${ctx.firstName}. Reformule avec tes mots, pas de citation inventee. Le rappel doit resonner avec la situation de l'apprenant (ses actions, sa meteo, ses difficultes) sans pointer ce qui manque.

CONSEIL (max 500 car., tutoiement) : UNE action precise faisable aujourd'hui. Ancre ton conseil dans un element concret du contexte de ${ctx.firstName} — une action qu'il a faite, ce qui a marche pour lui, ou sa situation actuelle. Propose quelque chose de DIFFERENT de ce qu'il a deja fait.

REGLES :
- Tutoiement partout (rappel ET conseil)
- NE PAS utiliser le prenom de l'apprenant dans le rappel ni le conseil
- NE JAMAIS citer de chiffres negatifs (0 actions, 0%, semaine X sans rien)
- NE JAMAIS citer de theoriciens/frameworks sauf : Triangle toxique, DESC, OSBD, DISC, Drivers de Berne
- Sujet different des tips precedents
- Ton chaleureux et encourageant, jamais culpabilisant

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

    // Supprimer un eventuel tip non envoye sur le meme axe+semaine
    // (contrainte unique axe_id+week_number, tips batch pourraient occuper le slot)
    await supabaseAdmin
      .from('tips')
      .delete()
      .eq('axe_id', ctx.axeId)
      .eq('week_number', weekNumber)
      .eq('sent', false)

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

    console.log(`[Tips] Tip genere pour learner ${ctx.learnerId.slice(0, 8)} / axe ${ctx.axeId.slice(0, 8)} (S.${weekNumber})`)
    return { id: inserted.id, content, advice }
  } catch (err) {
    console.error('[Tips] Erreur generation personnalisee:', err)
    return null
  }
}
