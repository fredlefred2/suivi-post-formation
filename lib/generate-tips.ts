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

  const prompt = `Tu es un coach en formation professionnelle. Tu accompagnes un apprenant qui suit une formation "${groupTheme}".

Il travaille sur l'axe de progrès suivant :
- Intitulé : "${axeSubject}"
- Description : "${axeDescription}"

Génère exactement ${count} rappels hebdomadaires, chacun composé de :
1. Un RAPPEL ("le savais-tu ?") : un principe ou une bonne pratique vue en formation, expliqué concrètement en 2-3 phrases (max 200 caractères). Décris l'idée de manière opérationnelle et accessible.
2. Un CONSEIL : une mise en pratique concrète pour la semaine, en 1-2 phrases (max 200 caractères). Actionnable en 1 journée de travail.

Règles :
- Tutoiement
- Progressif : semaine 1 = principe de base et action simple, semaine ${count} = principe avancé et mise en pratique ambitieuse
- Concret, spécifique et opérationnel (pas de généralités)
- Adapté au contexte professionnel et managérial
- NE JAMAIS citer de noms de modèles, frameworks, auteurs ou théoriciens (pas de "Fenêtre de Johari", pas de "Porter", pas de "Hersey & Blanchard", pas de "DESC", etc.). Décris l'idée avec tes propres mots, de manière simple et directe.

Réponds UNIQUEMENT avec un tableau JSON, sans aucun texte avant ou après :
[{"rappel": "...", "conseil": "..."}, {"rappel": "...", "conseil": "..."}, ...]`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
