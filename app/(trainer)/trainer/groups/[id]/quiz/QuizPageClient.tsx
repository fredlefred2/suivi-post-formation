'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HelpCircle, Sparkles, Loader2, Clock, Check, FileText, AlertCircle, RefreshCw, Trash2, X } from 'lucide-react'
import { QUIZ_QUESTIONS_PER_QUIZ, QUIZ_SECONDS_PER_QUESTION } from '@/lib/types'

type Question = {
  id: string
  position: number
  type: 'qcm' | 'truefalse'
  question: string
  choices: string[]
  correct_index: number
  explanation: string | null
}

type Quiz = { id: string; week_number: number; year: number; generated_at: string }

type Ranking = {
  learner_id: string
  first_name: string
  last_name: string
  quizzesDone: number
  totalCorrect: number
  correctRate: number
}

type HistoryItem = {
  quizId: string
  week: number
  year: number
  generatedAt: string
  attemptsCount: number
  averageRate: number
}

type Props = {
  groupId: string
  groupName: string
  theme: string | null
  currentWeek: number
  currentYear: number
  isQuizWeekCurrent: boolean
  currentQuiz: Quiz | null
  currentQuestions: Question[]
  memberCount: number
  ranking: Ranking[]
  history: HistoryItem[]
}

const WEEK_LABELS: Record<number, string> = {
  1: 'S1', 2: 'S2', 3: 'S3', 4: 'S4', 5: 'S5',
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
  const months = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
}

export default function TrainerGroupQuizClient({
  groupId,
  groupName,
  theme,
  currentWeek,
  isQuizWeekCurrent,
  currentQuiz,
  currentQuestions,
  memberCount,
  ranking,
  history,
}: Props) {
  const router = useRouter()
  const [isRegenerating, startTransition] = useTransition()
  const [regenError, setRegenError] = useState<string | null>(null)
  const [regenQuestionId, setRegenQuestionId] = useState<string | null>(null)
  const [questionError, setQuestionError] = useState<{ id: string; msg: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const hasTheme = (theme ?? '').trim().length >= 20

  const handleRegenerate = () => {
    if (!hasTheme) return
    setRegenError(null)
    startTransition(async () => {
      try {
        const res = await fetch('/api/trainer/quiz/regenerate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId }),
        })
        const data = await res.json()
        if (!res.ok) {
          setRegenError(data?.error ?? 'Erreur régénération')
        } else {
          router.refresh()
        }
      } catch {
        setRegenError('Erreur réseau')
      }
    })
  }

  const handleDeleteQuiz = async () => {
    if (!currentQuiz) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch('/api/trainer/quiz/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: currentQuiz.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        setDeleteError(data?.error ?? 'Erreur suppression')
      } else {
        setConfirmDelete(false)
        router.refresh()
      }
    } catch {
      setDeleteError('Erreur réseau')
    }
    setIsDeleting(false)
  }

  const handleRegenerateQuestion = async (questionId: string) => {
    if (!currentQuiz) return
    setQuestionError(null)
    setRegenQuestionId(questionId)
    try {
      const res = await fetch('/api/trainer/quiz/regenerate-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: currentQuiz.id, questionId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setQuestionError({ id: questionId, msg: data?.error ?? 'Erreur' })
      } else {
        router.refresh()
      }
    } catch {
      setQuestionError({ id: questionId, msg: 'Erreur réseau' })
    }
    setRegenQuestionId(null)
  }

  return (
    <>
      {/* Header sous-page */}
      <div className="flex items-start gap-3">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #ddd6fe 0%, #a78bfa 100%)',
            boxShadow: '0 4px 14px rgba(167,139,250,0.3)',
          }}
        >
          <HelpCircle size={24} className="text-white" strokeWidth={2.3} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="font-extrabold text-[22px] leading-tight" style={{ color: '#1a1a2e' }}>
            Quiz du groupe
          </h1>
          <p className="text-[13px] mt-1" style={{ color: '#a0937c' }}>
            {QUIZ_QUESTIONS_PER_QUIZ} questions bimensuelles générées par l&apos;IA · semaines paires
          </p>
        </div>
      </div>

      {/* Alerte brief manquant */}
      {!hasTheme && (
        <div className="card" style={{ background: '#fffbeb', border: '2px solid #fde68a' }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" style={{ color: '#92400e' }} />
            <div className="flex-1">
              <p className="font-extrabold text-[14px]" style={{ color: '#92400e' }}>Brief manquant</p>
              <p className="text-[12px] mt-1" style={{ color: '#1a1a2e' }}>
                Aucun quiz ne peut être généré tant que tu n&apos;as pas défini le brief de formation
                (au moins 20 caractères). Retourne sur la carte du groupe et clique sur « Brief ».
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          Section 1 : Quiz de la semaine courante
          ───────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4 pb-3" style={{ borderBottom: '2px solid #f0ebe0' }}>
          <div>
            <p className="section-title">Quiz de la semaine · S{currentWeek}</p>
            <p className="text-[15px] font-extrabold mt-1" style={{ color: '#1a1a2e' }}>
              {!isQuizWeekCurrent
                ? 'Semaine impaire — pas de quiz cette semaine'
                : !currentQuiz
                ? (hasTheme ? 'Pas encore généré' : 'Pas de brief, pas de quiz')
                : `Généré le ${formatDate(currentQuiz.generated_at)}`}
            </p>
          </div>

          {isQuizWeekCurrent && hasTheme && (
            <div className="flex items-center gap-2 shrink-0">
              {currentQuiz && (
                <button
                  onClick={() => { setDeleteError(null); setConfirmDelete(true) }}
                  disabled={isRegenerating || isDeleting}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded-xl transition-colors hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ border: '2px solid #fecaca', color: '#991b1b', background: '#fff' }}
                  title="Supprimer ce quiz"
                >
                  <Trash2 size={14} />
                  Supprimer
                </button>
              )}
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating || isDeleting}
                className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded-xl transition-colors hover:bg-[#fffbeb] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ border: '2px solid #fde68a', color: '#92400e', background: '#fffbeb' }}
              >
                {isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {isRegenerating ? 'Génération…' : currentQuiz ? 'Régénérer' : 'Générer maintenant'}
              </button>
            </div>
          )}
        </div>

        {regenError && (
          <div className="rounded-xl px-4 py-3 text-[13px] mb-4" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
            {regenError}
          </div>
        )}

        {currentQuiz && currentQuestions.length > 0 ? (
          <div className="space-y-4">
            {currentQuestions.map((q, i) => (
              <div key={q.id} style={{ borderTop: i === 0 ? 'none' : '2px solid #f0ebe0', paddingTop: i === 0 ? 0 : 16 }}>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-[11px] font-extrabold tracking-wider uppercase" style={{ color: '#a0937c' }}>
                    Question {q.position} · {q.type === 'qcm' ? 'QCM' : 'Vrai / Faux'}
                  </p>
                  <button
                    onClick={() => handleRegenerateQuestion(q.id)}
                    disabled={regenQuestionId === q.id || isRegenerating}
                    className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold rounded-lg transition-colors hover:bg-[#fffbeb] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ color: '#92400e' }}
                    title="Régénérer cette question avec l'IA"
                  >
                    {regenQuestionId === q.id ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {regenQuestionId === q.id ? 'Génération…' : 'Régénérer'}
                  </button>
                </div>
                {questionError?.id === q.id && (
                  <div className="rounded-lg px-3 py-2 text-[12px] mb-2" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                    {questionError.msg}
                  </div>
                )}
                <p className="text-[14px] font-bold leading-snug" style={{ color: '#1a1a2e' }}>{q.question}</p>

                <div className="mt-2 space-y-1.5">
                  {q.choices.map((choice, idx) => {
                    const isCorrect = idx === q.correct_index
                    return (
                      <div
                        key={idx}
                        className="px-3 py-2 rounded-xl text-[13px] flex items-center gap-2"
                        style={
                          isCorrect
                            ? { background: 'linear-gradient(180deg, #ecfdf5, #d1fae5)', border: '1.5px solid #10b981', color: '#065f46', fontWeight: 700 }
                            : { background: '#faf8f4', border: '1.5px solid #f0ebe0', color: '#1a1a2e' }
                        }
                      >
                        {isCorrect && <Check size={16} strokeWidth={2.8} color="#10b981" />}
                        <span>{q.type === 'qcm' ? String.fromCharCode(65 + idx) + '. ' : ''}{choice}</span>
                      </div>
                    )
                  })}
                </div>

                {q.explanation && (
                  <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg" style={{ background: '#fffbeb', border: '1.5px solid #fde68a' }}>
                    <span className="text-[14px]">💡</span>
                    <p className="text-[12px] leading-relaxed" style={{ color: '#1a1a2e' }}>{q.explanation}</p>
                  </div>
                )}
              </div>
            ))}

            <div className="flex items-center gap-2 text-[11px] pt-4" style={{ color: '#a0937c', borderTop: '2px solid #f0ebe0' }}>
              <Clock size={12} />
              <span>{QUIZ_SECONDS_PER_QUESTION} secondes par question · correction après chaque réponse</span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center" style={{ background: '#faf8f4' }}>
              <FileText size={20} style={{ color: '#a0937c' }} />
            </div>
            <p className="text-[13px] mt-3" style={{ color: '#a0937c' }}>
              {!isQuizWeekCurrent
                ? 'Le prochain quiz sera généré la semaine paire suivante.'
                : hasTheme
                ? 'Le cron se déclenche automatiquement le jeudi 8h. Tu peux aussi générer maintenant.'
                : 'Définis d\'abord le brief pour pouvoir générer un quiz.'}
            </p>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────
          Section 2 : Classement du groupe
          ───────────────────────────────────────────── */}
      {memberCount > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="section-title">Classement du groupe</p>
              <p className="text-[15px] font-extrabold mt-1" style={{ color: '#1a1a2e' }}>Depuis le début de la formation</p>
            </div>
            <p className="text-[11px]" style={{ color: '#a0937c' }}>
              {history.length + (currentQuiz ? 1 : 0)} quiz {history.length + (currentQuiz ? 1 : 0) > 1 ? 'passés' : 'passé'}
            </p>
          </div>

          {ranking.length === 0 ? (
            <p className="text-[13px] text-center py-6" style={{ color: '#a0937c' }}>Aucun apprenant dans ce groupe.</p>
          ) : (
            <div className="space-y-1.5">
              {/* Header tableau */}
              <div className="grid gap-2 text-[11px] font-extrabold uppercase tracking-wider px-3 pb-2" style={{ gridTemplateColumns: '32px 1fr 60px 70px 80px', color: '#a0937c', borderBottom: '1px solid #f0ebe0' }}>
                <span></span>
                <span>Apprenant</span>
                <span className="text-center">Quiz</span>
                <span className="text-center">%</span>
                <span className="text-right">Bonnes</span>
              </div>

              {ranking.map((r, idx) => {
                const rankLabel = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}e`
                const isPodium = idx < 3 && r.quizzesDone > 0
                const isZero = r.quizzesDone === 0

                return (
                  <div
                    key={r.learner_id}
                    className="grid gap-2 items-center px-3 py-2.5 rounded-xl"
                    style={{
                      gridTemplateColumns: '32px 1fr 60px 70px 80px',
                      background: isPodium && idx === 0
                        ? 'linear-gradient(90deg, #fef3c7, #fffbeb)'
                        : 'transparent',
                      border: isPodium && idx === 0 ? '1.5px solid #fde68a' : 'none',
                    }}
                  >
                    <span className={idx < 3 && r.quizzesDone > 0 ? 'text-[16px]' : 'text-[11px] font-bold text-center'} style={idx < 3 && r.quizzesDone > 0 ? {} : { color: '#a0937c' }}>
                      {rankLabel}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full font-extrabold flex items-center justify-center text-[11px] shrink-0" style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                        {r.first_name[0]}{r.last_name[0]}
                      </div>
                      <span className="text-[13px] font-bold truncate" style={{ color: '#1a1a2e' }}>{r.first_name} {r.last_name}</span>
                      {isZero && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0" style={{ background: '#fee2e2', color: '#b91c1c' }}>
                          jamais
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] font-bold text-center" style={{ color: '#1a1a2e' }}>{r.quizzesDone}</span>
                    <span className="text-[13px] font-bold text-center" style={{ color: '#1a1a2e' }}>{r.quizzesDone > 0 ? `${r.correctRate}%` : '—'}</span>
                    <span className="text-[14px] font-extrabold text-right" style={{ color: idx === 0 && !isZero ? '#92400e' : '#1a1a2e' }}>
                      {r.totalCorrect}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          <p className="text-[11px] mt-4 pt-3" style={{ color: '#a0937c', borderTop: '1px solid #f0ebe0' }}>
            <strong>Classement</strong> = nombre de bonnes réponses cumulées (un quiz non passé = 0 ajouté).&nbsp;
            <strong>%</strong> = qualité sur les quiz tentés uniquement.
          </p>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          Section 3 : Historique
          ───────────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="card">
          <p className="section-title mb-3">Historique des quiz</p>
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.quizId} className="flex items-center gap-3 p-3 rounded-2xl" style={{ border: '1.5px solid #f0ebe0' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#f3f4f6' }}>
                  <HelpCircle size={16} style={{ color: '#6b7280' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold" style={{ color: '#1a1a2e' }}>
                    Semaine {h.week} — {formatDate(h.generatedAt)}
                  </p>
                  <p className="text-[11px]" style={{ color: '#a0937c' }}>
                    {QUIZ_QUESTIONS_PER_QUIZ} questions · {h.attemptsCount} apprenant{h.attemptsCount > 1 ? 's' : ''} sur {memberCount} ont répondu · moyenne {h.averageRate}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modale confirmation suppression quiz */}
      {confirmDelete && currentQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={() => !isDeleting && setConfirmDelete(false)} />
          <div className="relative bg-white rounded-[26px] shadow-xl w-full max-w-sm" style={{ border: '2px solid #f0ebe0' }}>
            <button
              onClick={() => !isDeleting && setConfirmDelete(false)}
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1"
              disabled={isDeleting}
            >
              <X size={18} />
            </button>
            <div className="p-6 text-center">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: '#fef2f2' }}>
                <Trash2 size={24} style={{ color: '#b91c1c' }} />
              </div>
              <h3 className="text-[17px] font-extrabold" style={{ color: '#1a1a2e' }}>Supprimer ce quiz ?</h3>
              <p className="text-[13px] mt-2 leading-relaxed" style={{ color: '#6b6761' }}>
                Le quiz de la semaine {currentQuiz.week_number} sera supprimé définitivement. Cette action est irréversible.
              </p>
              <p className="text-[12px] mt-2" style={{ color: '#a0937c' }}>
                Si au moins un apprenant l&apos;a commencé, la suppression sera refusée pour préserver ses données.
              </p>
              {deleteError && (
                <div className="rounded-xl px-4 py-3 text-[12px] mt-3 text-left" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
                  {deleteError}
                </div>
              )}
              <div className="flex gap-2 mt-5">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 text-[13px] font-bold rounded-xl text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  onClick={handleDeleteQuiz}
                  disabled={isDeleting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-[13px] font-extrabold rounded-xl text-white transition-colors disabled:opacity-50"
                  style={{ background: '#dc2626' }}
                >
                  {isDeleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {isDeleting ? 'Suppression…' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
