import jsPDF from 'jspdf'

// ── Couleurs de la marque (RGB) ──
export const COLORS = {
  primary: [67, 56, 202] as const,      // indigo-700
  primaryLight: [99, 102, 241] as const, // indigo-500
  textDark: [31, 41, 55] as const,       // gray-800
  textMedium: [107, 114, 128] as const,  // gray-500
  textLight: [156, 163, 175] as const,   // gray-400
  sunny: [251, 191, 36] as const,        // amber-400
  cloudy: [56, 189, 248] as const,       // sky-400
  stormy: [239, 68, 68] as const,        // red-500
  white: [255, 255, 255] as const,
  bgLight: [249, 250, 251] as const,     // gray-50
  bgCard: [238, 242, 255] as const,      // indigo-50
  border: [229, 231, 235] as const,      // gray-200
}

// ── Échelle de dynamique ──
const DYNAMIQUE_SCALE = [
  { label: 'Ancrage', color: [156, 163, 175] as const },    // gray
  { label: 'Impulsion', color: [20, 184, 166] as const },   // teal
  { label: 'Rythme', color: [59, 130, 246] as const },      // blue
  { label: 'Intensité', color: [249, 115, 22] as const },  // orange
  { label: 'Propulsion', color: [168, 85, 247] as const },  // purple
]

export function getDynamiqueForCount(avgPerWeek: number) {
  if (avgPerWeek === 0) return { level: 0, ...DYNAMIQUE_SCALE[0] }
  if (avgPerWeek <= 2) return { level: 1, ...DYNAMIQUE_SCALE[1] }
  if (avgPerWeek <= 5) return { level: 2, ...DYNAMIQUE_SCALE[2] }
  if (avgPerWeek <= 8) return { level: 3, ...DYNAMIQUE_SCALE[3] }
  return { level: 4, ...DYNAMIQUE_SCALE[4] }
}

// ── Header de page avec barre de marque ──
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

// ── Footer de page ──
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

// ── Point météo coloré ──
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

// ── Jauge de dynamique (5 segments) ──
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
    // Arrondi aux extrémités
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

// ── Carte métrique (rectangle arrondi avec label + valeur) ──
export function drawMetricCard(doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string) {
  doc.setFillColor(...COLORS.bgCard)
  doc.roundedRect(x, y, w, h, 3, 3, 'F')

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textMedium)
  doc.text(label, x + w / 2, y + 10, { align: 'center' })

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.textDark)
  doc.text(value, x + w / 2, y + 22, { align: 'center' })
}

// ── Titre de section ──
export function drawSectionTitle(doc: jsPDF, x: number, y: number, title: string): number {
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primary)
  doc.text(title, x, y)

  // Petite ligne sous le titre
  const titleWidth = doc.getTextWidth(title)
  doc.setDrawColor(...COLORS.primaryLight)
  doc.setLineWidth(0.5)
  doc.line(x, y + 1.5, x + titleWidth, y + 1.5)

  return y + 7
}

// ── Vérification de dépassement de page ──
export function checkPageBreak(doc: jsPDF, currentY: number, neededHeight: number): number {
  const maxY = doc.internal.pageSize.getHeight() - 22 // marge basse
  if (currentY + neededHeight > maxY) {
    doc.addPage()
    return 15 // marge haute de la nouvelle page
  }
  return currentY
}
