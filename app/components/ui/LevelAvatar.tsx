type Props = {
  /** Nombre d'actions cumulées sur l'axe */
  actionCount: number
  /** Taille du cercle en px (default 40) */
  size?: number
  className?: string
  /** Override pour mettre des initiales au lieu de l'icône niveau */
  initials?: string
}

// Couleurs par niveau (alignées sur le design system v1.30)
const LEVEL_COLORS: Record<number, { border: string; halo: string }> = {
  0: { border: '#a0937c',  halo: 'rgba(160,147,124,0.12)' }, // Intention — subtle
  1: { border: '#38bdf8',  halo: 'rgba(56,189,248,0.12)' },  // Essai — sky
  2: { border: '#10b981',  halo: 'rgba(16,185,129,0.12)' },  // Habitude — emerald
  3: { border: '#f59e0b',  halo: 'rgba(245,158,11,0.12)' },  // Réflexe — amber
  4: { border: '#fb7185',  halo: 'rgba(251,113,133,0.12)' }, // Maîtrise — coral
}

const LEVEL_ICONS: Record<number, string> = {
  0: '💡', 1: '🧪', 2: '🔄', 3: '⚡', 4: '👑',
}

const LEVEL_LABELS: Record<number, string> = {
  0: 'Intention', 1: 'Essai', 2: 'Habitude', 3: 'Réflexe', 4: 'Maîtrise',
}

function getLevel(count: number): number {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}

/**
 * LevelAvatar — avatar rond avec bordure colorée selon le niveau d'un axe.
 * Fond blanc + icône niveau au centre (ou initiales si passées).
 * Halo doux extérieur avec la couleur du niveau.
 */
export default function LevelAvatar({ actionCount, size = 40, className, initials }: Props) {
  const level = getLevel(actionCount)
  const { border, halo } = LEVEL_COLORS[level]
  const icon = LEVEL_ICONS[level]
  const label = LEVEL_LABELS[level]
  const borderWidth = size >= 48 ? 3 : 2.5
  const haloWidth = size >= 48 ? 3 : 2
  const fontSize = initials ? Math.round(size * 0.32) : Math.round(size * 0.45)

  return (
    <div
      className={`rounded-full flex items-center justify-center flex-shrink-0 ${className ?? ''}`}
      style={{
        width: size,
        height: size,
        background: '#fff',
        border: `${borderWidth}px solid ${border}`,
        boxShadow: `0 0 0 ${haloWidth}px ${halo}`,
        fontSize,
        fontWeight: initials ? 800 : undefined,
        color: initials ? '#1a1a2e' : undefined,
      }}
      title={label}
    >
      {initials ?? icon}
    </div>
  )
}
