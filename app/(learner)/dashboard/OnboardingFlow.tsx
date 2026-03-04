'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type Props = {
  firstName: string
  axesCount: number
  totalActions: number
  totalCheckins: number
}

const STORAGE_KEY = 'onboarding_ack'

function getAck(): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch { return {} }
}

type Step = {
  id: string
  title: string
  icon: string
  description: string
  extra?: React.ReactNode
  isCompleted: boolean
  cta: { label: string; href?: string; action?: () => void }
}

export default function OnboardingFlow({ firstName, axesCount, totalActions, totalCheckins }: Props) {
  const [ack, setAck] = useState<Record<string, boolean>>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setAck(getAck())
    setMounted(true)
  }, [])

  function acknowledge(stepId: string) {
    const next = { ...ack, [stepId]: true }
    setAck(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const steps: Step[] = [
    {
      id: 'welcome',
      title: `Bienvenue ${firstName} !`,
      icon: '🚀',
      description: 'Progress + vous accompagne pour transformer votre formation en actions concrètes. Le principe est simple :',
      extra: (
        <div className="flex flex-col gap-2 text-left max-w-xs mx-auto mt-3">
          <div className="flex items-center gap-3 text-sm">
            <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">1</span>
            <span className="text-gray-600">Définissez <strong>3 axes</strong> de progrès</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">2</span>
            <span className="text-gray-600">Ajoutez des <strong>actions concrètes</strong></span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0">3</span>
            <span className="text-gray-600">Faites votre <strong>check-in</strong> chaque vendredi</span>
          </div>
        </div>
      ),
      isCompleted: axesCount >= 1,
      cta: { label: 'Commencer', href: '/axes' },
    },
    {
      id: 'first-axis',
      title: 'Créez votre premier axe',
      icon: '🎯',
      description: 'Un axe de progrès représente un domaine que vous souhaitez améliorer suite à votre formation. Cliquez sur "Ajouter un axe" et remplissez le formulaire.',
      extra: (
        <div className="bg-indigo-50 rounded-xl p-3 mt-3 text-left text-sm text-indigo-800">
          <p className="font-medium mb-1">Exemple d&apos;axe :</p>
          <p className="text-indigo-600">« Déléguer efficacement » — Difficulté : Intermédiaire</p>
        </div>
      ),
      isCompleted: axesCount >= 1,
      cta: { label: 'Créer un axe', href: '/axes' },
    },
    {
      id: 'first-action',
      title: 'Ajoutez votre première action',
      icon: '⚡',
      description: 'Chaque axe se nourrit d\'actions concrètes que vous menez au quotidien. Allez sur votre axe et cliquez "Ajouter" pour décrire une action réalisée.',
      extra: (
        <div className="bg-amber-50 rounded-xl p-3 mt-3 text-left text-sm text-amber-800">
          <p className="font-medium mb-1">Exemple d&apos;action :</p>
          <p className="text-amber-600">« J&apos;ai confié la préparation de la réunion à Julie »</p>
        </div>
      ),
      isCompleted: totalActions >= 1,
      cta: { label: 'Ajouter une action', href: '/axes' },
    },
    {
      id: 'edit-delete',
      title: 'Modifier et supprimer',
      icon: '✏️',
      description: 'Vous pouvez modifier ou supprimer une action à tout moment grâce aux icônes crayon et poubelle à côté de chaque action.',
      extra: (
        <div className="flex items-center justify-center gap-6 mt-3 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">✏️</span>
            <span>Modifier</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">🗑️</span>
            <span>Supprimer</span>
          </div>
        </div>
      ),
      isCompleted: ack['edit-delete'] ?? false,
      cta: { label: 'Compris !', action: () => acknowledge('edit-delete') },
    },
    {
      id: 'progression',
      title: 'Votre dynamique de progression',
      icon: '📈',
      description: 'Plus vous ajoutez d\'actions, plus votre dynamique monte ! Voici les 5 niveaux :',
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
    {
      id: 'checkin',
      title: 'Le check-in hebdomadaire',
      icon: '📋',
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
      cta: { label: 'C\'est parti !', action: () => acknowledge('checkin') },
    },
  ]

  // Don't render until mounted (need localStorage)
  if (!mounted) return null

  const activeIndex = steps.findIndex((s) => !s.isCompleted)
  // All done → hide onboarding
  if (activeIndex === -1) return null

  const activeStep = steps[activeIndex]

  return (
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
            <button onClick={activeStep.cta.action} className="btn-primary">
              {activeStep.cta.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
