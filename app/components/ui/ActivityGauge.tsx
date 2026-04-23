'use client'

type Zone = 'red' | 'orange' | 'green'

type Props = {
  /** Zone de l'aiguille */
  zone: Zone
  /** Taille du SVG en px (default 44) */
  size?: number
  /** Label court affiché en tooltip */
  title?: string
}

/**
 * Jauge d'activité en demi-cercle type speedometer :
 * arc de 180° découpé en 3 secteurs égaux (rouge · orange · vert)
 * avec aiguille pivotant depuis le centre du cercle.
 *
 * - red    : aucun geste sur les 14 derniers jours
 * - orange : gestes sur une seule des 2 dernières semaines
 * - green  : au moins 1 geste par semaine sur les 2 dernières
 */
export default function ActivityGauge({ zone, size = 44, title }: Props) {
  // ViewBox 100×56 pour garder le half-circle bien proportionné
  // (hauteur = 56 laisse la place au pivot + aiguille)
  const VB_W = 100
  const VB_H = 56
  const cx = 50
  const cy = 50
  const rOuter = 44 // rayon du bord extérieur de l'arc
  const rInner = 34 // rayon du bord intérieur → épaisseur d'arc = 10 (~22% du rayon)

  // Angles en degrés, convention mathématique : 180° = gauche, 90° = haut, 0° = droite
  // On balaie de 180° à 0° via le haut → sens trigonométrique inverse en SVG.
  function polar(angleDeg: number, r: number) {
    const a = (angleDeg * Math.PI) / 180
    return {
      x: cx + r * Math.cos(a),
      y: cy - r * Math.sin(a),
    }
  }

  // Secteur annulaire entre startAngle et endAngle (startAngle > endAngle)
  // startAngle côté gauche (180 max), endAngle côté droit (0 min)
  function sectorPath(startAngle: number, endAngle: number): string {
    const outerStart = polar(startAngle, rOuter)
    const outerEnd = polar(endAngle, rOuter)
    const innerEnd = polar(endAngle, rInner)
    const innerStart = polar(startAngle, rInner)
    const large = Math.abs(startAngle - endAngle) > 180 ? 1 : 0
    // Outer arc : de left vers right, sweep=0 (SVG y inversé → bord supérieur)
    // Inner arc : de right vers left, sweep=1
    return [
      `M ${outerStart.x} ${outerStart.y}`,
      `A ${rOuter} ${rOuter} 0 ${large} 0 ${outerEnd.x} ${outerEnd.y}`,
      `L ${innerEnd.x} ${innerEnd.y}`,
      `A ${rInner} ${rInner} 0 ${large} 1 ${innerStart.x} ${innerStart.y}`,
      'Z',
    ].join(' ')
  }

  // 3 tiers de 60° chacun : rouge 180→120, orange 120→60, vert 60→0
  const RED = '#ef4444'
  const ORANGE = '#f59e0b'
  const GREEN = '#10b981'

  // Centre de chaque secteur pour positionner l'aiguille
  const needleAngle = zone === 'red' ? 150 : zone === 'orange' ? 90 : 30

  // Aiguille : longue tige qui part du pivot vers l'arc
  const needleLength = rOuter - 4
  const needleTip = polar(needleAngle, needleLength)
  // Base de l'aiguille élargie (petit triangle pour effet speedometer)
  const baseOffset = 3
  const baseLeft = {
    x: cx + baseOffset * Math.cos(((needleAngle + 90) * Math.PI) / 180),
    y: cy - baseOffset * Math.sin(((needleAngle + 90) * Math.PI) / 180),
  }
  const baseRight = {
    x: cx + baseOffset * Math.cos(((needleAngle - 90) * Math.PI) / 180),
    y: cy - baseOffset * Math.sin(((needleAngle - 90) * Math.PI) / 180),
  }

  // Hauteur réelle rendue = proportionnelle au viewBox (ratio 56/100)
  const h = size * (VB_H / VB_W)

  return (
    <svg
      width={size}
      height={h}
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="img"
      aria-label={title ?? `Activité : ${zone}`}
    >
      <title>{title ?? `Activité : ${zone}`}</title>

      {/* Secteurs — le secteur actif est opaque, les autres atténués */}
      <path d={sectorPath(180, 120)} fill={RED} opacity={zone === 'red' ? 1 : 0.22} />
      <path d={sectorPath(120, 60)} fill={ORANGE} opacity={zone === 'orange' ? 1 : 0.22} />
      <path d={sectorPath(60, 0)} fill={GREEN} opacity={zone === 'green' ? 1 : 0.22} />

      {/* Aiguille — triangle allongé du pivot au bord de l'arc */}
      <polygon
        points={`${baseLeft.x},${baseLeft.y} ${baseRight.x},${baseRight.y} ${needleTip.x},${needleTip.y}`}
        fill="#1a1a2e"
      />
      {/* Pivot central */}
      <circle cx={cx} cy={cy} r={4} fill="#1a1a2e" />
      <circle cx={cx} cy={cy} r={1.6} fill="#fbbf24" />
    </svg>
  )
}
