import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  COLORS,
  DYNAMIQUE_SCALE,
  drawCoverPage,
  drawPageHeader,
  drawPageFooter,
  drawCard,
  drawWeatherPills,
  drawWeatherAxis,
  getWeatherScore,
  drawDynamiqueGaugeWithMarkers,
  drawMetricCard,
  drawSectionTitle,
  checkPageBreak,
  getDynamiqueForActions,
  drawIconGroup,
  drawIconSun,
  drawIconAction,
  drawIconTrophy,
  drawIconCheck,
  drawIconWarning,
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
  axeActionCounts: number[]
  axeActions: string[][]      // descriptions des actions par axe
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
  trainerName: string
  generatedAt: string
  participantCount: number
  totalAxes: number
  totalActions: number
  avgActionsPerWeek: number
  avgActionsPerAxe: number
  weatherHistory: Array<{ week: number; year: number; weather: string }>
  weatherSummary: { sunny: number; cloudy: number; stormy: number }
  learners: LearnerReportData[]
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
  // PAGE 1 : COUVERTURE
  // ═══════════════════════════════════════════

  drawCoverPage(doc, data.groupName, data.trainerName, dateStr)

  // ═══════════════════════════════════════════
  // PAGE 2+ : SYNTHÈSE DU GROUPE
  // ═══════════════════════════════════════════

  doc.addPage()
  let y = drawPageHeader(doc, data.groupName, 'Synthese du groupe')
  y += 4

  // ── Section : L'Équipe ──
  drawIconGroup(doc, margin + 3, y - 1, 5)
  y = drawSectionTitle(doc, margin + 10, y, "L'Equipe")

  // Card avec nombre + liste des membres
  const memberNames = data.learners.map((l) => `${l.firstName} ${l.lastName}`)
  const nameRows = Math.ceil(memberNames.length / 2)
  const teamCardH = 18 + nameRows * 5 + 4
  drawCard(doc, margin, y, contentW, teamCardH)

  // Nombre de membres en gros
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.primaryLight)
  doc.text(String(data.participantCount), margin + 10, y + 13)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textMedium)
  doc.text(`participant${data.participantCount > 1 ? 's' : ''}`, margin + 22, y + 13)

  // Liste prénoms/noms en 2 colonnes
  const col1X = margin + 6
  const col2X = margin + contentW / 2 + 2
  let nameY = y + 20
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...COLORS.textDark)

  memberNames.forEach((name, i) => {
    const nx = i % 2 === 0 ? col1X : col2X
    const ny = nameY + Math.floor(i / 2) * 5
    doc.text(`• ${name}`, nx, ny)
  })

  y += teamCardH + 6

  // ── Section : Météo ──
  y = checkPageBreak(doc, y, 60)
  drawIconSun(doc, margin + 3, y - 1, 5)
  y = drawSectionTitle(doc, margin + 10, y, 'Meteo')

  // Axe météo à 5 niveaux avec curseur
  const totalWeathers = data.weatherSummary.sunny + data.weatherSummary.cloudy + data.weatherSummary.stormy
  if (totalWeathers > 0) {
    const groupWeatherScore = getWeatherScore(data.weatherSummary)
    y = drawWeatherAxis(doc, margin, y, contentW, groupWeatherScore)
    y += 4

    // Timeline pills météo
    if (data.weatherHistory.length > 0) {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...COLORS.textMedium)
      doc.text('Historique :', margin, y)
      y += 4
      y = drawWeatherPills(doc, margin, y, contentW, data.weatherHistory)
      y += 4
    }
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...COLORS.textLight)
    doc.text('Aucun check-in enregistre', margin, y + 4)
    y += 12
  }

  // ── Section : L'Action ──
  y = checkPageBreak(doc, y, 70)
  drawIconAction(doc, margin + 3, y - 1, 5)
  y = drawSectionTitle(doc, margin + 10, y, "L'Action")

  // 4 cartes métriques 2×2
  const mCardW = (contentW - 6) / 2
  const mCardH = 30

  drawMetricCard(doc, margin, y, mCardW, mCardH, 'Axes de progres', String(data.totalAxes))
  drawMetricCard(doc, margin + mCardW + 6, y, mCardW, mCardH, 'Actions totales', String(data.totalActions))
  y += mCardH + 4
  drawMetricCard(doc, margin, y, mCardW, mCardH, 'Moy. actions / sem.', data.avgActionsPerWeek.toFixed(1))
  drawMetricCard(doc, margin + mCardW + 6, y, mCardW, mCardH, 'Moy. actions / axe', data.avgActionsPerAxe.toFixed(1))
  y += mCardH + 6

  // Dynamique du groupe (jauge avec marqueurs)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...COLORS.textMedium)
  doc.text('Indice de dynamique du groupe', margin, y)
  y += 5
  const groupDyn = getDynamiqueForActions(data.avgActionsPerAxe)
  y = drawDynamiqueGaugeWithMarkers(doc, margin, y, contentW, groupDyn.level)
  y += 6

  // ── Section : Tous en action ──
  y = checkPageBreak(doc, y, 40)
  drawIconTrophy(doc, margin + 3, y - 1, 5)
  y = drawSectionTitle(doc, margin + 10, y, 'Tous en action')

  // Préparer les données de classement (trié comme dans le dashboard)
  const sorted = data.learners.map((l) => {
    const dyns = [0, 1, 2].map((i) => getDynamiqueForActions(l.axeActionCounts[i] ?? 0))
    const totalLevel = dyns.reduce((acc, d) => acc + d.level, 0)
    return { ...l, dyns, totalLevel }
  }).sort((a, b) => b.totalLevel - a.totalLevel || b.totalActions - a.totalActions)

  // Construire les lignes du tableau
  const rankBody = sorted.map((l, idx) => [
    String(idx + 1),
    `${l.firstName} ${l.lastName}`,
    String(l.totalActions),
    l.dyns[0].label,
    l.dyns[1]?.label ?? '-',
    l.dyns[2]?.label ?? '-',
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['#', 'Participant', 'Actions', 'Axe 1', 'Axe 2', 'Axe 3']],
    body: rankBody,
    theme: 'plain',
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [156, 163, 175],
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [31, 41, 55],
      cellPadding: { top: 2.5, bottom: 2.5, left: 2, right: 2 },
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10, fontStyle: 'normal', textColor: [156, 163, 175] },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 22 },
    },
    alternateRowStyles: { fillColor: [249, 250, 251] },
    styles: {
      lineColor: [229, 231, 235],
      lineWidth: 0.2,
    },
    didParseCell(hookData) {
      // Colorer les cellules d'axes selon le niveau de dynamique
      if (hookData.section === 'body' && hookData.column.index >= 3) {
        const cellText = String(hookData.cell.raw)
        const dynEntry = DYNAMIQUE_SCALE.find((d) => d.label === cellText)
        if (dynEntry) {
          hookData.cell.styles.textColor = [dynEntry.color[0], dynEntry.color[1], dynEntry.color[2]]
          hookData.cell.styles.fontStyle = 'bold'
        }
      }
    },
  })

  // ═══════════════════════════════════════════
  // PAGES APPRENANTS (1 page par apprenant)
  // ═══════════════════════════════════════════

  data.learners.forEach((learner) => {
    doc.addPage()
    const joinDate = new Date(learner.createdAt).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    let ly = drawPageHeader(
      doc,
      `${learner.firstName} ${learner.lastName}`,
      `Inscrit(e) depuis le ${joinDate}`,
    )
    ly += 4

    // ── Section 1 : Météo ──
    ly = checkPageBreak(doc, ly, 40)
    drawIconSun(doc, margin + 3, ly - 1, 5)
    ly = drawSectionTitle(doc, margin + 10, ly, 'Meteo')

    const learnerTotal = learner.weatherSummary.sunny + learner.weatherSummary.cloudy + learner.weatherSummary.stormy
    if (learnerTotal > 0) {
      const learnerWeatherScore = getWeatherScore(learner.weatherSummary)
      ly = drawWeatherAxis(doc, margin, ly, contentW, learnerWeatherScore)
      ly += 4

      if (learner.weatherHistory.length > 0) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.textMedium)
        doc.text('Historique :', margin, ly)
        ly += 4
        ly = drawWeatherPills(doc, margin, ly, contentW, learner.weatherHistory)
        ly += 4
      }
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...COLORS.textLight)
      doc.text('Aucun check-in', margin, ly)
      ly += 8
    }

    // ── Section 2 : L'Action ──
    ly = checkPageBreak(doc, ly, 50)
    drawIconAction(doc, margin + 3, ly - 1, 5)
    ly = drawSectionTitle(doc, margin + 10, ly, "L'Action")

    // Cartes métriques
    const indivCardW = (contentW - 4) / 2
    const indivCardH = 30
    drawMetricCard(doc, margin, ly, indivCardW, indivCardH, 'Actions totales', String(learner.totalActions))
    drawMetricCard(doc, margin + indivCardW + 4, ly, indivCardW, indivCardH, 'Actions / sem.', learner.avgActionsPerWeek.toFixed(1))
    ly += indivCardH + 5

    // Dynamique
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.textMedium)
    doc.text('Dynamique', margin, ly)
    ly += 5
    const avgAxeActions = learner.axes.length > 0 ? learner.totalActions / learner.axes.length : 0
    const learnerDyn = getDynamiqueForActions(avgAxeActions)
    ly = drawDynamiqueGaugeWithMarkers(doc, margin, ly, contentW, learnerDyn.level)
    ly += 6

    // Axes de progrès + détail des actions menées
    if (learner.axes.length > 0) {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...COLORS.textMedium)
      doc.text('Axes de progres', margin, ly)
      ly += 6

      learner.axes.forEach((axe, i) => {
        ly = checkPageBreak(doc, ly, 15)
        const dyn = getDynamiqueForActions(learner.axeActionCounts[i] ?? 0)
        const actionCount = learner.axeActionCounts[i] ?? 0

        // Nom de l'axe
        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...COLORS.textDark)
        doc.text(`${i + 1}. ${axe}`, margin + 2, ly)

        // Niveau à droite
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(dyn.color[0], dyn.color[1], dyn.color[2])
        doc.text(`${actionCount} action${actionCount > 1 ? 's' : ''} - ${dyn.label}`, pageW - margin, ly, { align: 'right' })

        ly += 5

        // Détail des actions
        const actions = learner.axeActions[i] ?? []
        if (actions.length > 0) {
          doc.setFontSize(7.5)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(...COLORS.textMedium)
          actions.forEach((desc) => {
            ly = checkPageBreak(doc, ly, 6)
            const lines = doc.splitTextToSize(`• ${desc}`, contentW - 12)
            doc.text(lines, margin + 6, ly)
            ly += lines.length * 3.5 + 1
          })
        }
        ly += 3
      })
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...COLORS.textLight)
      doc.text('Aucun axe defini', margin, ly)
      ly += 5
    }
    ly += 3

    // ── Ce qui a marché ──
    if (learner.whatWorked.length > 0) {
      ly = checkPageBreak(doc, ly, 15)
      drawIconCheck(doc, margin + 3, ly - 1, 5)
      ly = drawSectionTitle(doc, margin + 10, ly, 'Ce qui a marche')

      learner.whatWorked.forEach((text) => {
        ly = checkPageBreak(doc, ly, 10)
        const lines = doc.splitTextToSize(text, contentW - 10)
        const blockH = lines.length * 4 + 4

        doc.setFillColor(...COLORS.greenBg)
        doc.roundedRect(margin, ly, contentW, blockH, 2, 2, 'F')

        doc.setFillColor(...COLORS.green)
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
      drawIconWarning(doc, margin + 3, ly - 1, 5)
      ly = drawSectionTitle(doc, margin + 10, ly, 'Difficultes rencontrees')

      learner.difficulties.forEach((text) => {
        ly = checkPageBreak(doc, ly, 10)
        const lines = doc.splitTextToSize(text, contentW - 10)
        const blockH = lines.length * 4 + 4

        doc.setFillColor(...COLORS.redBg)
        doc.roundedRect(margin, ly, contentW, blockH, 2, 2, 'F')

        doc.setFillColor(...COLORS.stormy)
        doc.roundedRect(margin, ly, 2, blockH, 1, 1, 'F')

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...COLORS.textDark)
        doc.text(lines, margin + 6, ly + 4.5)
        ly += blockH + 3
      })
    }
  })

  // ── Ajout des footers sur toutes les pages (sauf page 1 = couverture) ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 2; i <= totalPages; i++) {
    doc.setPage(i)
    drawPageFooter(doc, i - 1, totalPages - 1, dateStr)
  }

  return doc
}
