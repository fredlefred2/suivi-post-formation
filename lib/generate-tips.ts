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
import { getCurrentLevel, getNextLevel } from './axeHelpers'

const WEATHER_LABELS: Record<string, string> = {
  sunny: 'au beau fixe (sunny)',
  cloudy: 'mitigee (cloudy)',
  stormy: 'difficile (stormy)',
}

/**
 * Genere UN tip personnalise a partir du contexte complet de l'apprenant.
 * Format : mantra (punchline) + action (geste) + example (mise en scène).
 * Retourne le tip insere ou null en cas d'erreur.
 */
export async function generatePersonalizedTip(
  ctx: LearnerTipContext,
  weekNumber: number
): Promise<{ id: string; content: string; advice: string | null; example: string | null } | null> {
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

  // Niveau actuel + prochain palier sur cet axe (pour adapter le défi)
  const currentLevel = getCurrentLevel(ctx.actionCount)
  const nextLevel = getNextLevel(ctx.actionCount)
  const levelBlock = nextLevel
    ? `NIVEAU SUR CET AXE : ${currentLevel.icon} ${currentLevel.label} (${ctx.actionCount} action(s))
PROCHAIN PALIER : ${nextLevel.icon} ${nextLevel.label} — ${nextLevel.delta} action(s) de plus`
    : `NIVEAU SUR CET AXE : ${currentLevel.icon} ${currentLevel.label} (niveau max atteint)`

  const prompt = `Tu es un coach qui connaît cet apprenant en détail. Tu vas lui générer UN tip COURT, PERCUTANT et ULTRA-PERSONNALISÉ en 3 parties.

Réponds UNIQUEMENT en JSON valide :
{
  "mantra": "60-100 caractères. Un proverbe, une maxime, une punchline qui CLAQUE. Images, paradoxes, formules qui restent en tête. ZÉRO explication. Pas de 'il faut', 'tu dois', 'c'est important'.",
  "action": "120-180 caractères. UN geste précis pour CETTE SEMAINE. Commence par un verbe. Ancre dans son contexte métier (son rôle, son équipe, son type de client) sans citer de nom propre.",
  "example": "200-400 caractères. Un mini-scénario qui MONTRE l'action en situation réelle. Dialogues plausibles entre crochets, enchaînement clair. Le lecteur doit se dire 'ah ouais, je vois exactement comment faire'."
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CONTEXTE DE L'APPRENANT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FORMATION : "${ctx.groupTheme}"

AXE TRAVAILLÉ : "${ctx.axeSubject}"
${ctx.axeDescription ? `Description : ${ctx.axeDescription}` : ''}

${levelBlock}

ENGAGEMENT GLOBAL :
${ctx.totalActions > 0 ? `- ${ctx.totalActions} actions au total, régularité ${ctx.regularityPct}%` : '- En phase de démarrage'}
${ctx.checkinStreak > 0 ? `- ${ctx.checkinStreak} check-in(s) consécutif(s)` : ''}
${ctx.likesReceived > 0 ? `- ${ctx.likesReceived} like(s) reçu(s) de ses coéquipiers` : ''}

${actionBlock}

${weatherBlock}

${ctx.previousTips.length > 0 ? `TIPS DÉJÀ ENVOYÉS (sujet DIFFÉRENT !) :
${ctx.previousTips.map((t, i) => `  ${i + 1}. [S.${t.week}${t.acted ? ' ✅' : ''}] ${t.content}`).join('\n')}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RÈGLES D'OR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. MANTRA — surprenant, évocateur, zéro banalité. Format proverbe / aphorisme.

2. ACTION & EXEMPLE — réutilise les TYPES de situations citées par l'apprenant (son rôle, ses types d'interactions, contexte métier) MAIS :
   ❌ JAMAIS de noms propres spécifiques : noms de collaborateurs, clients, enseignes, marques de produits, lieux nommés.
   ✅ Utilise : "un collaborateur", "une collègue", "un client", "un chef de rayon", "ton équipe", "une personne de ton service", "un interlocuteur".

3. ADAPTATION AU CONTEXTE :
   - Météo stormy → empathie + tout petit pas, jamais de challenge
   - Météo sunny + progression rapide → pousser, challenger
   - Difficulté exprimée → l'aborder de biais dans l'exemple (jamais pointer directement)
   - Ce qui a marché → capitaliser dessus, pas "mais essaie aussi"
   - Apprenant qui démarre (Intention / Essai) → première brique ultra simple et accessible
   - Apprenant avancé (Réflexe / Maîtrise) → sophistiquer, proposer une subtilité

4. INTERDITS STRICTS :
   - Aucun post-it, "écris sur un bout de papier", "note dans ton agenda", "prépare une fiche", "fais-toi un mémo" — on veut des actions OPÉRATIONNELLES en situation réelle, pas des astuces de bureau.
   - Pas de prénom (ni de l'apprenant ni de qui que ce soit)
   - Pas de jargon théorique (exceptions tolérées : DESC, OSBD, DISC, Triangle toxique, Drivers de Berne, SMART).
   - Jamais culpabilisant, jamais de "malgré que", "mais tu n'as pas", "tu décroches"
   - Pas de chiffres négatifs (0 action, 0%, etc.)

5. Sujet DIFFÉRENT des tips déjà envoyés listés plus haut.

6. Tutoiement partout. Ton : grand frère / grande sœur qui a de l'expérience.

7. EXEMPLE — les paroles ou phrases "qu'on dirait" doivent être entre guillemets français « ... » (typographie FR correcte ET compatibles JSON). N'utilise JAMAIS de guillemets droits "..." à l'intérieur du champ example, ça casse le parsing.

Rappel FORMAT JSON : uniquement les 3 champs mantra, action, example. Pas de préambule, pas de markdown.`

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
    // Nouveau format (mantra/action/example) avec compat ascendante pour l'ancien (rappel/conseil)
    const mantra = (parsed.mantra || parsed.rappel || '').trim()
    const action = (parsed.action || parsed.conseil || '').trim() || null
    const example = (parsed.example || '').trim() || null

    if (!mantra) {
      console.error('[Tips] Mantra vide')
      return null
    }

    // Les 3 champs sont persistés sous :
    //   content = mantra  (compatibilité schéma existant)
    //   advice  = action
    //   example = example (nouvelle colonne)
    const content = mantra
    const advice = action

    // Règle V1.30.1 : 1 SEUL tip "en attente d'envoi" par apprenant par semaine,
    // peu importe l'axe. Avant d'insérer, on wipe tous les tips non-envoyés de
    // cet apprenant pour cette semaine (n'importe quel axe). Les tips déjà
    // envoyés (sent=true) ne sont JAMAIS touchés (historique préservé).

    // Protection : si un tip est déjà sorti (sent=true) pour ce learner+semaine,
    // on n'écrase pas — on annule la génération.
    const { data: alreadySent } = await supabaseAdmin
      .from('tips')
      .select('id')
      .eq('learner_id', ctx.learnerId)
      .eq('week_number', weekNumber)
      .eq('sent', true)
      .limit(1)
      .maybeSingle()

    if (alreadySent) {
      console.error(`[Tips] Un tip a déjà été envoyé à ${ctx.learnerId.slice(0, 8)} en S.${weekNumber} — annulation`)
      return null
    }

    // Wipe les tips en attente du même apprenant pour cette semaine (tous axes)
    await supabaseAdmin
      .from('tips')
      .delete()
      .eq('learner_id', ctx.learnerId)
      .eq('week_number', weekNumber)
      .eq('sent', false)

    // Insert du nouveau tip (slot unique garanti par l'index partiel DB)
    const { data: inserted, error } = await supabaseAdmin
      .from('tips')
      .insert({
        axe_id: ctx.axeId,
        learner_id: ctx.learnerId,
        week_number: weekNumber,
        content,
        advice,
        example,
        sent: false,
        acted: false,
        next_scheduled: true,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      console.error('[Tips] Erreur insert:', error?.message)
      return null
    }

    console.log(`[Tips] Tip genere pour learner ${ctx.learnerId.slice(0, 8)} / axe ${ctx.axeId.slice(0, 8)} (S.${weekNumber})`)
    return { id: inserted.id, content, advice, example }
  } catch (err) {
    console.error('[Tips] Erreur generation personnalisee:', err)
    return null
  }
}
