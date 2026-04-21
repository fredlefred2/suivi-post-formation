import { supabaseAdmin } from './supabase-admin'
import { QUIZ_QUESTIONS_PER_QUIZ } from './types'

type GeneratedQuestion = {
  type: 'qcm' | 'truefalse'
  question: string
  choices: string[]
  correct_index: number
  explanation: string
}

/**
 * Génère 4 questions de quiz pour un groupe via Claude et les stocke.
 * Idempotent : si un quiz existe déjà pour (group_id, week, year), retourne null.
 * Utiliser `force=true` pour régénérer (remplace les questions existantes).
 */
export async function generateQuizForGroup({
  groupId,
  theme,
  weekNumber,
  year,
  force = false,
}: {
  groupId: string
  theme: string
  weekNumber: number
  year: number
  force?: boolean
}): Promise<{ quizId: string; questions: number } | null> {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    console.error('[Quiz] CLAUDE_API_KEY manquante')
    return null
  }

  // Un quiz existe déjà ?
  const { data: existing } = await supabaseAdmin
    .from('quizzes')
    .select('id')
    .eq('group_id', groupId)
    .eq('week_number', weekNumber)
    .eq('year', year)
    .maybeSingle()

  if (existing && !force) {
    console.log(`[Quiz] Déjà généré pour group=${groupId.slice(0, 8)} S${weekNumber}/${year}`)
    return null
  }

  const questions = await callClaudeForQuestions({ theme, weekNumber, apiKey })
  if (!questions) return null

  // Upsert le quiz (idempotent sur group+week+year)
  const { data: quiz, error: quizErr } = await supabaseAdmin
    .from('quizzes')
    .upsert(
      {
        group_id: groupId,
        week_number: weekNumber,
        year,
        theme_snapshot: theme,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'group_id,week_number,year' }
    )
    .select('id')
    .single()

  if (quizErr || !quiz) {
    console.error('[Quiz] Erreur upsert quiz:', quizErr?.message)
    return null
  }

  // Si force=true, virer les anciennes questions
  if (force) {
    await supabaseAdmin.from('quiz_questions').delete().eq('quiz_id', quiz.id)
  }

  const rows = questions.map((q, i) => ({
    quiz_id: quiz.id,
    position: i + 1,
    type: q.type,
    question: q.question,
    choices: q.choices,
    correct_index: q.correct_index,
    explanation: q.explanation,
  }))

  const { error: qErr } = await supabaseAdmin.from('quiz_questions').insert(rows)
  if (qErr) {
    console.error('[Quiz] Erreur insertion questions:', qErr.message)
    return null
  }

  console.log(`[Quiz] Généré pour group=${groupId.slice(0, 8)} S${weekNumber}/${year} (${rows.length} questions)`)
  return { quizId: quiz.id, questions: rows.length }
}

// ─────────────────────────────────────────────────────────────
// Appel Claude + validation
// ─────────────────────────────────────────────────────────────

async function callClaudeForQuestions({
  theme,
  weekNumber,
  apiKey,
}: {
  theme: string
  weekNumber: number
  apiKey: string
}): Promise<GeneratedQuestion[] | null> {
  const prompt = buildPrompt({ theme, weekNumber })

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
        max_tokens: 2500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('[Quiz] Claude API error:', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const text = (data.content?.[0]?.text ?? '').trim()

    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('[Quiz] Pas de tableau JSON trouvé. Réponse :', text.slice(0, 500))
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('[Quiz] JSON invalide:', err)
      return null
    }

    return validateQuestions(parsed)
  } catch (err) {
    console.error('[Quiz] Erreur appel Claude:', err)
    return null
  }
}

function validateQuestions(raw: unknown): GeneratedQuestion[] | null {
  if (!Array.isArray(raw) || raw.length !== QUIZ_QUESTIONS_PER_QUIZ) {
    console.error(`[Quiz] Doit être un tableau de ${QUIZ_QUESTIONS_PER_QUIZ} éléments, reçu :`, Array.isArray(raw) ? raw.length : typeof raw)
    return null
  }

  const out: GeneratedQuestion[] = []

  for (let i = 0; i < raw.length; i++) {
    const q = raw[i] as Record<string, unknown>
    const type = q.type
    const question = typeof q.question === 'string' ? q.question.trim() : ''
    const choices = Array.isArray(q.choices) ? q.choices.map(c => String(c).trim()) : []
    const correctIndex = typeof q.correct_index === 'number' ? q.correct_index : -1
    const explanation = typeof q.explanation === 'string' ? q.explanation.trim() : ''

    if (type !== 'qcm' && type !== 'truefalse') {
      console.error(`[Quiz] Q${i + 1} : type invalide (${type})`)
      return null
    }
    if (!question) {
      console.error(`[Quiz] Q${i + 1} : question vide`)
      return null
    }
    if (type === 'qcm' && choices.length !== 4) {
      console.error(`[Quiz] Q${i + 1} : QCM doit avoir 4 choix, reçu ${choices.length}`)
      return null
    }
    if (type === 'truefalse' && (choices.length !== 2 || choices[0].toLowerCase() !== 'vrai' || choices[1].toLowerCase() !== 'faux')) {
      console.error(`[Quiz] Q${i + 1} : vrai/faux doit avoir ["Vrai","Faux"]`)
      return null
    }
    if (correctIndex < 0 || correctIndex >= choices.length) {
      console.error(`[Quiz] Q${i + 1} : correct_index hors bornes (${correctIndex})`)
      return null
    }
    if (!explanation) {
      console.error(`[Quiz] Q${i + 1} : explication vide`)
      return null
    }

    out.push({ type, question, choices, correct_index: correctIndex, explanation })
  }

  return out
}

// ─────────────────────────────────────────────────────────────
// Prompt Claude
// ─────────────────────────────────────────────────────────────

function buildPrompt({ theme, weekNumber }: { theme: string; weekNumber: number }): string {
  const difficulty = weekNumber <= 4 ? 'bases (rappel de notions fondamentales)'
    : weekNumber <= 12 ? 'application (situations concrètes, exemples plausibles)'
    : 'finesse (nuances, cas limites, finesse du jugement)'

  return `Tu conçois un mini-quiz pédagogique pour un apprenant en formation professionnelle.

Thème de la formation :
"""
${theme}
"""

Semaine en cours : ${weekNumber} → difficulté visée : ${difficulty}

Génère 4 questions pour tester les acquis. Mélange exactement 2 QCM (4 choix) et 2 vrai/faux.

Règles de fond :
- Questions concrètes, ancrées dans le métier décrit dans le thème — pas de définitions scolaires ni de QCM sur du vocabulaire académique.
- 1 seule bonne réponse par question. Les mauvaises réponses doivent être plausibles (pas de pièges grossiers genre "et dormir pendant la réunion").
- Explication concise (max 200 caractères) : pourquoi c'est la bonne réponse, en 1 phrase utile.
- Français, tutoiement, ton pro mais accessible.
- Pas de noms propres d'auteurs ou de modèles théoriques (Herzberg, Maslow, Porter, Kotter...). Exceptions tolérées : DESC, OSBD, DISC, SMART, SONCAS, Triangle toxique.
- Varier les angles : pas 4 questions sur le même sous-thème.

Réponds UNIQUEMENT avec un tableau JSON valide, sans markdown, sans préambule :

[
  {
    "type": "qcm",
    "question": "...",
    "choices": ["A ...", "B ...", "C ...", "D ..."],
    "correct_index": 1,
    "explanation": "..."
  },
  {
    "type": "truefalse",
    "question": "...",
    "choices": ["Vrai", "Faux"],
    "correct_index": 0,
    "explanation": "..."
  },
  {
    "type": "qcm",
    "question": "...",
    "choices": ["A ...", "B ...", "C ...", "D ..."],
    "correct_index": 2,
    "explanation": "..."
  },
  {
    "type": "truefalse",
    "question": "...",
    "choices": ["Vrai", "Faux"],
    "correct_index": 1,
    "explanation": "..."
  }
]

Contraintes strictes JSON :
- exactement 4 objets
- "type" : "qcm" ou "truefalse"
- "choices" : 4 strings pour qcm, exactement ["Vrai","Faux"] (dans cet ordre) pour truefalse
- "correct_index" : entier entre 0 et 3 pour qcm, 0 ou 1 pour truefalse
- ne pas mettre les lettres "A."/"B." dans les choices QCM, juste le texte (l'UI ajoutera les lettres)
- pas de champ supplémentaire
- encoding UTF-8, pas d'échappement bizarre`
}
