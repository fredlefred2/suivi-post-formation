'use client'

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
 * Les 4 icônes permanentes du dashboard apprenant.
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
      : 'Déclare ta 1ère action'

  // Sous-texte check-in
  const checkinSubtext = checkinDone
    ? 'Fait ✓'
    : checkinAvailable
      ? 'Disponible !'
      : 'Dispo vendredi'

  return (
    <div className="grid grid-cols-4 gap-2">
      <IconCard
        icon="⚡"
        label="J'ai agi !"
        subtext={actionSubtext}
        subtextColor="#10b981"
        hasAction={axes.length > 0}
        onClick={onAction}
      />
      <IconCard
        icon="📋"
        label="Check-in"
        subtext={checkinSubtext}
        subtextColor={checkinAvailable ? '#10b981' : '#a0937c'}
        streakBadge={streak >= 1 ? streak : undefined}
        hasAction={checkinAvailable}
        disabled={!checkinAvailable && !checkinDone}
        onClick={onCheckin}
      />
      <IconCard
        icon="🎁"
        label="Coach"
        subtext={tipAvailable ? 'Nouveau tip !' : 'Rien pour l\'instant'}
        subtextColor={tipAvailable ? '#10b981' : '#a0937c'}
        notificationBadge={tipAvailable}
        hasAction={tipAvailable}
        disabled={!tipAvailable}
        onClick={onCoach}
      />
      <IconCard
        icon="❓"
        label="Quiz"
        subtext={quizAvailable ? 'Nouveau quiz !' : 'Bientôt !'}
        subtextColor={quizAvailable ? '#10b981' : '#a0937c'}
        hasAction={quizAvailable}
        disabled={!quizAvailable}
        onClick={onQuiz}
      />
    </div>
  )
}

function IconCard({
  icon,
  label,
  subtext,
  subtextColor,
  streakBadge,
  notificationBadge,
  hasAction,
  disabled,
  onClick,
}: {
  icon: string
  label: string
  subtext: string
  subtextColor: string
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
      className={`relative rounded-2xl p-3 text-center transition-all active:scale-95 ${
        hasAction ? 'icon-card-pulse' : ''
      } ${disabled ? 'opacity-45 pointer-events-none' : ''}`}
      style={{
        background: 'white',
        border: hasAction ? '2px solid #fbbf24' : '2px solid #f0ebe0',
        boxShadow: hasAction ? '0 4px 14px rgba(251,191,36,0.2)' : '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Badge notification rouge */}
      {notificationBadge && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 border-2 border-white flex items-center justify-center"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white" />
        </span>
      )}

      {/* Icône */}
      <div className="text-[28px] leading-none mb-1">{icon}</div>

      {/* Label */}
      <div className="text-[11px] font-bold" style={{ color: '#1a1a2e' }}>
        {label}
      </div>

      {/* Streak badge (check-in) */}
      {streakBadge !== undefined && streakBadge >= 1 && (
        <div className="flex items-center justify-center gap-0.5 mt-1 text-[11px] font-extrabold"
          style={{ color: '#f97316' }}>
          🔥 {streakBadge}
        </div>
      )}

      {/* Sous-texte */}
      <div className="text-[9px] mt-1 font-medium truncate" style={{ color: subtextColor }}>
        {subtext}
      </div>
    </button>
  )
}
