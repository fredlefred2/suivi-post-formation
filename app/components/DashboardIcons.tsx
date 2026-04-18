'use client'

import { Zap, ClipboardCheck, Lightbulb, MessageSquare, type LucideIcon } from 'lucide-react'

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
  return (
    <div className="grid grid-cols-4 gap-2">
      {/* ⚡ J'AI AGI */}
      <IconTile
        Icon={Zap}
        label="J'ai agi !"
        gradient="linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)"
        shadowColor="rgba(251,191,36,0.45)"
        hasAction={axes.length > 0}
        onClick={onAction}
      />

      {/* 📋 CHECK-IN — toujours cliquable (neuf OU historique) */}
      <IconTile
        Icon={ClipboardCheck}
        label="Check-in"
        gradient="linear-gradient(135deg, #14b8a6 0%, #0f766e 100%)"
        shadowColor="rgba(20,184,166,0.4)"
        streakBadge={streak >= 1 ? streak : undefined}
        hasAction={checkinAvailable && !checkinDone}
        onClick={onCheckin}
      />

      {/* 💡 COACH — toujours cliquable (nouveau tip OU historique) */}
      <IconTile
        Icon={Lightbulb}
        label="Coach"
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
    </button>
  )
}
