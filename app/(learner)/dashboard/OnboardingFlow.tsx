'use client'

import { useState, useEffect, useRef, useCallback, useTransition } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getOnboardingAck, acknowledgeStep } from '@/lib/onboarding'
import { useOnboarding } from '@/lib/onboarding-context'
import CoachMark from '@/app/components/CoachMark'
import { updateAxeFast } from '@/app/(learner)/axes/actions'

// All step IDs in order (10 steps, axes 2-3 skippable)
const ALL_STEPS = [
  'welcome',       // 1. Bienvenue
  'axis-1',        // 2. Crée ton 1er axe (obligatoire)
  'axis-2',        // 3. Crée ton 2e axe (optionnel)
  'axis-3',        // 4. Crée ton 3e axe (optionnel)
  'progression',   // 5. Ta dynamique de progression (coach mark)
  'add-action',    // 6. Ajouter une action (coach mark)
  'feedback-info', // 7. Likes & commentaires (coach mark centré)
  'delete-info',   // 8. Modifier & supprimer (coach mark centré)
  'checkin',       // 9. Le check-in hebdomadaire (coach mark)
  'menu-tour',     // 10. Ton espace YAPLUKA (coach marks séquentiels)
] as const

type StepId = (typeof ALL_STEPS)[number]

// Menu tour sub-steps
const MENU_NAV_ITEMS = [
  { selector: '[data-onboarding="nav-dashboard"]', label: '📊 Tableau de bord', desc: 'Vue d\'ensemble : ta dynamique de progression sur chaque axe, tes statistiques (actions, check-ins, streak) et ta frise météo.' },
  { selector: '[data-onboarding="nav-axes"]', label: '🎯 Mes actions', desc: 'Retrouve tes axes de progrès, ajoute et gère tes actions, et suis ton niveau pour chaque axe.' },
  { selector: '[data-onboarding="nav-checkin"]', label: '📋 Check-in', desc: 'Chaque semaine, fais le point : ta météo, tes réussites et tes difficultés.' },
  { selector: '[data-onboarding="nav-team"]', label: '👥 Team', desc: 'Découvre les actions de tes coéquipiers, encourage-les avec des likes et des commentaires !' },
]

type Props = {
  userId: string
  firstName: string
  axesCount: number
  totalActions: number
  totalCheckins: number
  firstActionId?: string | null
  axes: { id: string; subject: string; description: string | null; difficulty: string; completedCount: number }[]
  children: React.ReactNode
}

export default function OnboardingFlow({
  userId,
  firstName,
  axesCount,
  totalActions,
  totalCheckins,
  firstActionId,
  axes,
  children,
}: Props) {
  const { setIsOnboarding } = useOnboarding()
  const [ack, setAck] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const [menuSubStep, setMenuSubStep] = useState(0)
  // Inline axis edit during onboarding
  const [editingAxeId, setEditingAxeId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('moyen')
  const [editError, setEditError] = useState<string | null>(null)
  const [editPending, startEditTransition] = useTransition()

  useEffect(() => {
    const stored = getOnboardingAck(userId)
    const isOnboardingDone = stored['menu-tour'] === true

    // Check for active onboarding session
    const sessionKey = `onboarding_session_${userId}`
    const isActiveSession = sessionStorage.getItem(sessionKey) === 'true'

    // Existing users with axes and no active session → auto-complete everything
    if (axesCount >= 1 && !isOnboardingDone && !isActiveSession) {
      for (const step of ALL_STEPS) {
        if (!stored[step]) {
          stored[step] = true
          acknowledgeStep(step, userId)
        }
      }
    }

    // 0 axes and onboarding not done → start session
    if (axesCount === 0 && !isOnboardingDone) {
      sessionStorage.setItem(sessionKey, 'true')
    }

    // Users with actions → auto-complete from progression onwards
    if (totalActions >= 1) {
      const autoSteps: StepId[] = ['progression', 'add-action', 'feedback-info', 'delete-info', 'checkin', 'menu-tour']
      for (const step of autoSteps) {
        if (!stored[step]) {
          stored[step] = true
          acknowledgeStep(step, userId)
        }
      }
    }

    setAck(stored)
    setMounted(true)
  }, [axesCount, totalActions, userId])

  const acknowledge = useCallback((stepId: string) => {
    acknowledgeStep(stepId, userId)
    setAck((prev) => ({ ...prev, [stepId]: true }))
  }, [userId])

  function skipAxis2() {
    acknowledgeStep('skip-axis-2', userId)
    acknowledgeStep('skip-axis-3', userId) // Skip axe 2 → auto-skip axe 3
    setAck((prev) => ({ ...prev, 'skip-axis-2': true, 'skip-axis-3': true }))
  }

  function skipAxis3() {
    acknowledgeStep('skip-axis-3', userId)
    setAck((prev) => ({ ...prev, 'skip-axis-3': true }))
  }

  function openEditLastAxe() {
    const lastAxe = axes[axes.length - 1]
    if (!lastAxe) return
    setEditingAxeId(lastAxe.id)
    setEditSubject(lastAxe.subject)
    setEditDescription(lastAxe.description || '')
    setEditDifficulty(lastAxe.difficulty || 'moyen')
    setEditError(null)
  }

  async function handleEditAxeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingAxeId) return
    setEditError(null)
    const result = await updateAxeFast(editingAxeId, editSubject, editDescription || null, editDifficulty)
    if (result?.error) { setEditError(result.error); return }
    setEditingAxeId(null)
  }

  // Go back to previous step (un-acknowledge current step's predecessor)
  const goBack = useCallback((fromStep: StepId) => {
    const idx = ALL_STEPS.indexOf(fromStep)
    if (idx <= 0) return

    // Find the previous visible step
    for (let i = idx - 1; i >= 0; i--) {
      const prev = ALL_STEPS[i]
      // Skip auto-completed axis steps
      if (prev === 'axis-1' && axesCount >= 1) continue
      if (prev === 'axis-2' && (axesCount >= 2 || ack['skip-axis-2'])) continue
      if (prev === 'axis-3' && (axesCount >= 3 || ack['skip-axis-3'] || ack['skip-axis-2'])) continue

      // Un-acknowledge the current step to go back
      // We need to remove the ack for fromStep so it becomes active again after we go back
      // Actually, we un-ack the previous step so IT becomes active
      const stored = getOnboardingAck(userId)
      delete stored[prev]
      localStorage.setItem(`onboarding_${userId}`, JSON.stringify(stored))
      setAck((a) => {
        const next = { ...a }
        delete next[prev]
        return next
      })
      return
    }
  }, [userId, axesCount, ack])

  // Determine which step is active
  const getActiveStep = useCallback((): StepId | null => {
    for (const step of ALL_STEPS) {
      // axis-1 auto-completes when axesCount >= 1
      if (step === 'axis-1' && axesCount >= 1) continue
      // axis-2 auto-completes when axesCount >= 2 OR skipped
      if (step === 'axis-2' && (axesCount >= 2 || ack['skip-axis-2'])) continue
      // axis-3 auto-completes when axesCount >= 3 OR skipped (including cascade from axis-2 skip)
      if (step === 'axis-3' && (axesCount >= 3 || ack['skip-axis-3'] || ack['skip-axis-2'])) continue
      if (!ack[step]) return step
    }
    return null
  }, [ack, axesCount])

  const activeStep = mounted ? getActiveStep() : null
  const isActive = mounted && activeStep !== null

  // Onboarding done but 0 axes → needs axis block
  const onboardingDone = mounted && ack['menu-tour'] === true
  const needsAxisBlock = mounted && axesCount === 0 && onboardingDone

  // Sync onboarding state to context (disables nav menus)
  useEffect(() => {
    if (mounted) setIsOnboarding(isActive || needsAxisBlock)
    return () => setIsOnboarding(false)
  }, [mounted, isActive, needsAxisBlock, setIsOnboarding])

  // Scroll to top when onboarding transitions from active → completed
  const prevStepRef = useRef<StepId | null>(null)
  useEffect(() => {
    if (prevStepRef.current !== null && activeStep === null) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    prevStepRef.current = activeStep
  }, [activeStep])

  if (!mounted) return null

  // ── Modale d'édition inline (onboarding) ──
  if (editingAxeId) {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-0 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          <div className="rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden flex flex-col flex-1">
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-4 shrink-0">
              <h2 className="text-white font-bold text-base">✏️ Modifier l&apos;axe de progrès</h2>
              <p className="text-indigo-100 text-xs mt-0.5">Modifie les détails de ton axe</p>
            </div>

            <form onSubmit={handleEditAxeSubmit} className="p-5 space-y-5 flex-1 flex flex-col">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intitulé de l&apos;axe</label>
                <input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Moyens envisagés <span className="font-normal text-gray-400">(optionnel)</span>
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all resize-none h-20"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-2 block">Niveau de difficulté</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'facile', emoji: '🟢', label: 'Facile' },
                    { key: 'moyen', emoji: '🟡', label: 'Moyen' },
                    { key: 'difficile', emoji: '🔴', label: 'Difficile' },
                  ]).map(({ key, emoji, label }) => {
                    const isSelected = editDifficulty === key
                    return (
                      <label key={key} className="cursor-pointer">
                        <input
                          type="radio" name="edit-difficulty" value={key} className="sr-only"
                          checked={isSelected}
                          onChange={() => setEditDifficulty(key)}
                        />
                        <div className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-indigo-500 bg-indigo-50 shadow-md scale-[1.03]'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                          <span className="text-lg">{emoji}</span>
                          <span className={`text-xs font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-500'}`}>{label}</span>
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>
              {editError && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>}
              <div className="flex gap-3 pt-1 mt-auto">
                <button
                  type="submit"
                  disabled={editPending}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                >
                  {editPending ? 'Enregistrement...' : '✓ Valider'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingAxeId(null)}
                  className="px-5 py-3 rounded-xl font-semibold text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 transition-all"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Blocking overlay: onboarding done but 0 axes → force creation
  if (needsAxisBlock) {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 px-1">
            <div className="text-4xl">🎯</div>
            <h2 className="text-lg font-bold text-gray-800">Crée au moins un axe de progrès</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tu as besoin d&apos;au moins un axe pour accéder à ton espace. C&apos;est rapide !
            </p>
          </div>
          <div className="pt-3 pb-1 text-center shrink-0">
            <Link href="/axes?onboarding=create" className="btn-primary">
              Créer un axe
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // All done → show normal dashboard
  if (activeStep === null) return <>{children}</>

  // Helper: visual step number (skip axis-2/3 if they're auto-completed)
  const visibleSteps = ALL_STEPS.filter(s => {
    if (s === 'axis-2' && (axesCount >= 2 || ack['skip-axis-2'])) return false
    if (s === 'axis-3' && (axesCount >= 3 || ack['skip-axis-3'] || ack['skip-axis-2'])) return false
    return true
  })
  const stepIndex = visibleSteps.indexOf(activeStep)
  const stepLabel = `${stepIndex + 1}/${visibleSteps.length}`

  // Step indicator dots
  const renderDots = (currentIdx: number) => (
    <div className="flex items-center gap-1">
      {visibleSteps.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 rounded-full transition-all duration-300 ${
            i < currentIdx ? 'w-3 bg-emerald-400'
            : i === currentIdx ? 'w-5 bg-indigo-500'
            : 'w-3 bg-gray-200'
          }`}
        />
      ))}
    </div>
  )

  // ═══════════════════════════════════════════════════
  // FULL-SCREEN MODAL STEPS (1-4: welcome + axes)
  // ═══════════════════════════════════════════════════

  // ── Step 1: Welcome ──
  if (activeStep === 'welcome') {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-xs font-semibold text-indigo-600">Étape {stepLabel}</span>
            {renderDots(stepIndex)}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 overflow-y-auto px-1">
            <Image src="/yapluka-symbol.png" alt="YAPLUKA" width={48} height={45} className="drop-shadow-md" />
            <h2 className="text-lg font-bold text-gray-800">Bienvenue {firstName} !</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              YAPLUKA t&apos;accompagne pour transformer ta formation en actions concrètes. On te guide en 3 minutes !
            </p>
            <div className="flex flex-col gap-2 text-left max-w-xs mx-auto mt-3">
              {[
                { n: '1', text: <>Définis tes <strong>axes</strong> de progrès</> },
                { n: '2', text: <>Découvre ta <strong>dynamique</strong> de progression</> },
                { n: '3', text: <>Comprends le <strong>check-in</strong> hebdomadaire</> },
              ].map((s) => (
                <div key={s.n} className="flex items-center gap-3 text-sm">
                  <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">{s.n}</span>
                  <span className="text-gray-600">{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 pb-1 text-center shrink-0">
            <Link
              href="/axes?onboarding=create"
              onClick={() => acknowledge('welcome')}
              className="btn-primary"
            >
              C&apos;est parti !
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 2: Axis 1 (obligatoire) ──
  if (activeStep === 'axis-1') {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-xs font-semibold text-indigo-600">Étape {stepLabel}</span>
            {renderDots(stepIndex)}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 overflow-y-auto px-1">
            <div className="text-4xl">🎯</div>
            <h2 className="text-lg font-bold text-gray-800">Crée ton 1er axe de progrès</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Un axe représente un domaine que tu souhaites améliorer suite à ta formation.
            </p>
            <div className="bg-indigo-50 rounded-xl p-3 mt-3 text-left text-sm text-indigo-800">
              <p className="font-medium mb-1">Exemple d&apos;axe :</p>
              <p className="text-indigo-600">&laquo; Déléguer efficacement &raquo; — Difficulté : Intermédiaire</p>
            </div>
          </div>

          <div className="pt-3 pb-1 text-center shrink-0 space-y-2">
            <Link href="/axes?onboarding=create" className="btn-primary">
              Créer mon 1er axe
            </Link>
            <div>
              <button
                onClick={() => {
                  // Retour à welcome : un-ack welcome
                  const stored = getOnboardingAck(userId)
                  delete stored['welcome']
                  localStorage.setItem(`onboarding_${userId}`, JSON.stringify(stored))
                  setAck((a) => { const n = { ...a }; delete n['welcome']; return n })
                }}
                className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                ← Retour
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 3: Axis 2 (optionnel, skippable) ──
  if (activeStep === 'axis-2') {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-xs font-semibold text-indigo-600">Étape {stepLabel}</span>
            {renderDots(stepIndex)}
          </div>

          {/* Bravo banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 mb-2 text-center shrink-0">
            <p className="text-sm font-semibold text-emerald-700">🎉 Bravo ! Ton 1er axe est créé !</p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 overflow-y-auto px-1">
            <div className="text-4xl">🎯</div>
            <h2 className="text-lg font-bold text-gray-800">Crée ton 2e axe</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Excellent début ! Continue sur ta lancée. Tu peux aussi le faire plus tard.
            </p>
            <div className="bg-indigo-50 rounded-xl p-3 mt-3 text-left text-sm text-indigo-800">
              <p className="font-medium mb-1">Idée d&apos;axe :</p>
              <p className="text-indigo-600">&laquo; Mieux communiquer en réunion &raquo;</p>
            </div>
          </div>

          <div className="pt-3 pb-1 text-center shrink-0 space-y-2">
            <Link href="/axes?onboarding=create" className="btn-primary">
              Créer mon 2e axe
            </Link>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={openEditLastAxe}
                className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                ← Modifier mon axe
              </button>
              <button
                onClick={skipAxis2}
                className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                Plus tard →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Step 4: Axis 3 (optionnel, skippable) ──
  if (activeStep === 'axis-3') {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-xs font-semibold text-indigo-600">Étape {stepLabel}</span>
            {renderDots(stepIndex)}
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 mb-2 text-center shrink-0">
            <p className="text-sm font-semibold text-emerald-700">🎉 Super ! 2 axes déjà définis !</p>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 overflow-y-auto px-1">
            <div className="text-4xl">🎯</div>
            <h2 className="text-lg font-bold text-gray-800">Crée ton 3e et dernier axe</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Plus qu&apos;un axe et tu auras posé toutes les bases de ta progression ! Tu peux aussi le faire plus tard.
            </p>
            <div className="bg-indigo-50 rounded-xl p-3 mt-3 text-left text-sm text-indigo-800">
              <p className="font-medium mb-1">Idée d&apos;axe :</p>
              <p className="text-indigo-600">&laquo; Gérer mon temps et mes priorités &raquo;</p>
            </div>
          </div>

          <div className="pt-3 pb-1 text-center shrink-0 space-y-2">
            <Link href="/axes?onboarding=create" className="btn-primary">
              Créer mon 3e axe
            </Link>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={openEditLastAxe}
                className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                ← Modifier mes axes
              </button>
              <button
                onClick={skipAxis3}
                className="text-sm text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                Plus tard →
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════
  // COACH MARKS TRANSLUCIDES (5-10: sur le dashboard)
  // ═══════════════════════════════════════════════════

  // Step 5: Progression — spotlight on first axis card
  if (activeStep === 'progression') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="progression"]'
          stepLabel={stepLabel}
          icon="📈"
          title="Ta dynamique de progression"
          description="Chaque action enregistrée te fait progresser. Voici les 5 niveaux que tu peux atteindre :"
          extra={
            <div style={{ marginTop: 8, marginBottom: 4 }}>
              {/* Piste de progression colorée */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, position: 'relative' }}>
                {[
                  { icon: '⚪', label: 'Veille', color: '#94a3b8', bg: '#f1f5f9' },
                  { icon: '👣', label: 'Impulsion', color: '#0ea5e9', bg: '#e0f2fe' },
                  { icon: '🥁', label: 'Rythme', color: '#10b981', bg: '#d1fae5' },
                  { icon: '🔥', label: 'Intensité', color: '#f97316', bg: '#ffedd5' },
                  { icon: '🚀', label: 'Propulsion', color: '#ec4899', bg: '#fce7f3' },
                ].map((level, i) => (
                  <div key={level.label} style={{ display: 'flex', alignItems: 'center' }}>
                    {i > 0 && (
                      <div style={{
                        width: 16,
                        height: 3,
                        background: `linear-gradient(90deg, ${[
                          { icon: '⚪', label: 'Veille', color: '#94a3b8', bg: '#f1f5f9' },
                          { icon: '👣', label: 'Impulsion', color: '#0ea5e9', bg: '#e0f2fe' },
                          { icon: '🥁', label: 'Rythme', color: '#10b981', bg: '#d1fae5' },
                          { icon: '🔥', label: 'Intensité', color: '#f97316', bg: '#ffedd5' },
                          { icon: '🚀', label: 'Propulsion', color: '#ec4899', bg: '#fce7f3' },
                        ][i - 1].color}, ${level.color})`,
                        borderRadius: 2,
                      }} />
                    )}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        background: level.bg,
                        border: `2px solid ${level.color}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14,
                      }}>
                        {level.icon}
                      </div>
                      <p style={{ fontSize: 8, color: level.color, marginTop: 2, fontWeight: 600, lineHeight: 1 }}>{level.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          }
          ctaLabel="Compris !"
          onCta={() => acknowledge('progression')}
          onBack={() => goBack('progression')}
        />
      </>
    )
  }

  // Step 6: Add action — spotlight on FAB (explanatory only)
  if (activeStep === 'add-action') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="fab-action"]'
          stepLabel={stepLabel}
          icon="➕"
          title="Ajouter une action"
          description="Ce bouton te permet d'enregistrer chaque action concrète que tu mènes au quotidien. Tu choisis l'axe concerné, tu décris ce que tu as fait, et c'est enregistré ! Plus tu en ajoutes, plus tu progresses."
          ctaLabel="Compris !"
          onCta={() => acknowledge('add-action')}
          onBack={() => goBack('add-action')}
        />
      </>
    )
  }

  // Step 7: Feedback — informational bubble (centered, no target)
  if (activeStep === 'feedback-info') {
    return (
      <>
        {children}
        <CoachMark
          stepLabel={stepLabel}
          icon="❤️"
          title="Likes & commentaires"
          description="Ton formateur et tes coéquipiers peuvent liker ❤️ et commenter 💬 tes actions pour t'encourager. Et toi aussi, tu peux liker et commenter les actions des autres dans l'onglet Team !"
          extra={
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 24,
              marginTop: 8,
              marginBottom: 4,
            }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 28 }}>❤️</span>
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Liker</p>
              </div>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 28 }}>💬</span>
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Commenter</p>
              </div>
            </div>
          }
          ctaLabel="Compris !"
          onCta={() => acknowledge('feedback-info')}
          onBack={() => goBack('feedback-info')}
        />
      </>
    )
  }

  // Step 8: Delete — informational bubble (centered, no target)
  if (activeStep === 'delete-info') {
    return (
      <>
        {children}
        <CoachMark
          stepLabel={stepLabel}
          icon="✏️"
          title="Modifier & supprimer"
          description="Depuis l'écran « Mes actions », tu peux à tout moment :"
          extra={
            <div style={{ marginTop: 6, marginBottom: 4, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>✏️</span>
                <span style={{ fontSize: 13, color: '#6b7280' }}><strong>Modifier</strong> le texte d&apos;une action</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>🗑️</span>
                <span style={{ fontSize: 13, color: '#6b7280' }}><strong>Supprimer</strong> une action si besoin</span>
              </div>
            </div>
          }
          ctaLabel="Compris !"
          onCta={() => acknowledge('delete-info')}
          onBack={() => goBack('delete-info')}
        />
      </>
    )
  }

  // Step 9: Check-in — informational bubble with alert banner mockup
  if (activeStep === 'checkin') {
    return (
      <>
        {children}
        <CoachMark
          stepLabel={stepLabel}
          icon="📋"
          title="Le check-in hebdomadaire"
          description="Chaque vendredi, un bandeau apparaîtra pour te rappeler de faire ton check-in. On te demandera :"
          extra={
            <div style={{ marginTop: 8, marginBottom: 6 }}>
              {/* Ce qu'on demande */}
              <div style={{ textAlign: 'left', marginBottom: 10 }}>
                {[
                  { icon: '🌤️', text: 'Ta météo de la semaine (ça roule, mitigé, difficile)' },
                  { icon: '✅', text: 'Tes réussites et avancées' },
                  { icon: '⚡', text: 'Tes difficultés rencontrées' },
                ].map((item) => (
                  <div key={item.icon} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.4 }}>{item.text}</span>
                  </div>
                ))}
              </div>
              {/* Mockup du bandeau alerte */}
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fcd34d',
                borderRadius: 12,
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}>
                <span style={{ fontSize: 16, color: '#d97706' }}>⚠️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#78350f', margin: 0 }}>Check-in en attente</p>
                  <p style={{ fontSize: 11, color: '#92400e', margin: 0 }}>Semaine du 10 au 16 mars</p>
                </div>
                <span style={{
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 10px',
                  borderRadius: 8,
                }}>Faire</span>
              </div>
            </div>
          }
          ctaLabel="Ok, compris !"
          onCta={() => acknowledge('checkin')}
          onBack={() => goBack('checkin')}
        />
      </>
    )
  }

  // Step 10: Menu tour — sequential spotlights on bottom nav items
  if (activeStep === 'menu-tour') {
    const navItem = MENU_NAV_ITEMS[menuSubStep]
    const isLast = menuSubStep >= MENU_NAV_ITEMS.length - 1

    return (
      <>
        {children}
        <CoachMark
          key={`menu-${menuSubStep}`}
          targetSelector={navItem.selector}
          stepLabel={stepLabel}
          icon="👇"
          title={navItem.label}
          description={navItem.desc}
          ctaLabel={isLast ? "C'est parti !" : 'Suivant →'}
          onCta={() => {
            if (isLast) {
              acknowledge('menu-tour')
              sessionStorage.removeItem(`onboarding_session_${userId}`)
            } else {
              setMenuSubStep((prev) => prev + 1)
            }
          }}
          onBack={() => {
            if (menuSubStep > 0) {
              setMenuSubStep((prev) => prev - 1)
            } else {
              goBack('menu-tour')
            }
          }}
        />
      </>
    )
  }

  // Fallback
  return <>{children}</>
}
