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

/**
 * Régénère UNE question d'un quiz existant (même position, nouveau contenu).
 * Refuse si au moins 1 apprenant a déjà répondu à cette question.
 * Le type (qcm / truefalse) est conservé.
 */
export async function regenerateSingleQuestion({
  quizId,
  questionId,
  theme,
  weekNumber,
}: {
  quizId: string
  questionId: string
  theme: string
  weekNumber: number
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) return { ok: false, error: 'CLAUDE_API_KEY manquante', status: 500 }

  // Lire la question cible
  const { data: target } = await supabaseAdmin
    .from('quiz_questions')
    .select('id, quiz_id, position, type, question')
    .eq('id', questionId)
    .maybeSingle()

  if (!target || target.quiz_id !== quizId) {
    return { ok: false, error: 'Question introuvable', status: 404 }
  }

  // Bloquer si des apprenants ont répondu
  const { count } = await supabaseAdmin
    .from('quiz_answers')
    .select('*', { count: 'exact', head: true })
    .eq('question_id', questionId)
    .not('time_ms', 'is', null)

  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `${count} apprenant${count! > 1 ? 's ont' : ' a'} déjà répondu à cette question. Régénération bloquée pour préserver les scores.`,
      status: 409,
    }
  }

  // Charger les autres questions pour éviter les doublons
  const { data: others } = await supabaseAdmin
    .from('quiz_questions')
    .select('question')
    .eq('quiz_id', quizId)
    .neq('id', questionId)

  const otherQuestions = (others ?? []).map(o => o.question as string)

  // Appeler Claude pour 1 seule question
  const generated = await callClaudeForSingleQuestion({
    theme,
    weekNumber,
    type: target.type as 'qcm' | 'truefalse',
    currentQuestion: target.question as string,
    otherQuestions,
    apiKey,
  })

  if (!generated) {
    return { ok: false, error: 'Claude n\'a pas pu régénérer, réessaie.', status: 500 }
  }

  // Remplacer la question in-place (supprime d'abord les quiz_answers "in progress")
  await supabaseAdmin.from('quiz_answers').delete().eq('question_id', questionId)

  const { error: updErr } = await supabaseAdmin
    .from('quiz_questions')
    .update({
      type: generated.type,
      question: generated.question,
      choices: generated.choices,
      correct_index: generated.correct_index,
      explanation: generated.explanation,
    })
    .eq('id', questionId)

  if (updErr) {
    return { ok: false, error: 'Erreur enregistrement', status: 500 }
  }

  console.log(`[Quiz] Question ${questionId.slice(0, 8)} régénérée (quiz ${quizId.slice(0, 8)})`)
  return { ok: true }
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

/** Génère 1 seule question (régénération ciblée). */
async function callClaudeForSingleQuestion({
  theme,
  weekNumber,
  type,
  currentQuestion,
  otherQuestions,
  apiKey,
}: {
  theme: string
  weekNumber: number
  type: 'qcm' | 'truefalse'
  currentQuestion: string
  otherQuestions: string[]
  apiKey: string
}): Promise<GeneratedQuestion | null> {
  const prompt = buildSingleQuestionPrompt({ theme, weekNumber, type, currentQuestion, otherQuestions })

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
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('[Quiz] Claude API error (single):', response.status, await response.text())
      return null
    }

    const data = await response.json()
    const text = (data.content?.[0]?.text ?? '').trim()

    // Attendu : un seul objet JSON
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('[Quiz] Pas d\'objet JSON trouvé pour single. Réponse :', text.slice(0, 500))
      return null
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonMatch[0])
    } catch (err) {
      console.error('[Quiz] JSON single invalide:', err)
      return null
    }

    const q = validateOneQuestion(parsed)
    if (!q) return null

    // Forcer le type demandé (si Claude diverge)
    if (q.type !== type) {
      console.error('[Quiz] Type divergent :', q.type, '≠', type)
      return null
    }

    return q
  } catch (err) {
    console.error('[Quiz] Erreur appel Claude (single):', err)
    return null
  }
}

function validateOneQuestion(raw: unknown): GeneratedQuestion | null {
  const q = raw as Record<string, unknown>
  const type = q?.type
  const question = typeof q?.question === 'string' ? q.question.trim() : ''
  const choices = Array.isArray(q?.choices) ? q.choices.map(c => String(c).trim()) : []
  const correctIndex = typeof q?.correct_index === 'number' ? q.correct_index : -1
  const explanation = typeof q?.explanation === 'string' ? q.explanation.trim() : ''

  if (type !== 'qcm' && type !== 'truefalse') {
    console.error(`[Quiz] type invalide (${type})`)
    return null
  }
  if (!question) {
    console.error(`[Quiz] question vide`)
    return null
  }
  if (type === 'qcm' && choices.length !== 4) {
    console.error(`[Quiz] QCM doit avoir 4 choix, reçu ${choices.length}`)
    return null
  }
  if (type === 'truefalse' && (choices.length !== 2 || choices[0].toLowerCase() !== 'vrai' || choices[1].toLowerCase() !== 'faux')) {
    console.error(`[Quiz] vrai/faux doit avoir ["Vrai","Faux"]`)
    return null
  }
  if (correctIndex < 0 || correctIndex >= choices.length) {
    console.error(`[Quiz] correct_index hors bornes (${correctIndex})`)
    return null
  }
  if (!explanation) {
    console.error(`[Quiz] explication vide`)
    return null
  }

  return { type, question, choices, correct_index: correctIndex, explanation }
}

function validateQuestions(raw: unknown): GeneratedQuestion[] | null {
  if (!Array.isArray(raw) || raw.length !== QUIZ_QUESTIONS_PER_QUIZ) {
    console.error(`[Quiz] Doit être un tableau de ${QUIZ_QUESTIONS_PER_QUIZ} éléments, reçu :`, Array.isArray(raw) ? raw.length : typeof raw)
    return null
  }

  const out: GeneratedQuestion[] = []
  for (let i = 0; i < raw.length; i++) {
    const q = validateOneQuestion(raw[i])
    if (!q) {
      console.error(`[Quiz] Q${i + 1} invalide`)
      return null
    }
    out.push(q)
  }
  return out
}

// ─────────────────────────────────────────────────────────────
// Prompt Claude
// ─────────────────────────────────────────────────────────────

function buildSingleQuestionPrompt({
  theme,
  weekNumber,
  type,
  currentQuestion,
  otherQuestions,
}: {
  theme: string
  weekNumber: number
  type: 'qcm' | 'truefalse'
  currentQuestion: string
  otherQuestions: string[]
}): string {
  const typeLabel = type === 'qcm' ? 'QCM 4 choix' : 'Vrai / Faux'
  const formatTemplate = type === 'qcm'
    ? `{"type":"qcm","question":"...","choices":["A ...","B ...","C ...","D ..."],"correct_index":0,"explanation":"..."}`
    : `{"type":"truefalse","question":"...","choices":["Vrai","Faux"],"correct_index":0,"explanation":"..."}`

  return `Tu régénères UNE question de quiz pour une formation professionnelle.

Thème :
"""
${theme}
"""

Semaine ${weekNumber}. Format demandé : ${typeLabel}.

Question actuelle à remplacer :
"${currentQuestion}"

Autres questions du même quiz (à NE PAS redupliquer — garde un angle différent) :
${otherQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Règles :
- Reste sur le thème, mais change d'angle par rapport à la question remplacée et aux autres.
- Concret, pas théorique.
- 1 bonne réponse, mauvaises plausibles.
- Explication max 200 caractères.
- Français, tutoiement.
- Pas de noms propres d'auteurs / modèles (Herzberg, Maslow…). Exceptions : DESC, OSBD, DISC, SMART, SONCAS.

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas de préambule) :

${formatTemplate}

Contraintes strictes :
- "type" : "${type}"
- "choices" : ${type === 'qcm' ? '4 strings (texte uniquement, pas "A."/"B.")' : 'exactement ["Vrai","Faux"]'}
- "correct_index" : entier ${type === 'qcm' ? 'entre 0 et 3' : '0 ou 1'}`
}

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
