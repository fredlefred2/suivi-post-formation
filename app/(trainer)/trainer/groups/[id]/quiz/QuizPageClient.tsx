'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { HelpCircle, Sparkles, Loader2, Clock, Check, X, FileText, AlertCircle } from 'lucide-react'
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
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded-xl transition-colors hover:bg-[#fffbeb] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ border: '2px solid #fde68a', color: '#92400e', background: '#fffbeb' }}
            >
              {isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {isRegenerating ? 'Génération…' : currentQuiz ? 'Régénérer' : 'Générer maintenant'}
            </button>
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
                <p className="text-[11px] font-extrabold tracking-wider uppercase mb-2" style={{ color: '#a0937c' }}>
                  Question {q.position} · {q.type === 'qcm' ? 'QCM' : 'Vrai / Faux'}
                </p>
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
    </>
  )
}
