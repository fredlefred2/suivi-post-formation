'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getOnboardingAck, acknowledgeStep } from '@/lib/onboarding'

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
  const [ack, setAck] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = getOnboardingAck(userId)
    // Auto-acknowledge action step when actions exist
    if (totalActions >= 1 && !stored['first-action']) {
      stored['first-action'] = true
      acknowledgeStep('first-action', userId)
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
      icon: '🚀',
      description: 'Progress + vous accompagne pour transformer votre formation en actions concrètes. Voici le programme :',
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

    // ── Étape 5 : Première action ──
    {
      id: 'first-action',
      title: 'Ajoutez votre première action',
      icon: '⚡',
      bravo: '🎉 Parfait ! Vos 3 axes sont définis !',
      description: 'Chaque axe se nourrit d\'actions concrètes. Vous allez être redirigé vers vos axes : cliquez sur le bouton « Ajouter » qui clignote pour créer votre première action.',
      extra: (
        <div className="bg-amber-50 rounded-xl p-3 mt-3 text-left text-sm text-amber-800">
          <p className="font-medium mb-1">Exemple d&apos;action :</p>
          <p className="text-amber-600">&laquo; J&apos;ai confié la préparation de la réunion à Julie &raquo;</p>
        </div>
      ),
      isCompleted: ack['first-action'] ?? false,
      cta: {
        label: 'Allons-y !',
        action: () => router.push('/axes?onboarding=highlight-add'),
      },
    },

    // ── Étape 6 : Supprimer l'action ──
    {
      id: 'edit-delete',
      title: 'Essayez de supprimer',
      icon: '🗑️',
      bravo: '🎉 Bravo ! Première action enregistrée !',
      description: 'Pas de panique, vous pouvez supprimer ou modifier une action à tout moment. Pour vous entraîner, supprimez l\'action que vous venez de créer en cliquant sur l\'icône 🗑️ qui clignote.',
      extra: (
        <div className="bg-red-50 rounded-xl p-3 mt-3 text-sm text-red-800">
          <p>C&apos;est juste un entraînement : vous pourrez en ajouter de vraies juste après !</p>
        </div>
      ),
      isCompleted: ack['edit-delete'] ?? false,
      cta: {
        label: 'Compris !',
        action: () => router.push('/axes?onboarding=highlight-delete'),
      },
    },

    // ── Étape 7 : Dynamique de progression ──
    {
      id: 'progression',
      title: 'Votre dynamique de progression',
      icon: '📈',
      bravo: '🎉 Bien joué ! Vous maîtrisez la gestion des actions !',
      description: 'Plus vous ajoutez d\'actions, plus votre dynamique monte ! Voici les 5 niveaux que vous pouvez atteindre :',
      extra: (
        <div className="flex flex-col gap-1.5 mt-3 max-w-xs mx-auto">
          {[
            { icon: '📍', label: 'Ancrage', desc: '0 action', color: 'bg-gray-100 text-gray-700' },
            { icon: '👣', label: 'Impulsion', desc: '1-2 actions', color: 'bg-teal-100 text-teal-700' },
            { icon: '🥁', label: 'Rythme', desc: '3-5 actions', color: 'bg-blue-100 text-blue-700' },
            { icon: '🔥', label: 'Intensité', desc: '6-8 actions', color: 'bg-orange-100 text-orange-700' },
            { icon: '🚀', label: 'Propulsion', desc: '9+ actions', color: 'bg-purple-100 text-purple-700' },
          ].map((level) => (
            <div key={level.label} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${level.color}`}>
              <span className="text-lg">{level.icon}</span>
              <span className="font-medium text-sm flex-1">{level.label}</span>
              <span className="text-xs opacity-70">{level.desc}</span>
            </div>
          ))}
        </div>
      ),
      isCompleted: ack['progression'] ?? false,
      cta: { label: 'Compris !', action: () => acknowledge('progression') },
    },

    // ── Étape 8 : Check-in hebdomadaire ──
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
      cta: { label: 'C\'est parti, je commence !', action: () => acknowledge('checkin') },
    },
  ]

  if (!mounted) return null

  const activeIndex = steps.findIndex((s) => !s.isCompleted)

  // All done → show normal dashboard
  if (activeIndex === -1) return <>{children}</>

  const activeStep = steps[activeIndex]

  return (
    <div className="space-y-6 pb-4">
      <div>
        <h1 className="page-title">Bonjour {firstName} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">Découverte de Progress +</p>
      </div>

      <div className="card overflow-hidden">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-2 px-1">
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
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 mb-3 text-center">
            <p className="text-sm font-semibold text-emerald-700">{activeStep.bravo}</p>
          </div>
        )}

        {/* Active step content */}
        <div key={activeStep.id} className="text-center space-y-3 pt-2 pb-1">
          <div className="text-5xl">{activeStep.icon}</div>
          <h2 className="text-lg font-bold text-gray-800">{activeStep.title}</h2>
          <p className="text-sm text-gray-500 leading-relaxed">{activeStep.description}</p>
          {activeStep.extra}
          <div className="pt-2">
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
    </div>
  )
}
