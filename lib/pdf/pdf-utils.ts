import jsPDF from 'jspdf'

// ── Couleurs de la marque (RGB) ──
export const COLORS = {
  primary: [67, 56, 202] as const,        // indigo-700
  primaryLight: [99, 102, 241] as const,   // indigo-500
  primaryDark: [30, 27, 75] as const,      // indigo-950
  purple: [124, 58, 237] as const,         // violet-600
  purpleLight: [147, 51, 234] as const,    // purple-600
  textDark: [31, 41, 55] as const,         // gray-800
  textMedium: [107, 114, 128] as const,    // gray-500
  textLight: [156, 163, 175] as const,     // gray-400
  sunny: [251, 191, 36] as const,          // amber-400
  sunnyBg: [254, 243, 199] as const,       // amber-100
  sunnyText: [120, 53, 15] as const,       // amber-900
  cloudy: [56, 189, 248] as const,         // sky-400
  cloudyBg: [186, 230, 253] as const,      // sky-200
  cloudyText: [12, 74, 110] as const,      // sky-900
  stormy: [239, 68, 68] as const,          // red-500
  stormyBg: [254, 226, 226] as const,      // red-200
  stormyText: [127, 29, 29] as const,      // red-900
  white: [255, 255, 255] as const,
  bgLight: [249, 250, 251] as const,       // gray-50
  bgCard: [238, 242, 255] as const,        // indigo-50
  border: [229, 231, 235] as const,        // gray-200
  cardBorder: [139, 92, 246, 0.15] as const, // violet avec opacité
  green: [34, 197, 94] as const,           // green-500
  greenBg: [220, 252, 231] as const,       // green-100
  redBg: [254, 226, 226] as const,         // red-100
  teal: [20, 184, 166] as const,           // teal-500
  blue: [59, 130, 246] as const,           // blue-500
  orange: [249, 115, 22] as const,         // orange-500
  purpleDyn: [168, 85, 247] as const,      // purple-500
}

// ── Échelle de dynamique ──
export const DYNAMIQUE_SCALE = [
  { label: 'Veille', icon: '~', color: [156, 163, 175] as const },        // gray
  { label: 'Impulsion', icon: '>', color: [20, 184, 166] as const },     // teal
  { label: 'Rythme', icon: '>>', color: [59, 130, 246] as const },       // blue
  { label: 'Intensité', icon: '>>>', color: [249, 115, 22] as const },   // orange
  { label: 'Propulsion', icon: '!', color: [168, 85, 247] as const },    // purple
]

export function getDynamiqueForCount(avgPerWeek: number) {
  if (avgPerWeek === 0) return { level: 0, ...DYNAMIQUE_SCALE[0] }
  if (avgPerWeek <= 2) return { level: 1, ...DYNAMIQUE_SCALE[1] }
  if (avgPerWeek <= 5) return { level: 2, ...DYNAMIQUE_SCALE[2] }
  if (avgPerWeek <= 8) return { level: 3, ...DYNAMIQUE_SCALE[3] }
  return { level: 4, ...DYNAMIQUE_SCALE[4] }
}

// Même logique que getDynamique dans axeHelpers.ts (par nb actions d'un axe)
export function getDynamiqueForActions(count: number) {
  if (count === 0) return { level: 0, ...DYNAMIQUE_SCALE[0] }
  if (count <= 2) return { level: 1, ...DYNAMIQUE_SCALE[1] }
  if (count <= 5) return { level: 2, ...DYNAMIQUE_SCALE[2] }
  if (count <= 8) return { level: 3, ...DYNAMIQUE_SCALE[3] }
  return { level: 4, ...DYNAMIQUE_SCALE[4] }
}

// ═══════════════════════════════════════════
// PAGE DE COUVERTURE
// ═══════════════════════════════════════════

export function drawCoverPage(doc: jsPDF, groupName: string, trainerName: string, dateStr: string) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  // Fond gradient (3 bandes verticales)
  doc.setFillColor(30, 27, 75)   // indigo-950
  doc.rect(0, 0, w, h / 3, 'F')
  doc.setFillColor(67, 56, 202)  // indigo-700
  doc.rect(0, h / 3, w, h / 3, 'F')
  doc.setFillColor(99, 102, 241) // indigo-500
  doc.rect(0, (h / 3) * 2, w, h / 3 + 1, 'F')

  // Cercle décoratif (grand, en haut à droite, semi-transparent)
  doc.setFillColor(124, 58, 237) // violet
  doc.circle(w - 30, 50, 60, 'F')
  doc.setFillColor(147, 51, 234) // purple
  doc.circle(30, h - 60, 40, 'F')

  // Logo YAPLUKA
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(36)
  doc.setFont('helvetica', 'bold')
  doc.text('YAPLUKA', w / 2, h / 2 - 40, { align: 'center' })

  // Ligne décorative
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.5)
  doc.line(w / 2 - 40, h / 2 - 30, w / 2 + 40, h / 2 - 30)

  // Titre "Rapport de suivi"
  doc.setFontSize(16)
  doc.setFont('helvetica', 'normal')
  doc.text('Rapport de suivi', w / 2, h / 2 - 18, { align: 'center' })

  // Nom du groupe
  doc.setFontSize(24)
  doc.setFont('helvetica', 'bold')
  doc.text(groupName, w / 2, h / 2 + 5, { align: 'center' })

  // Formateur
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text(`Formateur : ${trainerName}`, w / 2, h / 2 + 25, { align: 'center' })

  // Date
  doc.setFontSize(11)
  doc.text(dateStr, w / 2, h / 2 + 35, { align: 'center' })

  // Petit texte en bas
  doc.setFontSize(8)
  doc.setTextColor(200, 200, 255)
  doc.text('Plateforme de suivi post-formation', w / 2, h - 20, { align: 'center' })
}

// ═══════════════════════════════════════════
// HEADER / FOOTER
// ═══════════════════════════════════════════

export function drawPageHeader(doc: jsPDF, title: string, subtitle?: string) {
  const w = doc.internal.pageSize.getWidth()

  // Barre gradient (simulée avec 2 rectangles)
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, w / 2, 10, 'F')
  doc.setFillColor(...COLORS.primaryLight)
  doc.rect(w / 2, 0, w / 2, 10, 'F')

  // YAPLUKA en blanc dans la barre
  doc.setTextColor(...COLORS.white)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('YAPLUKA', 8, 7)

  // Titre
  doc.setTextColor(...COLORS.textDark)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 15, 24)

  // Sous-titre
  if (subtitle) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.textMedium)
    doc.text(subtitle, 15, 31)
  }

  return subtitle ? 38 : 32
}

export function drawPageFooter(doc: jsPDF, pageNum: number, totalPages: number, dateStr: string) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()

  doc.setDrawColor(...COLORS.border)
  doc.line(15, h - 15, w - 15, h - 15)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textLight)
  doc.text(`YAPLUKA — ${dateStr}`, 15, h - 10)
  doc.text(`Page ${pageNum}/${totalPages}`, w - 15, h - 10, { align: 'right' })
}

// ═══════════════════════════════════════════
// CARD (simule le style .card de l'app)
// ═══════════════════════════════════════════

export function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number) {
  // Ombre subtile
  doc.setFillColor(230, 230, 240)
  doc.roundedRect(x + 0.5, y + 0.5, w, h, 4, 4, 'F')

  // Fond blanc
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(x, y, w, h, 4, 4, 'F')

  // Bordure violette subtle
  doc.setDrawColor(139, 92, 246)
  doc.setLineWidth(0.3)
  doc.roundedRect(x, y, w, h, 4, 4, 'S')
}

// ═══════════════════════════════════════════
// BLOCS MÉTÉO (3 blocs colorés comme l'app)
// ═══════════════════════════════════════════

export function drawWeatherBlock(
  doc: jsPDF, x: number, y: number, w: number, h: number,
  weather: string, label: string, count: number, total: number,
  bgColor: readonly [number, number, number],
  textColor: readonly [number, number, number],
) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0

  // Fond coloré arrondi
  doc.setFillColor(bgColor[0], bgColor[1], bgColor[2])
  doc.roundedRect(x, y, w, h, 3, 3, 'F')

  // Icône météo
  drawWeatherIcon(doc, x + w / 2, y + 8, weather, 5)

  // Count en gros
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(textColor[0], textColor[1], textColor[2])
  doc.text(String(count), x + w / 2, y + 22, { align: 'center' })

  // Pourcentage
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(`${pct}%`, x + w / 2, y + 28, { align: 'center' })
}

export function drawWeatherBlocks(
  doc: jsPDF, x: number, y: number, totalW: number,
  summary: { sunny: number; cloudy: number; stormy: number },
) {
  const total = summary.sunny + summary.cloudy + summary.stormy
  const gap = 4
  const blockW = (totalW - gap * 2) / 3
  const blockH = 33

  drawWeatherBlock(doc, x, y, blockW, blockH, 'sunny', 'Ensoleille', summary.sunny, total, COLORS.sunnyBg, COLORS.sunnyText)
  drawWeatherBlock(doc, x + blockW + gap, y, blockW, blockH, 'cloudy', 'Mitige', summary.cloudy, total, COLORS.cloudyBg, COLORS.cloudyText)
  drawWeatherBlock(doc, x + (blockW + gap) * 2, y, blockW, blockH, 'stormy', 'Difficile', summary.stormy, total, COLORS.stormyBg, COLORS.stormyText)

  return y + blockH
}

// ═══════════════════════════════════════════
// PILLS MÉTÉO TIMELINE
// ═══════════════════════════════════════════

export function drawWeatherPills(
  doc: jsPDF, x: number, y: number, maxW: number,
  history: Array<{ week: number; year: number; weather: string }>,
) {
  const pillH = 6
  const pillGap = 2
  let cx = x
  let cy = y

  const bgMap: Record<string, readonly [number, number, number]> = {
    sunny: COLORS.sunnyBg,
    cloudy: COLORS.cloudyBg,
    stormy: COLORS.stormyBg,
  }
  const textMap: Record<string, readonly [number, number, number]> = {
    sunny: COLORS.sunnyText,
    cloudy: COLORS.cloudyText,
    stormy: COLORS.stormyText,
  }

  // Reverse pour afficher les plus récentes en premier
  const reversed = [...history].reverse()

  const dotColorMap: Record<string, readonly [number, number, number]> = {
    sunny: COLORS.sunny,
    cloudy: COLORS.cloudy,
    stormy: COLORS.stormy,
  }

  reversed.forEach((wh) => {
    const label = `S${wh.week}`
    doc.setFontSize(7)
    const pillW = doc.getTextWidth(label) + 9 // extra space for dot

    // Retour à la ligne si dépassement
    if (cx + pillW > x + maxW) {
      cx = x
      cy += pillH + pillGap
    }

    const bg = bgMap[wh.weather] ?? COLORS.border
    const tc = textMap[wh.weather] ?? COLORS.textDark
    const dotColor = dotColorMap[wh.weather] ?? COLORS.textLight

    // Pill arrondie
    doc.setFillColor(bg[0], bg[1], bg[2])
    doc.roundedRect(cx, cy, pillW, pillH, 2, 2, 'F')

    // Mini dot coloré
    doc.setFillColor(dotColor[0], dotColor[1], dotColor[2])
    doc.circle(cx + 3.5, cy + pillH / 2, 1.2, 'F')

    // Texte
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(tc[0], tc[1], tc[2])
    doc.text(label, cx + pillW / 2 + 1.5, cy + pillH / 2 + 1.5, { align: 'center' })

    cx += pillW + pillGap
  })

  // Retourner le Y final (bas de la dernière ligne de pills)
  return cy + pillH + 2
}

// ═══════════════════════════════════════════
// JAUGE DYNAMIQUE (5 segments avec labels)
// ═══════════════════════════════════════════

export function drawDynamiqueGauge(doc: jsPDF, x: number, y: number, level: number, label: string) {
  const segW = 20
  const segH = 6
  const gap = 2

  for (let i = 0; i < 5; i++) {
    const sx = x + i * (segW + gap)
    if (i <= level) {
      const seg = DYNAMIQUE_SCALE[i]
      doc.setFillColor(seg.color[0], seg.color[1], seg.color[2])
    } else {
      doc.setFillColor(229, 231, 235) // gray-200
    }
    doc.roundedRect(sx, y, segW, segH, 2, 2, 'F')
  }

  // Label à droite de la jauge
  const labelX = x + 5 * (segW + gap) + 4
  const dyn = DYNAMIQUE_SCALE[level]
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(dyn.color[0], dyn.color[1], dyn.color[2])
  doc.text(label, labelX, y + segH - 1)
}

// Jauge avec marqueurs texte en dessous (comme la barre de progression de l'app)
export function drawDynamiqueGaugeWithMarkers(doc: jsPDF, x: number, y: number, totalW: number, level: number) {
  const segH = 7
  const markerLabels = ['Veille', 'Impulsion', 'Rythme', 'Intensite', 'Propulsion']
  const segW = (totalW - 4 * 2) / 5

  // Segments
  for (let i = 0; i < 5; i++) {
    const sx = x + i * (segW + 2)
    if (i <= level) {
      const seg = DYNAMIQUE_SCALE[i]
      doc.setFillColor(seg.color[0], seg.color[1], seg.color[2])
    } else {
      doc.setFillColor(229, 231, 235)
    }
    doc.roundedRect(sx, y, segW, segH, 2, 2, 'F')
  }

  // Labels sous chaque segment
  doc.setFontSize(6)
  doc.setFont('helvetica', 'normal')
  for (let i = 0; i < 5; i++) {
    const sx = x + i * (segW + 2) + segW / 2
    const seg = DYNAMIQUE_SCALE[i]
    if (i <= level) {
      doc.setTextColor(seg.color[0], seg.color[1], seg.color[2])
      doc.setFont('helvetica', 'bold')
    } else {
      doc.setTextColor(180, 180, 180)
      doc.setFont('helvetica', 'normal')
    }
    doc.text(markerLabels[i], sx, y + segH + 5, { align: 'center' })
  }

  return y + segH + 8
}

// ═══════════════════════════════════════════
// CARTE MÉTRIQUE
// ═══════════════════════════════════════════

export function drawMetricCard(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  // Fond carte
  drawCard(doc, x, y, w, h)

  // Valeur en gros, centrée
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.textDark)
  doc.text(value, x + w / 2, y + h / 2 + 1, { align: 'center' })

  // Label en dessous
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textMedium)
  doc.text(label, x + w / 2, y + h / 2 + 9, { align: 'center' })
}

// ═══════════════════════════════════════════
// MÉTÉO DOT (point coloré)
// ═══════════════════════════════════════════

export function drawWeatherDot(doc: jsPDF, x: number, y: number, weather: string, radius = 3) {
  const colorMap: Record<string, readonly [number, number, number]> = {
    sunny: COLORS.sunny,
    cloudy: COLORS.cloudy,
    stormy: COLORS.stormy,
  }
  const color = colorMap[weather] ?? COLORS.textLight
  doc.setFillColor(...color)
  doc.circle(x, y, radius, 'F')
}

// ═══════════════════════════════════════════
// TITRE DE SECTION
// ═══════════════════════════════════════════

export function drawSectionTitle(doc: jsPDF, x: number, y: number, title: string): number {
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(title, x, y)

  // Petite ligne sous le titre
  const titleWidth = doc.getTextWidth(title)
  doc.setDrawColor(...COLORS.primaryLight)
  doc.setLineWidth(0.5)
  doc.line(x, y + 1.5, x + titleWidth, y + 1.5)

  return y + 8
}

// ═══════════════════════════════════════════
// VÉRIFICATION SAUT DE PAGE
// ═══════════════════════════════════════════

export function checkPageBreak(doc: jsPDF, currentY: number, neededHeight: number): number {
  const maxY = doc.internal.pageSize.getHeight() - 22
  if (currentY + neededHeight > maxY) {
    doc.addPage()
    return 15
  }
  return currentY
}

// ═══════════════════════════════════════════
// MINI-ICÔNES DESSINÉES (remplace les emojis)
// ═══════════════════════════════════════════

// ☀️ Soleil : cercle + 8 rayons
export function drawIconSun(doc: jsPDF, cx: number, cy: number, size = 4) {
  const r = size * 0.4
  const rayLen = size * 0.35
  const rayStart = r + size * 0.1

  // Cercle central
  doc.setFillColor(...COLORS.sunny)
  doc.circle(cx, cy, r, 'F')

  // Rayons
  doc.setDrawColor(...COLORS.sunny)
  doc.setLineWidth(0.4)
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4
    const x1 = cx + Math.cos(angle) * rayStart
    const y1 = cy + Math.sin(angle) * rayStart
    const x2 = cx + Math.cos(angle) * (rayStart + rayLen)
    const y2 = cy + Math.sin(angle) * (rayStart + rayLen)
    doc.line(x1, y1, x2, y2)
  }
}

// ⛅ Nuage : deux cercles superposés
export function drawIconCloud(doc: jsPDF, cx: number, cy: number, size = 4) {
  doc.setFillColor(...COLORS.cloudy)
  doc.circle(cx - size * 0.2, cy, size * 0.35, 'F')
  doc.circle(cx + size * 0.2, cy - size * 0.1, size * 0.4, 'F')
  doc.circle(cx + size * 0.15, cy + size * 0.15, size * 0.3, 'F')
}

// ⛈️ Orage : nuage + éclair
export function drawIconStorm(doc: jsPDF, cx: number, cy: number, size = 4) {
  // Nuage gris-rouge
  doc.setFillColor(180, 80, 80)
  doc.circle(cx - size * 0.2, cy - size * 0.15, size * 0.3, 'F')
  doc.circle(cx + size * 0.15, cy - size * 0.2, size * 0.35, 'F')

  // Éclair (zigzag)
  doc.setDrawColor(...COLORS.sunny)
  doc.setLineWidth(0.6)
  doc.line(cx, cy + size * 0.05, cx - size * 0.15, cy + size * 0.3)
  doc.line(cx - size * 0.15, cy + size * 0.3, cx + size * 0.05, cy + size * 0.3)
  doc.line(cx + size * 0.05, cy + size * 0.3, cx - size * 0.1, cy + size * 0.55)
}

// Icône météo générique
export function drawWeatherIcon(doc: jsPDF, cx: number, cy: number, weather: string, size = 4) {
  if (weather === 'sunny') drawIconSun(doc, cx, cy, size)
  else if (weather === 'cloudy') drawIconCloud(doc, cx, cy, size)
  else drawIconStorm(doc, cx, cy, size)
}

// 👥 Icône groupe : deux silhouettes simplifiées
export function drawIconGroup(doc: jsPDF, cx: number, cy: number, size = 4) {
  doc.setFillColor(...COLORS.primaryLight)
  // Personne gauche
  doc.circle(cx - size * 0.25, cy - size * 0.25, size * 0.18, 'F')
  doc.roundedRect(cx - size * 0.45, cy, size * 0.4, size * 0.35, 1, 1, 'F')
  // Personne droite
  doc.circle(cx + size * 0.25, cy - size * 0.25, size * 0.18, 'F')
  doc.roundedRect(cx + size * 0.05, cy, size * 0.4, size * 0.35, 1, 1, 'F')
}

// ⚡ Icône action : éclair
export function drawIconAction(doc: jsPDF, cx: number, cy: number, size = 4) {
  doc.setFillColor(245, 158, 11) // amber-500
  // Triangle haut
  const pts = [
    cx - size * 0.15, cy + size * 0.1,
    cx + size * 0.25, cy - size * 0.45,
    cx + size * 0.05, cy + size * 0.05,
  ]
  doc.triangle(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5], 'F')
  // Triangle bas
  const pts2 = [
    cx + size * 0.15, cy - size * 0.1,
    cx - size * 0.25, cy + size * 0.45,
    cx - size * 0.05, cy - size * 0.05,
  ]
  doc.triangle(pts2[0], pts2[1], pts2[2], pts2[3], pts2[4], pts2[5], 'F')
}

// 🏆 Icône classement : coupe
export function drawIconTrophy(doc: jsPDF, cx: number, cy: number, size = 4) {
  doc.setFillColor(245, 158, 11) // amber-500
  // Coupe (trapèze arrondi)
  doc.roundedRect(cx - size * 0.3, cy - size * 0.35, size * 0.6, size * 0.45, 1.5, 1.5, 'F')
  // Pied
  doc.setFillColor(180, 130, 20)
  doc.rect(cx - size * 0.1, cy + size * 0.1, size * 0.2, size * 0.15, 'F')
  // Base
  doc.roundedRect(cx - size * 0.2, cy + size * 0.25, size * 0.4, size * 0.08, 1, 1, 'F')
}

// ✅ Icône check (coche dans un cercle)
export function drawIconCheck(doc: jsPDF, cx: number, cy: number, size = 4) {
  doc.setFillColor(...COLORS.green)
  doc.circle(cx, cy, size * 0.4, 'F')
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.6)
  doc.line(cx - size * 0.18, cy, cx - size * 0.05, cy + size * 0.15)
  doc.line(cx - size * 0.05, cy + size * 0.15, cx + size * 0.2, cy - size * 0.15)
}

// ⚠️ Icône warning (triangle)
export function drawIconWarning(doc: jsPDF, cx: number, cy: number, size = 4) {
  doc.setFillColor(...COLORS.stormy)
  doc.triangle(
    cx, cy - size * 0.35,
    cx - size * 0.35, cy + size * 0.25,
    cx + size * 0.35, cy + size * 0.25,
    'F',
  )
  doc.setFillColor(255, 255, 255)
  doc.rect(cx - 0.3, cy - size * 0.1, 0.6, size * 0.25, 'F')
  doc.circle(cx, cy + size * 0.15, 0.4, 'F')
}

// 🌤 Petit nuage + gros soleil
export function drawIconPartlySunny(doc: jsPDF, cx: number, cy: number, size = 4) {
  // Gros soleil derrière
  drawIconSun(doc, cx - size * 0.1, cy - size * 0.1, size * 0.8)
  // Petit nuage devant en bas à droite
  doc.setFillColor(180, 210, 240)
  doc.circle(cx + size * 0.05, cy + size * 0.2, size * 0.18, 'F')
  doc.circle(cx + size * 0.22, cy + size * 0.15, size * 0.2, 'F')
  doc.circle(cx + size * 0.15, cy + size * 0.25, size * 0.15, 'F')
}

// ⛅ Gros nuage + petit soleil
export function drawIconMostlyCloudy(doc: jsPDF, cx: number, cy: number, size = 4) {
  // Petit soleil qui dépasse en haut à droite
  const sunR = size * 0.2
  doc.setFillColor(...COLORS.sunny)
  doc.circle(cx + size * 0.3, cy - size * 0.2, sunR, 'F')
  // Mini rayons
  doc.setDrawColor(...COLORS.sunny)
  doc.setLineWidth(0.3)
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI * 0.1 + i * Math.PI * 0.3
    const x1 = cx + size * 0.3 + Math.cos(angle) * (sunR + size * 0.05)
    const y1 = cy - size * 0.2 + Math.sin(angle) * (sunR + size * 0.05)
    const x2 = cx + size * 0.3 + Math.cos(angle) * (sunR + size * 0.15)
    const y2 = cy - size * 0.2 + Math.sin(angle) * (sunR + size * 0.15)
    doc.line(x1, y1, x2, y2)
  }
  // Gros nuage devant
  doc.setFillColor(...COLORS.cloudy)
  doc.circle(cx - size * 0.15, cy + size * 0.05, size * 0.28, 'F')
  doc.circle(cx + size * 0.1, cy - size * 0.05, size * 0.32, 'F')
  doc.circle(cx + size * 0.05, cy + size * 0.18, size * 0.22, 'F')
}

// ═══════════════════════════════════════════
// SCORE MÉTÉO + AXE MÉTÉO
// ═══════════════════════════════════════════

// Calcul du score météo moyen (1 = tout va bien → 5 = difficile)
export function getWeatherScore(summary: { sunny: number; cloudy: number; stormy: number }): number {
  const total = summary.sunny + summary.cloudy + summary.stormy
  if (total === 0) return 3 // neutre par défaut
  return (summary.sunny * 1 + summary.cloudy * 3 + summary.stormy * 5) / total
}

// Axe météo à 5 niveaux avec curseur
export function drawWeatherAxis(
  doc: jsPDF, x: number, y: number, totalW: number,
  weatherScore: number,
) {
  const barH = 7
  const segCount = 5
  const segW = totalW / segCount
  const barY = y + 11

  // Couleurs des segments (gauche = bien → droite = difficile)
  const segColors: Array<readonly [number, number, number]> = [
    [187, 247, 208],  // green-200
    [254, 243, 199],  // amber-100
    [186, 230, 253],  // sky-200
    [253, 186, 116],  // orange-200
    [254, 202, 202],  // red-200
  ]

  // Icônes au-dessus de chaque segment
  const iconY = y + 5
  for (let i = 0; i < 5; i++) {
    const iconX = x + i * segW + segW / 2
    if (i === 0) drawIconSun(doc, iconX, iconY, 4)
    else if (i === 1) drawIconPartlySunny(doc, iconX, iconY, 4)
    else if (i === 2) drawIconMostlyCloudy(doc, iconX, iconY, 4)
    else if (i === 3) drawIconCloud(doc, iconX, iconY, 4)
    else drawIconStorm(doc, iconX, iconY, 4)
  }

  // Segments de la barre
  for (let i = 0; i < segCount; i++) {
    doc.setFillColor(segColors[i][0], segColors[i][1], segColors[i][2])
    doc.rect(x + i * segW, barY, segW, barH, 'F')
  }

  // Curseur (triangle pointant vers le haut)
  const score = Math.max(1, Math.min(5, weatherScore))
  const cursorX = x + ((score - 1) / 4) * totalW
  const cursorY = barY + barH + 1

  doc.setFillColor(COLORS.textDark[0], COLORS.textDark[1], COLORS.textDark[2])
  doc.triangle(
    cursorX - 2.5, cursorY + 4,
    cursorX + 2.5, cursorY + 4,
    cursorX, cursorY,
    'F',
  )

  // Labels : positions 0, 2, 4
  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')

  doc.setTextColor(COLORS.green[0], COLORS.green[1], COLORS.green[2])
  doc.text('Ca roule', x + segW / 2, barY + barH + 9, { align: 'center' })

  doc.setTextColor(COLORS.cloudy[0], COLORS.cloudy[1], COLORS.cloudy[2])
  doc.text('Mitige', x + 2 * segW + segW / 2, barY + barH + 9, { align: 'center' })

  doc.setTextColor(COLORS.stormy[0], COLORS.stormy[1], COLORS.stormy[2])
  doc.text('Difficile', x + 4 * segW + segW / 2, barY + barH + 9, { align: 'center' })

  return barY + barH + 13
}
