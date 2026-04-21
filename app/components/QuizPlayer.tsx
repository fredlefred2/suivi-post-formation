'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Clock, Check, Sparkles } from 'lucide-react'
import { QUIZ_SECONDS_PER_QUESTION, QUIZ_QUESTIONS_PER_QUIZ } from '@/lib/types'

type CurrentQuestion = {
  id: string
  position: number
  type: 'qcm' | 'truefalse'
  question: string
  choices: string[]
}

type StartResponse = {
  attemptId: string
  question: CurrentQuestion
  secondsRemaining: number
  totalQuestions: number
}

type AnswerResponse = {
  isCorrect: boolean
  timedOut: boolean
  correctIndex: number
  explanation: string
  selectedIndex: number | null
}

type FinalResponse = {
  score: number
  total: number
  alreadyCompleted: boolean
}

type Props = {
  quizId: string
  open: boolean
  onClose: () => void
  onDone: () => void
}

export default function QuizPlayer({ quizId, open, onClose, onDone }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [attemptId, setAttemptId] = useState<string | null>(null)
  const [question, setQuestion] = useState<CurrentQuestion | null>(null)
  const [secondsLeft, setSecondsLeft] = useState(QUIZ_SECONDS_PER_QUESTION)
  const [answered, setAnswered] = useState<AnswerResponse | null>(null)
  const [answering, setAnswering] = useState(false)
  const [finalScore, setFinalScore] = useState<FinalResponse | null>(null)
  const submittedRef = useRef(false)

  // Charge la question courante au montage (et après chaque "Suivante")
  const loadNext = async () => {
    setLoading(true)
    setError(null)
    setAnswered(null)
    submittedRef.current = false
    try {
      const res = await fetch('/api/quiz/start-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId }),
      })
      const data = await res.json()
      if (!res.ok) {
        // Si toutes les questions sont répondues → appeler /complete
        if (res.status === 409) {
          await completeQuiz(attemptId)
          return
        }
        setError(data?.error ?? 'Erreur')
        setLoading(false)
        return
      }
      const payload = data as StartResponse
      setAttemptId(payload.attemptId)
      setQuestion(payload.question)
      setSecondsLeft(payload.secondsRemaining)
    } catch {
      setError('Erreur réseau')
    }
    setLoading(false)
  }

  const submitAnswer = async (selectedIndex: number | null) => {
    if (submittedRef.current || !attemptId || !question) return
    submittedRef.current = true
    setAnswering(true)

    try {
      const res = await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, questionId: question.id, selectedIndex }),
      })
      const data = await res.json() as AnswerResponse & { error?: string }
      if (!res.ok) {
        setError(data?.error ?? 'Erreur')
      } else {
        setAnswered(data)
      }
    } catch {
      setError('Erreur réseau')
    }
    setAnswering(false)
  }

  const completeQuiz = async (attId: string | null) => {
    if (!attId) return
    try {
      const res = await fetch('/api/quiz/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId: attId }),
      })
      const data = await res.json() as FinalResponse & { error?: string }
      if (!res.ok) {
        setError(data?.error ?? 'Erreur finalisation')
      } else {
        setFinalScore(data)
      }
    } catch {
      setError('Erreur réseau')
    }
    setLoading(false)
  }

  const handleNext = () => {
    // Si c'était la dernière question → complete
    if (question && question.position >= QUIZ_QUESTIONS_PER_QUIZ) {
      completeQuiz(attemptId)
      return
    }
    loadNext()
  }

  // Mount
  useEffect(() => {
    if (open) {
      setFinalScore(null)
      loadNext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, quizId])

  // Timer countdown
  useEffect(() => {
    if (!question || answered) return
    if (secondsLeft <= 0) {
      submitAnswer(null)
      return
    }
    const t = setTimeout(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearTimeout(t)
  }, [secondsLeft, question, answered]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

  // ─── Écran final ───
  if (finalScore) {
    const { score, total } = finalScore
    const stars = score === total ? '⭐⭐⭐' : score >= total / 2 ? '⭐⭐' : score > 0 ? '⭐' : ''
    const msg = score === total
      ? 'Parfait, t\'as tout eu 🔥'
      : score >= 3
      ? 'Très bon score !'
      : score >= 2
      ? 'Beau boulot cette semaine !'
      : score === 1
      ? 'Un pas de plus, ça rentre petit à petit'
      : 'Pas grave. La semaine prochaine tu reviens.'

    return (
      <div className="fixed inset-0 z-50 flex flex-col text-white" style={{
        background: 'radial-gradient(ellipse at center, #1e1e3a 0%, #1a1a2e 50%, #0f0f1e 100%)',
      }}>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="text-[56px] tracking-[4px]">{stars || '⭐⭐⭐'.split('').map((_, i) => <span key={i} className="opacity-20">⭐</span>)}</div>
          <p className="text-[64px] font-black mt-4 leading-none">{score}<span className="text-[28px] opacity-50">/{total}</span></p>
          <p className="text-[18px] font-extrabold mt-5 opacity-95">{msg}</p>
          <button
            onClick={() => { onDone(); onClose() }}
            className="mt-10 w-full max-w-xs py-4 rounded-2xl font-extrabold text-[15px]"
            style={{ background: '#fbbf24', color: '#1a1a2e', boxShadow: '0 4px 20px rgba(251,191,36,0.3)' }}
          >
            Retour au dashboard
          </button>
        </div>
      </div>
    )
  }

  // ─── Écran erreur ───
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center text-white p-6" style={{
        background: 'radial-gradient(ellipse at center, #1e1e3a 0%, #1a1a2e 50%, #0f0f1e 100%)',
      }}>
        <div className="max-w-sm text-center">
          <p className="text-[16px] font-bold">{error}</p>
          <button
            onClick={onClose}
            className="mt-6 px-6 py-3 rounded-2xl font-bold"
            style={{ background: '#fbbf24', color: '#1a1a2e' }}
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  // ─── Écran loading initial ───
  if (loading || !question) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center text-white" style={{
        background: 'radial-gradient(ellipse at center, #1e1e3a 0%, #1a1a2e 50%, #0f0f1e 100%)',
      }}>
        <div className="flex items-center gap-2 opacity-70 text-sm">
          <Sparkles className="animate-pulse" size={16} />
          Chargement…
        </div>
      </div>
    )
  }

  // ─── Écran question + choix ou correction ───
  const progressPct = Math.round((secondsLeft / QUIZ_SECONDS_PER_QUESTION) * 100)
  const urgent = secondsLeft <= 3 && !answered

  return (
    <div className="fixed inset-0 z-50 flex flex-col text-white" style={{
      background: 'radial-gradient(ellipse at center, #1e1e3a 0%, #1a1a2e 50%, #0f0f1e 100%)',
    }}>
      {/* Header */}
      <div className="px-5 pt-[46px] pb-2 shrink-0">
        <div className="flex items-center justify-between text-xs opacity-80 mb-2">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: QUIZ_QUESTIONS_PER_QUIZ }).map((_, i) => (
              <span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: i < question.position ? '#fbbf24' : 'rgba(255,255,255,0.2)' }}
              />
            ))}
            <span className="ml-2 font-bold">Q{question.position} / {QUIZ_QUESTIONS_PER_QUIZ}</span>
          </div>
          <button onClick={onClose} className="opacity-70 hover:opacity-100 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Timer bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
          <div
            className="h-full rounded-full transition-all duration-1000 ease-linear"
            style={{
              width: `${progressPct}%`,
              background: answered ? (answered.isCorrect ? '#10b981' : '#ef4444') : (urgent ? '#ef4444' : '#fbbf24'),
            }}
          />
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-[11px] opacity-80">
          <Clock size={12} />
          <span className="font-mono font-bold tabular-nums">{secondsLeft}s</span>
          {!answered && <span className="opacity-60">pour répondre</span>}
        </div>
      </div>

      {/* Question + choix / correction */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {!answered ? (
          <>
            <p className="text-[11px] font-bold tracking-wider uppercase mb-3 text-center" style={{ color: '#fbbf24' }}>
              Question {question.position}
            </p>
            <h2 className="text-[22px] font-extrabold leading-snug text-center px-2 mb-8">
              {question.question}
            </h2>

            <div className="space-y-2.5 max-w-md mx-auto">
              {question.choices.map((choice, i) => (
                <button
                  key={i}
                  onClick={() => submitAnswer(i)}
                  disabled={answering}
                  className="w-full rounded-2xl px-4 py-4 text-left flex items-center gap-3 transition-all disabled:opacity-60"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    color: '#fff',
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0"
                    style={{ background: 'rgba(255,255,255,0.1)' }}
                  >
                    {question.type === 'qcm' ? String.fromCharCode(65 + i) : choice[0]}
                  </span>
                  <span className="text-[14px] font-medium">{choice}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <CorrectionView
            question={question}
            answered={answered}
            onNext={handleNext}
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Vue correction
// ─────────────────────────────────────────────────────────────

function CorrectionView({
  question,
  answered,
  onNext,
}: {
  question: CurrentQuestion
  answered: AnswerResponse
  onNext: () => void
}) {
  return (
    <div className="max-w-md mx-auto">
      <div className="flex flex-col items-center mb-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: answered.isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
            border: `3px solid ${answered.isCorrect ? '#10b981' : '#ef4444'}`,
          }}
        >
          {answered.isCorrect ? (
            <Check size={40} color="#6ee7b7" strokeWidth={3} />
          ) : (
            <X size={40} color="#fca5a5" strokeWidth={3} />
          )}
        </div>
        <p
          className="text-[22px] font-extrabold mt-3"
          style={{ color: answered.isCorrect ? '#6ee7b7' : '#fca5a5' }}
        >
          {answered.isCorrect ? 'Bonne réponse !' : answered.timedOut ? 'Temps écoulé' : 'Pas cette fois'}
        </p>
        <p className="text-[13px] opacity-70 mt-0.5">
          {answered.isCorrect ? '+1 point' : '+0 point · pas grave'}
        </p>
      </div>

      <div className="space-y-2 mb-5">
        {question.choices.map((choice, i) => {
          const isCorrect = i === answered.correctIndex
          const isSelected = i === answered.selectedIndex
          const showHighlight = isCorrect || isSelected
          if (!showHighlight) return null

          const bg = isCorrect
            ? 'linear-gradient(180deg, #ecfdf5 0%, #d1fae5 100%)'
            : 'linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)'
          const border = isCorrect ? '#10b981' : '#ef4444'
          const textColor = isCorrect ? '#065f46' : '#991b1b'
          const letterBg = isCorrect ? '#10b981' : '#ef4444'

          return (
            <div
              key={i}
              className="rounded-2xl px-4 py-3 flex items-center gap-3 text-[14px] font-medium"
              style={{ background: bg, border: `2px solid ${border}`, color: textColor }}
            >
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-extrabold text-white shrink-0"
                style={{ background: letterBg }}
              >
                {question.type === 'qcm' ? String.fromCharCode(65 + i) : choice[0]}
              </span>
              <span className="flex-1">{choice}</span>
              {isCorrect ? (
                <Check size={18} color="#10b981" strokeWidth={3} />
              ) : (
                <X size={18} color="#ef4444" strokeWidth={3} />
              )}
            </div>
          )
        })}
      </div>

      {answered.explanation && (
        <div
          className="rounded-2xl px-4 py-3 flex gap-3 items-start mb-5"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(251,191,36,0.3)' }}
        >
          <span className="text-lg">💡</span>
          <p className="text-[13px] leading-relaxed opacity-90">{answered.explanation}</p>
        </div>
      )}

      <button
        onClick={onNext}
        className="w-full py-4 rounded-2xl font-extrabold text-[14px]"
        style={{ background: '#fbbf24', color: '#1a1a2e', boxShadow: '0 4px 20px rgba(251,191,36,0.3)' }}
      >
        {question.position >= QUIZ_QUESTIONS_PER_QUIZ ? 'Voir mon score →' : 'Question suivante →'}
      </button>
    </div>
  )
}
