import type { ReactNode } from 'react'

type ChipVariant = 'amber' | 'teal' | 'coral' | 'sky' | 'emerald' | 'muted' | 'navy'
type ChipSize = 'xs' | 'sm' | 'md'

type Props = {
  variant?: ChipVariant
  size?: ChipSize
  icon?: ReactNode
  children: ReactNode
  className?: string
  title?: string
}

const variants: Record<ChipVariant, { bg: string; color: string; border: string }> = {
  amber:   { bg: '#fffbeb', color: '#92400e', border: '#fde68a' },
  teal:    { bg: '#ccfbf1', color: '#115e59', border: '#99f6e4' },
  coral:   { bg: '#ffe4e6', color: '#9f1239', border: '#fecdd3' },
  sky:     { bg: '#e0f2fe', color: '#075985', border: '#bae6fd' },
  emerald: { bg: '#d1fae5', color: '#065f46', border: '#86efac' },
  muted:   { bg: '#f4efe3', color: '#5f5b55', border: '#e0d8c8' },
  navy:    { bg: '#1a1a2e', color: '#fbbf24', border: '#1a1a2e' },
}

const sizes: Record<ChipSize, { padding: string; fontSize: string; gap: string }> = {
  xs: { padding: '2px 7px', fontSize: '10px', gap: '3px' },
  sm: { padding: '3px 9px', fontSize: '11px', gap: '4px' },
  md: { padding: '4px 12px', fontSize: '12px', gap: '5px' },
}

/**
 * Chip — pastille colorée réutilisable (stats, statuts, tags).
 * Variants alignés sur le design system v1.30.
 */
export default function Chip({ variant = 'muted', size = 'sm', icon, children, className, title }: Props) {
  const v = variants[variant]
  const s = sizes[size]
  return (
    <span
      className={`inline-flex items-center font-extrabold rounded-full ${className ?? ''}`}
      style={{
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        padding: s.padding,
        fontSize: s.fontSize,
        gap: s.gap,
        lineHeight: 1.2,
      }}
      title={title}
    >
      {icon}
      {children}
    </span>
  )
}
