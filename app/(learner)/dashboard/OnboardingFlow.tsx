'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { LayoutDashboard, Target, ClipboardCheck, Users } from 'lucide-react'
import { getOnboardingAck, acknowledgeStep } from '@/lib/onboarding'
import { useOnboarding } from '@/lib/onboarding-context'

type Props = {
  userId: string
  firstName: string
  axesCount: number
  totalActions: number
  totalCheckins: number
  firstActionId?: string | null
  children: React.ReactNode
}

export default function OnboardingFlow({
  userId, firstName, axesCount, totalActions, totalCheckins,
  firstActionId, children,
}: Props) {
  const router = useRouter()
  const { setIsOnboarding } = useOnboarding()
  const [ack, setAck] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getOnboardingAck(userId)
    // Fallback : si l'apprenant a déjà des actions, il a déjà utilisé l'app
    // → on auto-complète les étapes 5-8 (stockées uniquement en localStorage)
    if (totalActions >= 1) {
      const autoSteps = ['first-action', 'edit-delete', 'progression', 'checkin', 'menu-tour']
      for (const step of autoSteps) {
        if (!stored[step]) {
          stored[step] = true
          acknowledgeStep(step, userId)
        }
      }
    }
    setAck(stored)
    setMounted(true)
  }, [totalActions, userId])

  function acknowledge(stepId: string) {
    acknowledgeStep(stepId, userId)
    setAck((prev) => ({ ...prev, [stepId]: true }))
  }

  const steps: {
    id: string
    title: string
    icon: string
    bravo?: string
    description: string
    extra?: React.ReactNode
    isCompleted: boolean
    cta: { label: string; href?: string; action?: () => void }
  }[] = [
    // ── Étape 1 : Bienvenue ──
    {
      id: 'welcome',
      title: `Bienvenue ${firstName} !`,
      icon: 'yapluka',
      description: 'YAPLUKA vous accompagne pour transformer votre formation en actions concrètes. Voici le programme :',
      extra: (
        <div className="flex flex-col gap-2 text-left max-w-xs mx-auto mt-3">
          {[
            { n: '1', text: <>Définissez <strong>3 axes</strong> de progrès</> },
            { n: '2', text: <>Ajoutez une <strong>action concrète</strong></> },
            { n: '3', text: <>Découvrez la <strong>dynamique</strong> de progression</> },
            { n: '4', text: <>Comprenez le <strong>check-in</strong> hebdomadaire</> },
          ].map((s) => (
            <div key={s.n} className="flex items-center gap-3 text-sm">
              <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">{s.n}</span>
              <span className="text-gray-600">{s.text}</span>
            </div>
          ))}
        </div>
      ),
      isCompleted: axesCount >= 1,
      cta: { label: 'C\'est parti !', href: '/axes?onboarding=create' },
    },

    // ── Étape 2 : Axe 1 ──
    {
      id: 'axis-1',
      title: 'Créez votre 1er axe de progrès',
      icon: '🎯',
      description: 'Un axe représente un domaine que vous souhaitez améliorer suite à votre formation. Remplissez le formulaire qui s\'affichera.',
      extra: (
        <div className="bg-indigo-50 rounded-xl p-3 mt-3 text-left text-sm text-indigo-800">
          <p className="font-medium mb-1">Exemple d&apos;axe :</p>
          <p className="text-indigo-600">&laquo; Déléguer efficacement &raquo; — Difficulté : Intermédiaire</p>
        </div>
      ),
      isCompleted: axesCount >= 1,
      cta: { label: 'Créer mon 1er axe', href: '/axes?onboarding=create' },
    },

    // ── Étape 3 : Axe 2 ──
    {
      id: 'axis-2',
      title: 'Créez votre 2e axe',
      icon: '🎯',
      bravo: '🎉 Bravo ! Votre 1er axe est créé !',
      description: 'Excellent début ! Continuez sur votre lancée. Le formulaire est déjà prêt pour vous.',
      extra: (
        <div className="bg-indigo-50 rounded-xl p-3 mt-3 text-left text-sm text-indigo-800">
          <p className="font-medium mb-1">Idée d&apos;axe :</p>
          <p className="text-indigo-600">&laquo; Mieux communiquer en réunion &raquo;</p>
        </div>
      ),
      isCompleted: axesCount >= 2,
      cta: { label: 'Créer mon 2e axe', href: '/axes?onboarding=create' },
    },

    // ── Étape 4 : Axe 3 ──
    {
      id: 'axis-3',
      title: 'Créez votre 3e et dernier axe',
      icon: '🎯',
      bravo: '🎉 Super ! 2 axes déjà définis !',
      description: 'Plus qu\'un axe et vous aurez posé les bases de votre progression !',
      extra: (
        <div className="bg-indigo-50 rounded-xl p-3 mt-3 text-left text-sm text-indigo-800">
          <p className="font-medium mb-1">Idée d&apos;axe :</p>
          <p className="text-indigo-600">&laquo; Gérer mon temps et mes priorités &raquo;</p>
        </div>
      ),
      isCompleted: axesCount >= 3,
      cta: { label: 'Créer mon 3e axe', href: '/axes?onboarding=create' },
    },

    // ── Étape 5 : Démo auto des actions ──
    {
      id: 'first-action',
      title: 'Découvrez la gestion des actions',
      icon: '⚡',
      bravo: '🎉 Parfait ! Vos 3 axes sont définis !',
      description: 'On va vous montrer comment ajouter, modifier et supprimer une action. Tout se fait automatiquement, suivez le guide !',
      extra: (
        <div className="bg-amber-50 rounded-xl p-3 mt-3 text-left text-sm text-amber-800">
          <p className="font-medium mb-1">Vous découvrirez :</p>
          <ul className="space-y-1 text-amber-600">
            <li>➕ Ajouter une action</li>
            <li>✏️ Modifier une action</li>
            <li>❤️ Likes et 💬 commentaires</li>
            <li>🗑️ Supprimer une action</li>
          </ul>
        </div>
      ),
      isCompleted: ack['edit-delete'] ?? false,
      cta: {
        label: 'C\'est parti !',
        action: () => router.push('/axes?onboarding=auto-demo'),
      },
    },

    // ── Étape 6 : Dynamique de progression ──
    {
      id: 'progression',
      title: 'Votre dynamique de progression',
      icon: 'yapluka',
      bravo: '🎉 Bien joué ! Vous maîtrisez la gestion des actions !',
      description: 'Plus vous ajoutez d\'actions, plus votre dynamique monte ! Voici les 5 niveaux que vous pouvez atteindre :',
      extra: (
        <div className="flex flex-col gap-1 mt-2 max-w-xs mx-auto w-full">
          {[
            { icon: '⚪', label: 'Veille', desc: '0 action', color: 'bg-slate-100 text-slate-700' },
            { icon: '👣', label: 'Impulsion', desc: '1-2 actions', color: 'bg-sky-100 text-sky-700' },
            { icon: '🥁', label: 'Rythme', desc: '3-5 actions', color: 'bg-emerald-100 text-emerald-700' },
            { icon: '🔥', label: 'Intensité', desc: '6-8 actions', color: 'bg-orange-100 text-orange-700' },
            { icon: '🚀', label: 'Propulsion', desc: '9+ actions', color: 'bg-rose-100 text-rose-700' },
          ].map((level) => (
            <div key={level.label} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${level.color}`}>
              <span className="text-base">{level.icon}</span>
              <span className="font-medium text-xs flex-1">{level.label}</span>
              <span className="text-[10px] opacity-70">{level.desc}</span>
            </div>
          ))}
        </div>
      ),
      isCompleted: ack['progression'] ?? false,
      cta: { label: 'Compris !', action: () => acknowledge('progression') },
    },

    // ── Étape 7 : Check-in hebdomadaire ──
    {
      id: 'checkin',
      title: 'Le check-in hebdomadaire',
      icon: '📋',
      bravo: '🎉 Vous y êtes presque !',
      description: 'Chaque vendredi, prenez 2 minutes pour votre check-in : donnez votre météo de la semaine, notez ce qui a bien fonctionné et les difficultés rencontrées.',
      extra: (
        <div className="flex items-center justify-center gap-4 mt-3">
          {[
            { icon: '☀️', label: 'Ça roule' },
            { icon: '⛅', label: 'Mitigé' },
            { icon: '⛈️', label: 'Difficile' },
          ].map((w) => (
            <div key={w.label} className="flex flex-col items-center gap-1">
              <span className="text-2xl">{w.icon}</span>
              <span className="text-xs text-gray-500">{w.label}</span>
            </div>
          ))}
        </div>
      ),
      isCompleted: ack['checkin'] ?? false,
      cta: { label: 'Ok, compris !', action: () => acknowledge('checkin') },
    },

    // ── Étape 8 : Tour des menus ──
    {
      id: 'menu-tour',
      title: 'Votre espace YAPLUKA',
      icon: 'yapluka',
      bravo: '🎉 Félicitations, la prise en main est terminée !',
      description: 'Retrouvez ces 4 espaces dans le menu en bas de votre écran.',
      extra: (
        <div className="grid grid-cols-2 gap-2 mt-2 w-full">
          {[
            {
              Icon: LayoutDashboard, label: 'Tableau de bord',
              desc: 'Progression, stats et actions récentes.',
              gradient: 'from-indigo-500 to-indigo-600',
              bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700',
            },
            {
              Icon: Target, label: 'Mes actions',
              desc: 'Gérez vos actions pour chaque axe.',
              gradient: 'from-amber-500 to-orange-500',
              bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700',
            },
            {
              Icon: ClipboardCheck, label: 'Check-in',
              desc: 'Météo, réussites et difficultés.',
              gradient: 'from-emerald-500 to-teal-500',
              bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700',
            },
            {
              Icon: Users, label: 'Team',
              desc: 'Météo et actions de vos coéquipiers.',
              gradient: 'from-purple-500 to-pink-500',
              bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700',
            },
          ].map((item, i) => (
            <div key={item.label} className={`${item.bg} border ${item.border} rounded-xl p-2 text-left`}
                 style={{ animation: `fade-in 0.3s ease-out ${i * 0.1}s both` }}>
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${item.gradient} flex items-center justify-center mb-1`}>
                <item.Icon size={15} className="text-white" />
              </div>
              <p className={`text-xs font-semibold ${item.text} mb-0.5`}>{item.label}</p>
              <p className="text-[10px] text-gray-500 leading-snug">{item.desc}</p>
            </div>
          ))}
        </div>
      ),
      isCompleted: ack['menu-tour'] ?? false,
      cta: { label: 'C\'est parti !', action: () => acknowledge('menu-tour') },
    },
  ]

  // Compute active step
  const activeIndex = mounted ? steps.findIndex((s) => !s.isCompleted) : -2
  const isActive = mounted && activeIndex !== -1

  // Sync onboarding state to context (disables nav menus)
  useEffect(() => {
    if (mounted) setIsOnboarding(isActive)
    return () => setIsOnboarding(false)
  }, [mounted, isActive, setIsOnboarding])

  // Scroll to top when onboarding transitions from active → completed
  const prevActiveRef = useRef<number>(-2)
  useEffect(() => {
    if (prevActiveRef.current >= 0 && activeIndex === -1) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
    prevActiveRef.current = activeIndex
  }, [activeIndex])

  if (!mounted) return null

  // All done → show normal dashboard
  if (activeIndex === -1) return <>{children}</>

  const activeStep = steps[activeIndex]

  return (
    <div className="fixed inset-x-0 top-14 bottom-0 z-20 bg-gray-50 overflow-hidden flex flex-col p-3 sm:ml-48">
      <div className="card !p-4 flex-1 flex flex-col overflow-hidden max-w-2xl w-full mx-auto sm:mx-0">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-2 px-1 shrink-0">
          <span className="text-xs font-semibold text-indigo-600">
            Étape {activeIndex + 1}/{steps.length}
          </span>
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div
                key={s.id}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i < activeIndex ? 'w-3 bg-emerald-400'
                  : i === activeIndex ? 'w-5 bg-indigo-500'
                  : 'w-3 bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bravo banner */}
        {activeStep.bravo && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 mb-2 text-center shrink-0">
            <p className="text-sm font-semibold text-emerald-700">{activeStep.bravo}</p>
          </div>
        )}

        {/* Active step content — centered, fills available space */}
        <div key={activeStep.id} className="flex-1 flex flex-col items-center justify-center text-center space-y-2 overflow-y-auto px-1">
          {activeStep.icon === 'yapluka' ? (
            <Image src="/yapluka-symbol.png" alt="YAPLUKA" width={48} height={45} className="drop-shadow-md" />
          ) : (
            <div className="text-4xl">{activeStep.icon}</div>
          )}
          <h2 className="text-lg font-bold text-gray-800">{activeStep.title}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">{activeStep.description}</p>
          {activeStep.extra}
        </div>

        {/* CTA button — always visible at bottom */}
        <div className="pt-3 pb-1 text-center shrink-0">
          {activeStep.cta.href ? (
            <Link href={activeStep.cta.href} className="btn-primary">
              {activeStep.cta.label}
            </Link>
          ) : (
            <button
              onClick={activeStep.cta.action}
              className="btn-primary"
            >
              {activeStep.cta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
