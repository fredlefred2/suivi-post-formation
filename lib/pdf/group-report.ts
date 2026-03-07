import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  COLORS,
  DYNAMIQUE_SCALE,
  drawCoverPage,
  drawPageHeader,
  drawPageFooter,
  drawCard,
  drawWeatherBlocks,
  drawWeatherPills,
  drawDynamiqueGaugeWithMarkers,
  drawMetricCard,
  drawSectionTitle,
  checkPageBreak,
  getDynamiqueForCount,
  getDynamiqueForActions,
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
  axeActionCounts: number[]   // nombre d'actions par axe (pour dynamique par axe)
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
  y = drawSectionTitle(doc, margin, y, "L'Equipe")

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
  y = drawSectionTitle(doc, margin, y, 'Meteo')

  // 3 blocs colorés (comme l'app)
  const totalWeathers = data.weatherSummary.sunny + data.weatherSummary.cloudy + data.weatherSummary.stormy
  if (totalWeathers > 0) {
    y = drawWeatherBlocks(doc, margin, y, contentW, data.weatherSummary)
    y += 6

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
  y = drawSectionTitle(doc, margin, y, "L'Action")

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
  const groupDyn = getDynamiqueForCount(data.avgActionsPerWeek)
  y = drawDynamiqueGaugeWithMarkers(doc, margin, y, contentW, groupDyn.level)
  y += 6

  // ── Section : Classement ──
  y = checkPageBreak(doc, y, 40)
  y = drawSectionTitle(doc, margin, y, 'Classement')

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

    // ── Axes de travail ──
    ly = drawSectionTitle(doc, margin, ly, 'Axes de travail')
    if (learner.axes.length > 0) {
      learner.axes.forEach((axe, i) => {
        const dyn = getDynamiqueForActions(learner.axeActionCounts[i] ?? 0)
        const actionCount = learner.axeActionCounts[i] ?? 0

        doc.setFontSize(9)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...COLORS.textDark)
        doc.text(`${i + 1}. ${axe}`, margin + 2, ly)

        // Niveau à droite
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(dyn.color[0], dyn.color[1], dyn.color[2])
        doc.text(`${actionCount} actions - ${dyn.label}`, pageW - margin, ly, { align: 'right' })

        ly += 6
      })
    } else {
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...COLORS.textLight)
      doc.text('Aucun axe defini', margin, ly)
      ly += 5
    }
    ly += 3

    // ── Cartes métriques individuelles ──
    const indivCardW = (contentW - 4) / 2
    const indivCardH = 30
    drawMetricCard(doc, margin, ly, indivCardW, indivCardH, 'Actions totales', String(learner.totalActions))
    drawMetricCard(doc, margin + indivCardW + 4, ly, indivCardW, indivCardH, 'Actions / sem.', learner.avgActionsPerWeek.toFixed(1))
    ly += indivCardH + 5

    // ── Dynamique individuelle ──
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...COLORS.textMedium)
    doc.text('Dynamique', margin, ly)
    ly += 5
    const learnerDyn = getDynamiqueForCount(learner.avgActionsPerWeek)
    ly = drawDynamiqueGaugeWithMarkers(doc, margin, ly, contentW, learnerDyn.level)
    ly += 4

    // ── Météo ──
    ly = checkPageBreak(doc, ly, 50)
    ly = drawSectionTitle(doc, margin, ly, 'Meteo')

    const learnerTotal = learner.weatherSummary.sunny + learner.weatherSummary.cloudy + learner.weatherSummary.stormy
    if (learnerTotal > 0) {
      // 3 blocs colorés
      ly = drawWeatherBlocks(doc, margin, ly, contentW, learner.weatherSummary)
      ly += 4

      // Timeline pills
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

    // ── Ce qui a marché ──
    if (learner.whatWorked.length > 0) {
      ly = checkPageBreak(doc, ly, 15)
      ly = drawSectionTitle(doc, margin, ly, 'Ce qui a marche')

      learner.whatWorked.forEach((text) => {
        ly = checkPageBreak(doc, ly, 10)
        const lines = doc.splitTextToSize(text, contentW - 10)
        const blockH = lines.length * 4 + 4

        // Fond vert clair
        doc.setFillColor(...COLORS.greenBg)
        doc.roundedRect(margin, ly, contentW, blockH, 2, 2, 'F')

        // Indicateur vert à gauche
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
      ly = drawSectionTitle(doc, margin, ly, 'Difficultes rencontrees')

      learner.difficulties.forEach((text) => {
        ly = checkPageBreak(doc, ly, 10)
        const lines = doc.splitTextToSize(text, contentW - 10)
        const blockH = lines.length * 4 + 4

        // Fond rouge clair
        doc.setFillColor(...COLORS.redBg)
        doc.roundedRect(margin, ly, contentW, blockH, 2, 2, 'F')

        // Indicateur rouge à gauche
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
