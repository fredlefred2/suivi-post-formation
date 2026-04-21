'use client'

import { useEffect, useState } from 'react'
import QuizPlayer from './QuizPlayer'

type QuizState = {
  quiz: { id: string; week_number: number; year: number } | null
  attempt: { id: string; completed_at: string | null; score: number } | null
  nextPosition: number | null
  answeredCount: number
  totalQuestions: number
}

export default function QuizDashboardCard() {
  const [state, setState] = useState<QuizState | null>(null)
  const [playerOpen, setPlayerOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      const res = await fetch('/api/quiz/current')
      if (!res.ok) {
        setLoading(false)
        return
      }
      const data = await res.json() as QuizState
      setState(data)
    } catch {
      // silencieux
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return null

  // Pas de quiz cette semaine (semaine impaire, pas de brief, ou pas de groupe)
  if (!state?.quiz) return null

  const { quiz, attempt, nextPosition, answeredCount, totalQuestions } = state
  const completed = !!attempt?.completed_at
  const inProgress = !!attempt && !completed && nextPosition !== null

  // ─── État "quiz fait" — bandeau discret ───
  if (completed && attempt) {
    return (
      <div
        className="rounded-[22px] px-3 py-2.5 flex items-center gap-2.5"
        style={{ background: '#ecfdf5', border: '2px solid #a7f3d0' }}
      >
        <span className="text-lg">✅</span>
        <div className="flex-1">
          <p className="text-[11px] font-extrabold tracking-wider uppercase" style={{ color: '#047857' }}>
            Quiz de la semaine
          </p>
          <p className="text-[12px] font-bold" style={{ color: '#1a1a2e' }}>
            ⭐ {attempt.score}/{totalQuestions} · prochain quiz dans 2 semaines
          </p>
        </div>
      </div>
    )
  }

  // ─── État "à démarrer" ou "en cours" — carte warm + bouton ───
  const buttonLabel = inProgress
    ? `Reprendre (Q${nextPosition}/${totalQuestions}) →`
    : 'Démarrer le quiz →'

  const subLabel = inProgress
    ? `Question ${nextPosition} sur ${totalQuestions}`
    : `${totalQuestions} questions · 1 minute chacune`

  return (
    <>
      <div
        className="rounded-[22px] px-3 py-3.5"
        style={{
          background: 'linear-gradient(180deg, #ffffff 0%, #fffbf0 100%)',
          border: '2px solid #fde68a',
          boxShadow: '0 4px 18px rgba(251,191,36,0.18)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
              boxShadow: '0 4px 12px rgba(251,191,36,0.4)',
              fontSize: 18,
            }}
          >
            🎯
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-extrabold tracking-wider uppercase" style={{ color: '#92400e' }}>
              Quiz de la semaine
            </p>
            <p className="text-[13px] font-bold mt-0.5" style={{ color: '#1a1a2e' }}>
              {subLabel}
            </p>
          </div>
        </div>

        {/* Mini progress dots si en cours */}
        {inProgress && (
          <div className="flex gap-1.5 mt-2 mb-2.5 ml-1">
            {Array.from({ length: totalQuestions }).map((_, i) => (
              <span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: i < answeredCount ? '#fbbf24' : '#f0ebe0' }}
              />
            ))}
          </div>
        )}

        <button
          onClick={() => setPlayerOpen(true)}
          className="w-full mt-3 py-3 rounded-2xl font-extrabold text-[14px] tap-scale"
          style={{
            background: '#fbbf24',
            color: '#1a1a2e',
            boxShadow: '0 4px 20px rgba(251,191,36,0.3)',
          }}
        >
          {buttonLabel}
        </button>
      </div>

      <QuizPlayer
        quizId={quiz.id}
        open={playerOpen}
        onClose={() => setPlayerOpen(false)}
        onDone={() => {
          setPlayerOpen(false)
          load()
        }}
      />
    </>
  )
}
