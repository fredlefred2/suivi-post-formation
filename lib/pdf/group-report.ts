import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  COLORS,
  drawPageHeader,
  drawPageFooter,
  drawWeatherDot,
  drawDynamiqueGauge,
  drawMetricCard,
  drawSectionTitle,
  checkPageBreak,
  getDynamiqueForCount,
} from './pdf-utils'

// ── Types pour les données du rapport ──

export type WeekWeather = {
  week: number
  year: number
  weather: 'sunny' | 'cloudy' | 'stormy'
}

export type LearnerReportData = {
  id: string
  firstName: string
  lastName: string
  createdAt: string
  axes: string[]
  totalActions: number
  weeksSinceJoin: number
  avgActionsPerWeek: number
  weatherHistory: WeekWeather[]
  weatherSummary: { sunny: number; cloudy: number; stormy: number }
  whatWorked: string[]
  difficulties: string[]
}

export type GroupReportData = {
  groupName: string
  generatedAt: string
  participantCount: number
  totalActions: number
  avgActionsPerWeek: number
  weatherHistory: Array<{
    week: number
    year: number
    sunny: number
    cloudy: number
    stormy: number
  }>
  weatherSummary: { sunny: number; cloudy: number; stormy: number }
  learners: LearnerReportData[]
}

// ── Labels météo pour le PDF (pas d'emoji) ──
const WEATHER_LABELS: Record<string, string> = {
  sunny: 'Ensoleillé',
  cloudy: 'Mitigé',
  stormy: 'Difficile',
}

// ── Barre de progression météo ──
function drawWeatherBar(
  doc: jsPDF, x: number, y: number, barW: number, barH: number,
  label: string, pct: number, color: readonly [number, number, number],
) {
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textMedium)
  doc.text(label, x, y + barH / 2 + 1)

  const barX = x + 45
  // Fond gris
  doc.setFillColor(...COLORS.border)
  doc.roundedRect(barX, y, barW, barH, 2, 2, 'F')
  // Barre colorée
  if (pct > 0) {
    doc.setFillColor(color[0], color[1], color[2])
    doc.roundedRect(barX, y, (barW * pct) / 100, barH, 2, 2, 'F')
  }
  // Pourcentage
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.textDark)
  doc.text(`${pct}%`, barX + barW + 3, y + barH / 2 + 1)
}

// ── Génération du rapport PDF ──

export function generateGroupReport(data: GroupReportData): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 15
  const contentW = pageW - margin * 2
  const dateStr = new Date(data.generatedAt).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  // ═══════════════════════════════════════════
  // PAGE 1 : SYNTHÈSE DU GROUPE
  // ═══════════════════════════════════════════

  let y = drawPageHeader(doc, data.groupName, `Rapport généré le ${dateStr}`)
  y += 4

  // ── Cartes métriques ──
  const cardW = (contentW - 8) / 3
  const cardH = 30
  drawMetricCard(doc, margin, y, cardW, cardH, 'Participants', String(data.participantCount))
  drawMetricCard(doc, margin + cardW + 4, y, cardW, cardH, 'Actions totales', String(data.totalActions))
  drawMetricCard(doc, margin + (cardW + 4) * 2, y, cardW, cardH, 'Actions / sem.', data.avgActionsPerWeek.toFixed(1))
  y += cardH + 8

  // ── Indice de dynamique du groupe ──
  y = drawSectionTitle(doc, margin, y, 'Dynamique du groupe')
  const groupDyn = getDynamiqueForCount(data.avgActionsPerWeek)
  drawDynamiqueGauge(doc, margin, y, groupDyn.level, groupDyn.label)
  y += 14

  // ── Météo moyenne du groupe ──
  y = drawSectionTitle(doc, margin, y, 'Météo moyenne')
  const totalWeathers = data.weatherSummary.sunny + data.weatherSummary.cloudy + data.weatherSummary.stormy
  if (totalWeathers > 0) {
    const sunnyPct = Math.round((data.weatherSummary.sunny / totalWeathers) * 100)
    const cloudyPct = Math.round((data.weatherSummary.cloudy / totalWeathers) * 100)
    const stormyPct = Math.round((data.weatherSummary.stormy / totalWeathers) * 100)

    // Barres de progression météo
    const barH = 8
    const barW = contentW - 60
    // Ensoleillé
    drawWeatherBar(doc, margin, y, barW, barH, 'Ensoleillé', sunnyPct, COLORS.sunny)
    y += barH + 4
    // Mitigé
    drawWeatherBar(doc, margin, y, barW, barH, 'Mitigé', cloudyPct, COLORS.cloudy)
    y += barH + 4
    // Difficile
    drawWeatherBar(doc, margin, y, barW, barH, 'Difficile', stormyPct, COLORS.stormy)
    y += barH + 4
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLORS.textLight)
    doc.text('Aucun check-in enregistré', margin, y + 4)
    y += 10
  }
  y += 4

  // ── Historique météo par semaine (tableau) ──
  if (data.weatherHistory.length > 0) {
    y = drawSectionTitle(doc, margin, y, 'Historique météo par semaine')

    const tableBody = data.weatherHistory.map((wh) => [
      `S${wh.week} — ${wh.year}`,
      String(wh.sunny),
      String(wh.cloudy),
      String(wh.stormy),
    ])

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Semaine', 'Ensoleillé', 'Mitigé', 'Difficile']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [67, 56, 202],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [31, 41, 55],
        halign: 'center',
      },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      styles: {
        cellPadding: 2,
        lineColor: [229, 231, 235],
        lineWidth: 0.3,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable?.finalY ?? y + 20
    y += 6
  }

  // ═══════════════════════════════════════════
  // PAGES APPRENANTS (1 page par apprenant)
  // ═══════════════════════════════════════════

  data.learners.forEach((learner) => {
    doc.addPage()
    let ly = drawPageHeader(
      doc,
      `${learner.firstName} ${learner.lastName}`,
      `Inscrit(e) depuis le ${new Date(learner.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    )
    ly += 4

    // ── Axes de travail ──
    ly = drawSectionTitle(doc, margin, ly, 'Axes de travail')
    if (learner.axes.length > 0) {
      learner.axes.forEach((axe, i) => {
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.textDark)
        const axeText = `${i + 1}. ${axe}`
        const lines = doc.splitTextToSize(axeText, contentW)
        doc.text(lines, margin + 2, ly)
        ly += lines.length * 4.5
      })
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...COLORS.textLight)
      doc.text('Aucun axe défini', margin, ly)
      ly += 5
    }
    ly += 4

    // ── Cartes métriques individuelles ──
    const indivCardW = (contentW - 4) / 2
    const indivCardH = 28
    drawMetricCard(doc, margin, ly, indivCardW, indivCardH, 'Actions totales', String(learner.totalActions))
    drawMetricCard(doc, margin + indivCardW + 4, ly, indivCardW, indivCardH, 'Actions / sem.', learner.avgActionsPerWeek.toFixed(1))
    ly += indivCardH + 6

    // ── Dynamique individuelle ──
    ly = drawSectionTitle(doc, margin, ly, 'Dynamique')
    const learnerDyn = getDynamiqueForCount(learner.avgActionsPerWeek)
    drawDynamiqueGauge(doc, margin, ly, learnerDyn.level, learnerDyn.label)
    ly += 14

    // ── Météo moyenne individuelle ──
    ly = drawSectionTitle(doc, margin, ly, 'Météo moyenne')
    const learnerTotal = learner.weatherSummary.sunny + learner.weatherSummary.cloudy + learner.weatherSummary.stormy
    if (learnerTotal > 0) {
      const items = [
        { label: 'Ensoleillé', count: learner.weatherSummary.sunny, weather: 'sunny' as const },
        { label: 'Mitigé', count: learner.weatherSummary.cloudy, weather: 'cloudy' as const },
        { label: 'Difficile', count: learner.weatherSummary.stormy, weather: 'stormy' as const },
      ]
      items.forEach(({ label, count, weather }) => {
        const pct = Math.round((count / learnerTotal) * 100)
        drawWeatherDot(doc, margin + 3, ly, weather, 2.5)
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.textDark)
        doc.text(`${label} : ${pct}%  (${count})`, margin + 9, ly + 1)
        ly += 6
      })
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...COLORS.textLight)
      doc.text('Aucun check-in', margin, ly)
      ly += 5
    }
    ly += 4

    // ── Historique météo (dots inline) ──
    if (learner.weatherHistory.length > 0) {
      ly = checkPageBreak(doc, ly, 20)
      ly = drawSectionTitle(doc, margin, ly, 'Historique météo')

      const dotR = 3
      const dotSpacing = 10
      const maxPerRow = Math.floor(contentW / dotSpacing)

      learner.weatherHistory.forEach((wh, i) => {
        const row = Math.floor(i / maxPerRow)
        const col = i % maxPerRow
        const dx = margin + col * dotSpacing + dotR
        const dy = ly + row * (dotR * 2 + 4) + dotR

        drawWeatherDot(doc, dx, dy, wh.weather, dotR)
      })

      const totalRows = Math.ceil(learner.weatherHistory.length / maxPerRow)
      ly += totalRows * (dotR * 2 + 4) + 2

      // Légende
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.textLight)
      const firstW = learner.weatherHistory[0]
      const lastW = learner.weatherHistory[learner.weatherHistory.length - 1]
      doc.text(`S${firstW.week}/${firstW.year} → S${lastW.week}/${lastW.year}`, margin, ly)
      ly += 6
    }

    // ── Ce qui a marché (check-ins positifs) ──
    if (learner.whatWorked.length > 0) {
      ly = checkPageBreak(doc, ly, 15)
      ly = drawSectionTitle(doc, margin, ly, 'Ce qui a marché')

      learner.whatWorked.forEach((text) => {
        ly = checkPageBreak(doc, ly, 10)
        doc.setFillColor(...COLORS.bgCard)
        const lines = doc.splitTextToSize(text, contentW - 10)
        const blockH = lines.length * 4 + 4
        doc.roundedRect(margin, ly, contentW, blockH, 2, 2, 'F')

        // Petit indicateur vert
        doc.setFillColor(34, 197, 94) // green-500
        doc.roundedRect(margin, ly, 2, blockH, 1, 1, 'F')

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.textDark)
        doc.text(lines, margin + 6, ly + 4.5)
        ly += blockH + 3
      })
      ly += 2
    }

    // ── Difficultés rencontrées ──
    if (learner.difficulties.length > 0) {
      ly = checkPageBreak(doc, ly, 15)
      ly = drawSectionTitle(doc, margin, ly, 'Difficultés rencontrées')

      learner.difficulties.forEach((text) => {
        ly = checkPageBreak(doc, ly, 10)
        const lines = doc.splitTextToSize(text, contentW - 10)
        const blockH = lines.length * 4 + 4
        doc.setFillColor(254, 242, 242) // red-50
        doc.roundedRect(margin, ly, contentW, blockH, 2, 2, 'F')

        // Petit indicateur rouge
        doc.setFillColor(239, 68, 68) // red-500
        doc.roundedRect(margin, ly, 2, blockH, 1, 1, 'F')

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.textDark)
        doc.text(lines, margin + 6, ly + 4.5)
        ly += blockH + 3
      })
    }
  })

  // ── Ajout des footers sur toutes les pages ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    drawPageFooter(doc, i, totalPages, dateStr)
  }

  return doc
}
