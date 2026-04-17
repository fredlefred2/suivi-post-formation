'use client'

import { Zap, ClipboardCheck, Gift, MessageSquare, type LucideIcon } from 'lucide-react'
import { getNextLevel } from '@/lib/axeHelpers'

type AxeInfo = { id: string; completedCount: number }

type Props = {
  axes: AxeInfo[]
  streak: number
  checkinAvailable: boolean      // ven-lun + pas encore fait
  checkinDone: boolean
  tipAvailable: boolean          // tip non lu
  messagesUnread: number         // nombre de messages non lus
  onAction: () => void
  onCheckin: () => void
  onCoach: () => void
  onMessages: () => void
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
  messagesUnread,
  onAction,
  onCheckin,
  onCoach,
  onMessages,
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

  // Sous-texte messages
  const messagesSubtext = messagesUnread > 0
    ? `${messagesUnread} non lu${messagesUnread > 1 ? 's' : ''}`
    : 'Tout lu ✓'

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

      {/* 📋 CHECK-IN — toujours cliquable (neuf OU historique) */}
      <IconTile
        Icon={ClipboardCheck}
        label="Check-in"
        subtext={checkinSubtext}
        subtextColor={checkinAvailable && !checkinDone ? '#10b981' : '#a0937c'}
        gradient="linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)"
        shadowColor="rgba(20,184,166,0.4)"
        streakBadge={streak >= 1 ? streak : undefined}
        hasAction={checkinAvailable && !checkinDone}
        onClick={onCheckin}
      />

      {/* 🎁 COACH — toujours cliquable (nouveau tip OU historique) */}
      <IconTile
        Icon={Gift}
        label="Coach"
        subtext={tipAvailable ? 'Nouveau tip !' : 'Voir historique'}
        subtextColor={tipAvailable ? '#10b981' : '#a0937c'}
        gradient="linear-gradient(135deg, #312e81 0%, #1a1a2e 100%)"
        shadowColor="rgba(26,26,46,0.4)"
        notificationBadge={tipAvailable}
        hasAction={tipAvailable}
        onClick={onCoach}
      />

      {/* 💬 MESSAGES */}
      <IconTile
        Icon={MessageSquare}
        label="Messages"
        subtext={messagesSubtext}
        subtextColor={messagesUnread > 0 ? '#10b981' : '#a0937c'}
        gradient="linear-gradient(135deg, #fb7185 0%, #e11d48 100%)"
        shadowColor="rgba(251,113,133,0.4)"
        notificationBadge={messagesUnread > 0}
        notificationCount={messagesUnread > 0 ? messagesUnread : undefined}
        hasAction={messagesUnread > 0}
        onClick={onMessages}
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
  notificationCount,
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
  notificationCount?: number
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

        {/* Badge notification rouge (avec ou sans compteur) */}
        {notificationBadge && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 border-[3px] flex items-center justify-center px-1 text-[10px] font-extrabold text-white leading-none"
            style={{ borderColor: '#faf8f4' }}
          >
            {notificationCount && notificationCount > 0 ? notificationCount : null}
          </span>
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
