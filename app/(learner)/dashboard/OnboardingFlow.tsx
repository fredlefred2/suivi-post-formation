'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { getOnboardingAck, acknowledgeStep } from '@/lib/onboarding'
import { useOnboarding } from '@/lib/onboarding-context'
import CoachMark from '@/app/components/CoachMark'
import { updateAxeFast } from '@/app/(learner)/axes/actions'

// All step IDs in order — 12 étapes pour l'interface v1.29
// (axes 2-3 skippable, étape 6 = vue d'ensemble dashboard, 7-10 = tour des 4 icônes,
// 11-12 = tour des 2 onglets du bas)
const ALL_STEPS = [
  'welcome',         // 1. Bienvenue
  'axis-1',          // 2. Crée ton 1er axe (obligatoire)
  'axis-2',          // 3. Crée ton 2e axe (optionnel)
  'axis-3',          // 4. Crée ton 3e axe (optionnel)
  'progression',     // 5. Ta dynamique de progression (5 niveaux)
  'dashboard-tour',  // 6. Vue rapide du dashboard (carte "À faire aujourd'hui")
  'icon-action',     // 7. Icône ⚡ J'ai agi
  'icon-checkin',    // 8. Icône 📋 Check-in
  'icon-coach',      // 9. Icône 💡 Coach
  'icon-messages',   // 10. Icône 💬 Messagerie
  'tab-actions',     // 11. Onglet 🎯 Actions (menu bas)
  'tab-team',        // 12. Onglet 👥 Team (menu bas)
] as const

type StepId = (typeof ALL_STEPS)[number]

// Anciens marqueurs d'étape (v1.28) conservés uniquement dans la logique
// de migration : si un apprenant a stored['menu-tour'] === true, on considère
// son onboarding v1.28 comme terminé et on marque les 12 nouvelles étapes acked.

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
  // Inline axis edit during onboarding
  const [editingAxeId, setEditingAxeId] = useState<string | null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDifficulty, setEditDifficulty] = useState('moyen')
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    const stored = getOnboardingAck(userId)

    // Un apprenant a terminé son onboarding si :
    //   - il a la marque finale v1.29 (tab-team), OU
    //   - il a l'ancienne marque (menu-tour) de l'onboarding v1.28 → on migre
    const hasNewMarker = stored['tab-team'] === true
    const hasLegacyMarker = stored['menu-tour'] === true
    const isOnboardingDone = hasNewMarker || hasLegacyMarker

    // Migration : si l'apprenant avait terminé l'ancien onboarding, on
    // considère toutes les nouvelles étapes comme déjà faites
    if (hasLegacyMarker && !hasNewMarker) {
      for (const step of ALL_STEPS) {
        if (!stored[step]) {
          stored[step] = true
          acknowledgeStep(step, userId)
        }
      }
    }

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
      const autoSteps: StepId[] = [
        'progression', 'dashboard-tour',
        'icon-action', 'icon-checkin', 'icon-coach', 'icon-messages',
        'tab-actions', 'tab-team',
      ]
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
    setEditSaving(true)
    const result = await updateAxeFast(editingAxeId, editSubject, editDescription || null, editDifficulty)
    if (result?.error) { setEditError(result.error); setEditSaving(false); return }
    setEditSaving(false)
    setEditingAxeId(null)
  }

  // Go back to previous step (un-acknowledge current step's predecessor)
  const goBack = useCallback((fromStep: StepId) => {
    const idx = ALL_STEPS.indexOf(fromStep)
    if (idx <= 0) return

    // Si on est sur la première étape coach mark (progression) → éditer le dernier axe
    if (fromStep === 'progression') {
      openEditLastAxe()
      return
    }

    // Find the previous visible step
    for (let i = idx - 1; i >= 0; i--) {
      const prev = ALL_STEPS[i]
      // Skip auto-completed axis steps
      if (prev === 'axis-1' && axesCount >= 1) continue
      if (prev === 'axis-2' && (axesCount >= 2 || ack['skip-axis-2'])) continue
      if (prev === 'axis-3' && (axesCount >= 3 || ack['skip-axis-3'] || ack['skip-axis-2'])) continue

      // Un-ack the previous step so IT becomes active
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
  }, [userId, axesCount, ack]) // eslint-disable-line react-hooks/exhaustive-deps

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
  // (tab-team = marque v1.29 ; menu-tour = marque legacy conservée pour compat)
  const onboardingDone = mounted && (ack['tab-team'] === true || ack['menu-tour'] === true)
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
            <div className="px-5 py-4 shrink-0" style={{ background: '#1a1a2e' }}>
              <h2 className="text-white font-bold text-base">✏️ Modifier l&apos;axe de progrès</h2>
              <p className="text-white/50 text-xs mt-0.5">Modifie les détails de ton axe</p>
            </div>

            <form onSubmit={handleEditAxeSubmit} className="p-5 space-y-5 flex-1 flex flex-col">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Intitulé de l&apos;axe</label>
                <input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20 outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">
                  Moyens envisagés <span className="font-normal text-gray-500">(optionnel)</span>
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:bg-white focus:border-[#fbbf24] focus:ring-2 focus:ring-[#fbbf24]/20 outline-none transition-all resize-none h-20"
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
                            ? 'border-[#fbbf24] bg-[#fffbeb] shadow-md scale-[1.03]'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}>
                          <span className="text-lg">{emoji}</span>
                          <span className={`text-xs font-semibold ${isSelected ? 'text-[#1a1a2e]' : 'text-gray-500'}`}>{label}</span>
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
                  disabled={editSaving}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm text-white transition-all active:scale-[0.98] ${editSaving ? 'opacity-60' : ''}`}
                  style={{ background: '#fbbf24', color: '#1a1a2e' }}
                >
                  {editSaving ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Enregistrement...
                    </span>
                  ) : '✓ Valider'}
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
            : i === currentIdx ? 'w-5 bg-[#1a1a2e]'
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
            <span className="text-xs font-semibold text-[#1a1a2e]">Étape {stepLabel}</span>
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
                  <span className="w-7 h-7 rounded-full bg-[#fffbeb] text-[#1a1a2e] font-bold text-xs flex items-center justify-center shrink-0">{s.n}</span>
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
            <span className="text-xs font-semibold text-[#1a1a2e]">Étape {stepLabel}</span>
            {renderDots(stepIndex)}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 overflow-y-auto px-1">
            <div className="text-4xl">🎯</div>
            <h2 className="text-lg font-bold text-gray-800">Crée ton 1er axe de progrès</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Un axe représente un domaine que tu souhaites améliorer suite à ta formation.
            </p>
            <div className="bg-[#fffbeb] rounded-xl p-3 mt-3 text-left text-sm text-[#1a1a2e]">
              <p className="font-medium mb-1">Exemple d&apos;axe :</p>
              <p className="text-[#1a1a2e]">&laquo; Déléguer efficacement &raquo; — Difficulté : Intermédiaire</p>
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
                className="text-sm text-gray-500 hover:text-gray-600 underline transition-colors"
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
            <span className="text-xs font-semibold text-[#1a1a2e]">Étape {stepLabel}</span>
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
            <div className="bg-[#fffbeb] rounded-xl p-3 mt-3 text-left text-sm text-[#1a1a2e]">
              <p className="font-medium mb-1">Idée d&apos;axe :</p>
              <p className="text-[#1a1a2e]">&laquo; Mieux communiquer en réunion &raquo;</p>
            </div>
          </div>

          <div className="pt-3 pb-1 text-center shrink-0 space-y-2">
            <Link href="/axes?onboarding=create" className="btn-primary">
              Créer mon 2e axe
            </Link>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={openEditLastAxe}
                className="text-sm text-gray-500 hover:text-gray-600 underline transition-colors"
              >
                ← Modifier mon axe
              </button>
              <button
                onClick={skipAxis2}
                className="text-sm text-gray-500 hover:text-gray-600 underline transition-colors"
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
            <span className="text-xs font-semibold text-[#1a1a2e]">Étape {stepLabel}</span>
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
            <div className="bg-[#fffbeb] rounded-xl p-3 mt-3 text-left text-sm text-[#1a1a2e]">
              <p className="font-medium mb-1">Idée d&apos;axe :</p>
              <p className="text-[#1a1a2e]">&laquo; Gérer mon temps et mes priorités &raquo;</p>
            </div>
          </div>

          <div className="pt-3 pb-1 text-center shrink-0 space-y-2">
            <Link href="/axes?onboarding=create" className="btn-primary">
              Créer mon 3e axe
            </Link>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={openEditLastAxe}
                className="text-sm text-gray-500 hover:text-gray-600 underline transition-colors"
              >
                ← Modifier mes axes
              </button>
              <button
                onClick={skipAxis3}
                className="text-sm text-gray-500 hover:text-gray-600 underline transition-colors"
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

  // Step 5: Progression — spotlight on first axis card (colored gradient)
  if (activeStep === 'progression') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="progression"]'
          stepLabel={stepLabel}
          icon="📈"
          title="Ta dynamique de progression"
          description="Chaque axe change de couleur selon tes actions. Voici les 5 niveaux que tu peux atteindre :"
          extra={
            <div style={{ marginTop: 8, marginBottom: 4 }}>
              {/* Piste de progression colorée */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, position: 'relative' }}>
                {[
                  { icon: '💡', label: 'Intention', color: '#7c3aed', bg: '#ede9fe' },
                  { icon: '🧪', label: 'Essai', color: '#0ea5e9', bg: '#e0f2fe' },
                  { icon: '🔄', label: 'Habitude', color: '#10b981', bg: '#d1fae5' },
                  { icon: '⚡', label: 'Réflexe', color: '#f97316', bg: '#ffedd5' },
                  { icon: '👑', label: 'Maîtrise', color: '#ec4899', bg: '#fce7f3' },
                ].map((level, i) => (
                  <div key={level.label} style={{ display: 'flex', alignItems: 'center' }}>
                    {i > 0 && (
                      <div style={{
                        width: 16,
                        height: 3,
                        background: `linear-gradient(90deg, ${[
                          { icon: '💡', label: 'Intention', color: '#7c3aed', bg: '#ede9fe' },
                          { icon: '🧪', label: 'Essai', color: '#0ea5e9', bg: '#e0f2fe' },
                          { icon: '🔄', label: 'Habitude', color: '#10b981', bg: '#d1fae5' },
                          { icon: '⚡', label: 'Réflexe', color: '#f97316', bg: '#ffedd5' },
                          { icon: '👑', label: 'Maîtrise', color: '#ec4899', bg: '#fce7f3' },
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

  // Step 6: Vue rapide du dashboard (coach mark centré sur la carte "À faire aujourd'hui")
  if (activeStep === 'dashboard-tour') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="tasks-card"]'
          stepLabel={stepLabel}
          icon="🏠"
          title="Voici ton tableau de bord"
          description="En haut : 4 raccourcis pour tes gestes du jour. En bas : tes axes en cercles qui se remplissent à mesure que tu progresses. On va faire le tour !"
          ctaLabel="Compris !"
          onCta={() => acknowledge('dashboard-tour')}
          onBack={() => goBack('dashboard-tour')}
        />
      </>
    )
  }

  // Step 7: Icône ⚡ J'ai agi (spotlight)
  if (activeStep === 'icon-action') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="icon-action"]'
          stepLabel={stepLabel}
          icon="⚡"
          title="Enregistre ce que tu fais"
          description="Pour noter ce que tu mets en pratique au quotidien. Chaque action remplit ton anneau d'axe."
          ctaLabel="Compris !"
          onCta={() => acknowledge('icon-action')}
          onBack={() => goBack('icon-action')}
        />
      </>
    )
  }

  // Step 8: Icône 📋 Check-in (spotlight)
  if (activeStep === 'icon-checkin') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="icon-checkin"]'
          stepLabel={stepLabel}
          icon="📋"
          title="Ton check-in du vendredi"
          description="Ton bilan hebdo en 2 minutes : météo, réussites, difficultés. Le 🔥 compte tes semaines d'affilée."
          ctaLabel="Compris !"
          onCta={() => acknowledge('icon-checkin')}
          onBack={() => goBack('icon-checkin')}
        />
      </>
    )
  }

  // Step 9: Icône 💡 Coach (spotlight)
  if (activeStep === 'icon-coach') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="icon-coach"]'
          stepLabel={stepLabel}
          icon="💡"
          title="Ton coach"
          description="Régulièrement, un conseil personnalisé et une reco d'action."
          ctaLabel="Compris !"
          onCta={() => acknowledge('icon-coach')}
          onBack={() => goBack('icon-coach')}
        />
      </>
    )
  }

  // Step 10: Icône 💬 Messagerie (spotlight)
  if (activeStep === 'icon-messages') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="icon-messages"]'
          stepLabel={stepLabel}
          icon="💬"
          title="Échange avec ton formateur"
          description="Une messagerie privée, directement avec lui."
          ctaLabel="Compris !"
          onCta={() => acknowledge('icon-messages')}
          onBack={() => goBack('icon-messages')}
        />
      </>
    )
  }

  // Step 11: Onglet 🎯 Actions dans le menu du bas (spotlight)
  if (activeStep === 'tab-actions') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="nav-actions"]'
          stepLabel={stepLabel}
          icon="🎯"
          title="L'onglet Actions"
          description="Toutes tes actions passées, triées par axe. Ton formateur et tes coéquipiers peuvent les liker ❤️ et commenter 💬."
          ctaLabel="Compris !"
          onCta={() => acknowledge('tab-actions')}
          onBack={() => goBack('tab-actions')}
        />
      </>
    )
  }

  // Step 12: Onglet 👥 Team dans le menu du bas (dernière étape — marque la fin)
  if (activeStep === 'tab-team') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="nav-team"]'
          stepLabel={stepLabel}
          icon="👥"
          title="L'onglet Team"
          description="Les actions de tes coéquipiers. Like ❤️ et commente 💬 pour les encourager."
          ctaLabel="C'est parti ! 🚀"
          onCta={() => {
            acknowledge('tab-team')
            sessionStorage.removeItem(`onboarding_session_${userId}`)
          }}
          onBack={() => goBack('tab-team')}
        />
      </>
    )
  }

  // Fallback
  return <>{children}</>
}
