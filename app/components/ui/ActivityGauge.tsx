'use client'

type Zone = 'red' | 'orange' | 'green'

type Props = {
  /** Zone de l'aiguille */
  zone: Zone
  /** Taille totale du SVG en px (default 36) */
  size?: number
  /** Label court affiché en tooltip */
  title?: string
}

/**
 * Jauge d'activité type compteur : 3 zones (rouge · orange · vert)
 * avec une aiguille positionnée selon la zone.
 *
 * - red    : aucun geste sur les 14 derniers jours
 * - orange : gestes sur une seule des 2 dernières semaines
 * - green  : au moins 1 geste par semaine sur les 2 dernières
 */
export default function ActivityGauge({ zone, size = 36, title }: Props) {
  // Arc semi-circulaire de -90° à +90° (180° total)
  // On divise en 3 tiers de 60° chacun : rouge (-90→-30), orange (-30→30), vert (30→90)
  const w = size
  const h = size * 0.68
  const cx = w / 2
  const cy = h - 2
  const r = w / 2 - 3

  // Positions angulaires des segments (°). 180 = gauche, 0 = droite.
  // SVG arcs : on va de angle=180 à angle=0 en balayant dans le sens horaire.
  function polar(angleDeg: number, radius: number) {
    const a = (angleDeg * Math.PI) / 180
    return { x: cx + radius * Math.cos(a), y: cy - radius * Math.sin(a) }
  }

  function arcPath(startDeg: number, endDeg: number, radius: number, innerRadius: number) {
    const start = polar(startDeg, radius)
    const end = polar(endDeg, radius)
    const startIn = polar(endDeg, innerRadius)
    const endIn = polar(startDeg, innerRadius)
    const largeArc = Math.abs(startDeg - endDeg) > 180 ? 1 : 0
    // Sens horaire : sweep=0 (car on va de 180 vers 0)
    return [
      `M ${start.x} ${start.y}`,
      `A ${radius} ${radius} 0 ${largeArc} 0 ${end.x} ${end.y}`,
      `L ${startIn.x} ${startIn.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${endIn.x} ${endIn.y}`,
      'Z',
    ].join(' ')
  }

  const innerR = r * 0.58

  // Angle de l'aiguille selon la zone (en degrés, 180=gauche, 0=droite)
  // On vise le centre de chaque secteur.
  const needleAngle =
    zone === 'red' ? 150 : zone === 'orange' ? 90 : 30

  // Couleurs selon la charte
  const RED = '#f87171'
  const ORANGE = '#fbbf24'
  const GREEN = '#6ee7b7'

  const needle = polar(needleAngle, r - 2)

  return (
    <svg
      width={w}
      height={h + 3}
      viewBox={`0 0 ${w} ${h + 3}`}
      role="img"
      aria-label={title ?? `Activité : ${zone}`}
    >
      <title>{title ?? `Activité : ${zone}`}</title>
      {/* Rouge : 180 → 120 */}
      <path d={arcPath(180, 120, r, innerR)} fill={RED} opacity={zone === 'red' ? 1 : 0.32} />
      {/* Orange : 120 → 60 */}
      <path d={arcPath(120, 60, r, innerR)} fill={ORANGE} opacity={zone === 'orange' ? 1 : 0.32} />
      {/* Vert : 60 → 0 */}
      <path d={arcPath(60, 0, r, innerR)} fill={GREEN} opacity={zone === 'green' ? 1 : 0.32} />

      {/* Aiguille */}
      <line
        x1={cx}
        y1={cy}
        x2={needle.x}
        y2={needle.y}
        stroke="#1a1a2e"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* Pivot */}
      <circle cx={cx} cy={cy} r={2.2} fill="#1a1a2e" />
    </svg>
  )
}
