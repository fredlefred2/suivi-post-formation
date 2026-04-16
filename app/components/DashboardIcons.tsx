'use client'

import { Zap, ClipboardCheck, Gift, Brain, type LucideIcon } from 'lucide-react'
import { getNextLevel } from '@/lib/axeHelpers'

type AxeInfo = { id: string; completedCount: number }

type Props = {
  axes: AxeInfo[]
  streak: number
  checkinAvailable: boolean      // ven-lun + pas encore fait
  checkinDone: boolean
  tipAvailable: boolean          // tip non lu
  quizAvailable: boolean         // phase 2, false pour l'instant
  onAction: () => void
  onCheckin: () => void
  onCoach: () => void
  onQuiz: () => void
}

/**
 * Les 4 icônes permanentes du dashboard apprenant — style iOS gradient.
 * Remplace le bouton "Nouvelle Action", le bandeau check-in, le bandeau coach.
 */
export default function DashboardIcons({
  axes,
  streak,
  checkinAvailable,
  checkinDone,
  tipAvailable,
  quizAvailable,
  onAction,
  onCheckin,
  onCoach,
  onQuiz,
}: Props) {
  // Sous-texte dynamique "J'ai agi" : prochain palier sur l'axe le plus avancé
  const axeClosestToNext = axes
    .map(a => ({ count: a.completedCount, next: getNextLevel(a.completedCount) }))
    .filter(x => x.next !== null)
    .sort((a, b) => (a.next!.delta - b.next!.delta))[0]

  const actionSubtext = axeClosestToNext
    ? `→ ${axeClosestToNext.next!.delta} pour ${axeClosestToNext.next!.icon}`
    : axes.length > 0
      ? '👑 Tout au max !'
      : '1ère action !'

  // Sous-texte check-in
  const checkinSubtext = checkinDone
    ? 'Fait ✓'
    : checkinAvailable
      ? 'Disponible !'
      : 'Dès vendredi'

  return (
    <div className="grid grid-cols-4 gap-2">
      {/* ⚡ J'AI AGI */}
      <IconTile
        Icon={Zap}
        label="J'ai agi !"
        subtext={actionSubtext}
        subtextColor="#10b981"
        gradient="linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
        shadowColor="rgba(251,191,36,0.45)"
        hasAction={axes.length > 0}
        onClick={onAction}
      />

      {/* 📋 CHECK-IN */}
      <IconTile
        Icon={ClipboardCheck}
        label="Check-in"
        subtext={checkinSubtext}
        subtextColor={checkinAvailable && !checkinDone ? '#10b981' : '#a0937c'}
        gradient="linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)"
        shadowColor="rgba(20,184,166,0.4)"
        streakBadge={streak >= 1 ? streak : undefined}
        hasAction={checkinAvailable && !checkinDone}
        disabled={checkinDone || !checkinAvailable}
        onClick={onCheckin}
      />

      {/* 🎁 COACH */}
      <IconTile
        Icon={Gift}
        label="Coach"
        subtext={tipAvailable ? 'Nouveau tip !' : 'En attente'}
        subtextColor={tipAvailable ? '#10b981' : '#a0937c'}
        gradient="linear-gradient(135deg, #312e81 0%, #1a1a2e 100%)"
        shadowColor="rgba(26,26,46,0.4)"
        notificationBadge={tipAvailable}
        hasAction={tipAvailable}
        disabled={!tipAvailable}
        onClick={onCoach}
      />

      {/* 🧠 QUIZ */}
      <IconTile
        Icon={Brain}
        label="Quiz"
        subtext={quizAvailable ? 'Nouveau quiz !' : 'Bientôt'}
        subtextColor={quizAvailable ? '#10b981' : '#a0937c'}
        gradient="linear-gradient(135deg, #a855f7 0%, #6d28d9 100%)"
        shadowColor="rgba(168,85,247,0.4)"
        hasAction={quizAvailable}
        disabled={!quizAvailable}
        onClick={onQuiz}
      />
    </div>
  )
}

function IconTile({
  Icon,
  label,
  subtext,
  subtextColor,
  gradient,
  shadowColor,
  streakBadge,
  notificationBadge,
  hasAction,
  disabled,
  onClick,
}: {
  Icon: LucideIcon
  label: string
  subtext: string
  subtextColor: string
  gradient: string
  shadowColor: string
  streakBadge?: number
  notificationBadge?: boolean
  hasAction?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1.5 py-1 ${disabled ? 'opacity-55 pointer-events-none' : ''}`}
    >
      {/* Carré gradient */}
      <div
        className={`relative w-[60px] h-[60px] rounded-[18px] flex items-center justify-center transition-transform active:scale-90 ${
          hasAction ? 'icon-tile-pulse' : ''
        }`}
        style={{
          background: gradient,
          boxShadow: hasAction ? `0 6px 18px ${shadowColor}` : `0 4px 12px ${shadowColor}`,
        }}
      >
        <Icon size={26} strokeWidth={2.2} className="text-white" />

        {/* Badge notification rouge */}
        {notificationBadge && (
          <span
            className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-red-500 border-[3px]"
            style={{ borderColor: '#faf8f4' }}
          />
        )}

        {/* Badge streak (check-in) */}
        {streakBadge !== undefined && streakBadge >= 1 && (
          <span
            className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-lg text-[10px] font-extrabold leading-none"
            style={{
              background: '#f97316',
              color: 'white',
              border: '2px solid #faf8f4',
            }}
          >
            🔥{streakBadge}
          </span>
        )}
      </div>

      {/* Label */}
      <div className="text-[11px] font-bold leading-tight text-center" style={{ color: '#1a1a2e' }}>
        {label}
      </div>

      {/* Sous-texte */}
      <div
        className="text-[9px] font-semibold leading-none text-center truncate max-w-full px-1"
        style={{ color: subtextColor }}
      >
        {subtext}
      </div>
    </button>
  )
}
