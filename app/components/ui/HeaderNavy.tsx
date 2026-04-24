import type { ReactNode } from 'react'

type Props = {
  /** Titre principal (ex: "Team", "Mes actions", "Bon matin Alain 👋") */
  title: ReactNode
  /** Sous-titre (ex: nom du groupe, nb participants) */
  subtitle?: ReactNode
  /** Contenu à droite (stats, actions) */
  right?: ReactNode
  /** Bloc enfant sous le header (phrase contextuelle, bandeau info) */
  children?: ReactNode
  /** Variante compacte (team, fiches) vs standard (dashboard) */
  compact?: boolean
  className?: string
}

/**
 * HeaderNavy — composant partagé pour le header navy dégradé.
 * Utilisé apprenant + formateur. Gradient 165deg navy → purple,
 * cercle décoratif amber en haut à droite, rounded 20px (standard)
 * ou 18px (compact).
 */
export default function HeaderNavy({ title, subtitle, right, children, compact = false, className }: Props) {
  const padding = compact ? '10px 14px' : '14px 18px'
  const borderRadius = compact ? 18 : 20
  const decoSize = compact ? 56 : 70

  return (
    <div
      className={`relative overflow-hidden ${className ?? ''}`}
      style={{
        background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)',
        padding,
        borderRadius,
        color: '#fff',
      }}
    >
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          top: -Math.round(decoSize / 4),
          right: -Math.round(decoSize / 6),
          width: decoSize,
          height: decoSize,
          background: 'rgba(251,191,36,0.14)',
        }}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1
              className="font-extrabold leading-tight"
              style={{ fontSize: compact ? 15 : 17, letterSpacing: '-0.005em' }}
            >
              {title}
            </h1>
            {subtitle && (
              <p
                className="mt-0.5 font-semibold truncate"
                style={{ fontSize: compact ? 10.5 : 11.5, color: 'rgba(255,255,255,0.58)' }}
              >
                {subtitle}
              </p>
            )}
          </div>
          {right && <div className="shrink-0 text-right">{right}</div>}
        </div>
        {children && <div className="mt-2.5">{children}</div>}
      </div>
    </div>
  )
}
