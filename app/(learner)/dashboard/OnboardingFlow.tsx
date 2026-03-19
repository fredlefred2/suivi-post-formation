'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { getOnboardingAck, acknowledgeStep } from '@/lib/onboarding'
import { useOnboarding } from '@/lib/onboarding-context'
import CoachMark from '@/app/components/CoachMark'
import QuickAddAction from '@/app/components/QuickAddAction'

// All step IDs in order
const ALL_STEPS = [
  'welcome',
  'axis-1',
  'progression',
  'fab-action',
  'demo-action',
  'show-feedback',
  'delete-demo',
  'checkin',
  'menu-tour',
] as const

type StepId = (typeof ALL_STEPS)[number]

// Menu tour sub-steps
const MENU_NAV_ITEMS = [
  { selector: '[data-onboarding="nav-dashboard"]', label: 'Tableau de bord', desc: 'Ta progression et tes actions' },
  { selector: '[data-onboarding="nav-axes"]', label: 'Mes actions', desc: 'Gere tes actions pour chaque axe' },
  { selector: '[data-onboarding="nav-checkin"]', label: 'Check-in', desc: 'Meteo et bilan hebdomadaire' },
  { selector: '[data-onboarding="nav-team"]', label: 'Team', desc: 'Tes coequipiers' },
]

type AxeOption = {
  id: string
  subject: string
  completedCount: number
}

type Props = {
  userId: string
  firstName: string
  axesCount: number
  totalActions: number
  totalCheckins: number
  firstActionId?: string | null
  axes: AxeOption[]
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
  const router = useRouter()
  const { setIsOnboarding } = useOnboarding()
  const [ack, setAck] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)
  const [menuSubStep, setMenuSubStep] = useState(0)
  const [quickAddOpen, setQuickAddOpen] = useState(false)

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
      const autoSteps: StepId[] = ['progression', 'fab-action', 'demo-action', 'show-feedback', 'delete-demo', 'checkin', 'menu-tour']
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

  // Determine which step is active
  const getActiveStep = useCallback((): StepId | null => {
    for (const step of ALL_STEPS) {
      if (step === 'axis-1' && axesCount >= 1) continue
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

  // Auto-open QuickAddAction for demo-action step
  useEffect(() => {
    if (activeStep === 'demo-action' && !quickAddOpen) {
      // Short delay to let the dashboard render
      const timer = setTimeout(() => setQuickAddOpen(true), 400)
      return () => clearTimeout(timer)
    }
  }, [activeStep, quickAddOpen])

  if (!mounted) return null

  // Blocking overlay: onboarding done but 0 axes → force creation
  if (needsAxisBlock) {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-3 px-1">
            <div className="text-4xl">🎯</div>
            <h2 className="text-lg font-bold text-gray-800">Cree au moins un axe de progres</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Tu as besoin d&apos;au moins un axe pour acceder a ton espace. C&apos;est rapide !
            </p>
          </div>
          <div className="pt-3 pb-1 text-center shrink-0">
            <Link href="/axes?onboarding=create" className="btn-primary">
              Creer un axe
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // All done → show normal dashboard
  if (activeStep === null) return <>{children}</>

  // ── Step 1: Welcome (full-screen modal) ──
  if (activeStep === 'welcome') {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-xs font-semibold text-indigo-600">Etape 1/8</span>
            <div className="flex items-center gap-1">
              {ALL_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === 0 ? 'w-5 bg-indigo-500' : 'w-3 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 overflow-y-auto px-1">
            <Image src="/yapluka-symbol.png" alt="YAPLUKA" width={48} height={45} className="drop-shadow-md" />
            <h2 className="text-lg font-bold text-gray-800">Bienvenue {firstName} !</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              YAPLUKA t&apos;accompagne pour transformer ta formation en actions concretes. Voici le programme :
            </p>
            <div className="flex flex-col gap-2 text-left max-w-xs mx-auto mt-3">
              {[
                { n: '1', text: <>Definis tes <strong>axes</strong> de progres</> },
                { n: '2', text: <>Decouvre ta <strong>dynamique</strong> de progression</> },
                { n: '3', text: <>Enregistre ta premiere <strong>action</strong></> },
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

  // ── Step 2: axis-1 (full-screen modal — user is redirected to /axes) ──
  if (activeStep === 'axis-1') {
    return (
      <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
        <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
          <div className="flex items-center justify-between mb-2 px-1 shrink-0">
            <span className="text-xs font-semibold text-indigo-600">Etape 2/8</span>
            <div className="flex items-center gap-1">
              {ALL_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i < 1 ? 'w-3 bg-emerald-400'
                    : i === 1 ? 'w-5 bg-indigo-500'
                    : 'w-3 bg-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-2 overflow-y-auto px-1">
            <div className="text-4xl">🎯</div>
            <h2 className="text-lg font-bold text-gray-800">Cree ton 1er axe de progres</h2>
            <p className="text-sm text-gray-500 leading-relaxed">
              Un axe represente un domaine que tu souhaites ameliorer suite a ta formation. Remplis le formulaire qui va s&apos;afficher.
            </p>
            <div className="bg-indigo-50 rounded-xl p-3 mt-3 text-left text-sm text-indigo-800">
              <p className="font-medium mb-1">Exemple d&apos;axe :</p>
              <p className="text-indigo-600">&laquo; Deleguer efficacement &raquo; — Difficulte : Intermediaire</p>
            </div>
          </div>

          <div className="pt-3 pb-1 text-center shrink-0">
            <Link href="/axes?onboarding=create" className="btn-primary">
              Creer mon 1er axe
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Steps 3, 4a, 4b/4c, 7, 8: Coach marks overlaid on the dashboard ──

  // Step 3: Progression — spotlight on first axis card
  if (activeStep === 'progression') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="progression"]'
          icon="📈"
          title="Ta dynamique de progression"
          description="Chaque action te fait monter de niveau, de ⚪ Veille a 🚀 Propulsion !"
          ctaLabel="Compris !"
          onCta={() => acknowledge('progression')}
        />
      </>
    )
  }

  // Step 4a: FAB action — spotlight on FAB button
  if (activeStep === 'fab-action') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="fab-action"]'
          icon="➕"
          title="Ajoute une action"
          description="Clique ici pour enregistrer une action concrete que tu as menee."
          onTargetClick={() => {
            acknowledge('fab-action')
          }}
        />
      </>
    )
  }

  // Step 4b/4c: Demo action — QuickAddAction in onboarding mode
  if (activeStep === 'demo-action') {
    return (
      <>
        {children}
        <QuickAddAction
          axes={axes}
          open={quickAddOpen}
          onClose={() => {
            // Don't allow closing during onboarding — just reopen
            setQuickAddOpen(true)
          }}
          onSuccess={() => {
            acknowledge('demo-action')
            // Redirect to /axes to show feedback step
            router.push('/axes?onboarding=show-feedback')
          }}
          onboardingMode
        />
      </>
    )
  }

  // Steps 5, 6: show-feedback and delete-demo happen on /axes
  // OnboardingFlow just renders children (AxesClient handles these via URL params)
  if (activeStep === 'show-feedback' || activeStep === 'delete-demo') {
    return <>{children}</>
  }

  // Step 7: Check-in — spotlight on weather/check-in area
  if (activeStep === 'checkin') {
    return (
      <>
        {children}
        <CoachMark
          targetSelector='[data-onboarding="checkin-area"]'
          icon="📋"
          title="Le check-in hebdomadaire"
          description="Chaque vendredi, prends 2 minutes pour donner ta meteo de la semaine : ☀️ ⛅ ou ⛈️"
          ctaLabel="Ok, compris !"
          onCta={() => acknowledge('checkin')}
        />
      </>
    )
  }

  // Step 8: Menu tour — sequential spotlights on bottom nav items
  if (activeStep === 'menu-tour') {
    const navItem = MENU_NAV_ITEMS[menuSubStep]
    const isLast = menuSubStep >= MENU_NAV_ITEMS.length - 1

    return (
      <>
        {children}
        <CoachMark
          key={`menu-${menuSubStep}`}
          targetSelector={navItem.selector}
          icon="👇"
          title={navItem.label}
          description={navItem.desc}
          ctaLabel={isLast ? 'C\'est parti !' : 'Suivant'}
          onCta={() => {
            if (isLast) {
              acknowledge('menu-tour')
              // Clean up onboarding session
              sessionStorage.removeItem(`onboarding_session_${userId}`)
            } else {
              setMenuSubStep((prev) => prev + 1)
            }
          }}
        />
      </>
    )
  }

  // Fallback: render children
  return <>{children}</>
}
