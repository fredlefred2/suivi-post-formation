export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { weeksSince } from '@/lib/utils'
import { renderToBuffer } from '@react-pdf/renderer'
import { GroupReportDocument } from '@/lib/pdf/react-pdf-report'
import type { GroupReportData, LearnerReportData, WeekWeather } from '@/lib/pdf/group-report'
import { generateAIAnalysis } from '@/lib/pdf/ai-analysis'

export async function GET(request: NextRequest) {
  try {
    const groupId = request.nextUrl.searchParams.get('groupId')
    if (!groupId) {
      return NextResponse.json({ error: 'groupId requis' }, { status: 400 })
    }

    // ── Auth ──
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    // ── Vérifier que le groupe appartient au formateur ──
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('id, name, trainer_id')
      .eq('id', groupId)
      .single()

    if (groupError || !group) {
      return NextResponse.json({ error: 'Groupe non trouvé' }, { status: 404 })
    }

    if (group.trainer_id !== user.id) {
      return NextResponse.json({ error: 'Accès interdit' }, { status: 403 })
    }

    // ── Client admin pour les requêtes cross-tables ──
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // ── Récupérer le nom du formateur ──
    const { data: trainerProfile } = await admin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', user.id)
      .single()

    const trainerName = trainerProfile
      ? `${trainerProfile.first_name} ${trainerProfile.last_name}`
      : 'Formateur'

    // ── Membres du groupe ──
    const { data: membersRaw } = await admin
      .from('group_members')
      .select('learner_id')
      .eq('group_id', groupId)

    const learnerIds = membersRaw?.map((m) => m.learner_id) ?? []

    if (learnerIds.length === 0) {
      return NextResponse.json({ error: 'Groupe vide' }, { status: 400 })
    }

    // ── Fetch parallèle : profiles, checkins, actions, axes (avec actions jointes) ──
    const [profilesRes, checkinsRes, actionsRes, axesRes] = await Promise.all([
      admin.from('profiles').select('id, first_name, last_name, created_at').in('id', learnerIds),
      admin.from('checkins')
        .select('learner_id, weather, week_number, year, what_worked, difficulties, created_at')
        .in('learner_id', learnerIds)
        .order('year', { ascending: true })
        .order('week_number', { ascending: true }),
      admin.from('actions').select('id, learner_id, axe_id, created_at').in('learner_id', learnerIds),
      admin.from('axes')
        .select('id, learner_id, subject, actions(id, description)')
        .in('learner_id', learnerIds)
        .order('created_at'),
    ])

    const profiles = profilesRes.data ?? []
    const checkins = checkinsRes.data ?? []
    const allActions = actionsRes.data ?? []
    const axes = axesRes.data ?? []

    const profileMap: Record<string, { firstName: string; lastName: string; createdAt: string }> = {}
    profiles.forEach((p) => {
      profileMap[p.id] = { firstName: p.first_name, lastName: p.last_name, createdAt: p.created_at }
    })

    // ── Axes par apprenant (avec nombre d'actions par axe) ──
    const learnerAxesMap: Record<string, Array<{ subject: string; actionCount: number; actionDescriptions: string[] }>> = {}
    axes.forEach((axe) => {
      if (!learnerAxesMap[axe.learner_id]) learnerAxesMap[axe.learner_id] = []
      const axeActions = (axe.actions as { id: string; description: string }[]) ?? []
      learnerAxesMap[axe.learner_id].push({
        subject: axe.subject,
        actionCount: axeActions.length,
        actionDescriptions: axeActions.map((a) => a.description),
      })
    })

    // ── Agrégation : données du groupe ──
    const totalActions = allActions.length
    const totalAxes = axes.length

    // Météo du groupe — moyenne par semaine (agrégation de tous les apprenants)
    const weekScoreMap = new Map<string, { week: number; year: number; scores: number[] }>()
    const weatherScoreValue: Record<string, number> = { sunny: 1, cloudy: 3, stormy: 5 }
    checkins.forEach((c) => {
      const key = `${c.year}-${c.week_number}`
      if (!weekScoreMap.has(key)) {
        weekScoreMap.set(key, { week: c.week_number, year: c.year, scores: [] })
      }
      weekScoreMap.get(key)!.scores.push(weatherScoreValue[c.weather as string] ?? 3)
    })
    const weatherHistory = Array.from(weekScoreMap.values())
      .sort((a, b) => a.year - b.year || a.week - b.week)
      .map((entry) => {
        const avg = entry.scores.reduce((s, v) => s + v, 0) / entry.scores.length
        let weather: string
        if (avg <= 2) weather = 'sunny'
        else if (avg < 4) weather = 'cloudy'
        else weather = 'stormy'
        return { week: entry.week, year: entry.year, weather }
      })

    // Météo globale du groupe
    const groupWeatherSummary = { sunny: 0, cloudy: 0, stormy: 0 }
    checkins.forEach((c) => {
      const w = c.weather as 'sunny' | 'cloudy' | 'stormy'
      if (groupWeatherSummary[w] !== undefined) groupWeatherSummary[w]++
    })

    // ── Données par apprenant ──
    const learners: LearnerReportData[] = learnerIds.map((lid) => {
      const p = profileMap[lid]
      if (!p) {
        return {
          id: lid, firstName: 'Inconnu', lastName: '', createdAt: new Date().toISOString(),
          axes: [], axeActionCounts: [], axeActions: [], totalActions: 0, weeksSinceJoin: 0, avgActionsPerWeek: 0, regularityPct: 0,
          weatherHistory: [], weatherSummary: { sunny: 0, cloudy: 0, stormy: 0 },
          whatWorked: [], difficulties: [],
        }
      }

      const learnerAxes = learnerAxesMap[lid] ?? []
      const learnerActions = allActions.filter((a) => a.learner_id === lid)
      const learnerCheckins = checkins.filter((c) => c.learner_id === lid)

      const ws = Math.max(weeksSince(p.createdAt), 1)
      const avgPerWeek = learnerActions.length / ws

      const learnerWeatherHistory: WeekWeather[] = learnerCheckins.map((c) => ({
        week: c.week_number,
        year: c.year,
        weather: c.weather as 'sunny' | 'cloudy' | 'stormy',
      }))

      const learnerWeatherSummary = { sunny: 0, cloudy: 0, stormy: 0 }
      learnerCheckins.forEach((c) => {
        const w = c.weather as 'sunny' | 'cloudy' | 'stormy'
        if (learnerWeatherSummary[w] !== undefined) learnerWeatherSummary[w]++
      })

      const whatWorked = learnerCheckins
        .filter((c) => c.what_worked && c.what_worked.trim().length > 0)
        .map((c) => c.what_worked!.trim())

      const difficulties = learnerCheckins
        .filter((c) => c.difficulties && c.difficulties.trim().length > 0)
        .map((c) => c.difficulties!.trim())

      // Régularité : % de semaines avec au moins 1 action
      const actionsByWeek = new Set<string>()
      learnerActions.forEach((a) => {
        const d = new Date(a.created_at)
        const weekKey = `${d.getFullYear()}-${Math.ceil((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))}`
        actionsByWeek.add(weekKey)
      })
      const regularityPct = ws > 0 ? Math.round((actionsByWeek.size / ws) * 100) : 0

      return {
        id: lid,
        firstName: p.firstName,
        lastName: p.lastName,
        createdAt: p.createdAt,
        axes: learnerAxes.map((a) => a.subject),
        axeActionCounts: learnerAxes.map((a) => a.actionCount),
        axeActions: learnerAxes.map((a) => a.actionDescriptions),
        totalActions: learnerActions.length,
        weeksSinceJoin: ws,
        avgActionsPerWeek: avgPerWeek,
        regularityPct,
        weatherHistory: learnerWeatherHistory,
        weatherSummary: learnerWeatherSummary,
        whatWorked,
        difficulties,
      }
    })

    // Tri par nom
    learners.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

    // ── Calculs moyennes groupe ──
    const avgWeeksPerLearner = learnerIds.reduce((acc, lid) => {
      const p = profileMap[lid]
      return acc + (p ? Math.max(weeksSince(p.createdAt), 1) : 1)
    }, 0) / Math.max(learnerIds.length, 1)

    const avgActionsPerWeek = avgWeeksPerLearner > 0
      ? (totalActions / learnerIds.length) / avgWeeksPerLearner
      : 0

    const avgActionsPerAxe = totalAxes > 0 ? totalActions / totalAxes : 0

    // ── Calculs supplémentaires pour le rapport ──
    const activeLearnersCount = learners.filter((l) => l.totalActions > 0).length
    const groupRegularityPct = learners.length > 0
      ? Math.round(learners.reduce((acc, l) => acc + l.regularityPct, 0) / learners.length)
      : 0

    // Climat groupe : moyenne des moyennes individuelles (sunny=5, cloudy=3, stormy=1)
    const learnerClimatScores = learners
      .map((l) => {
        const total = l.weatherSummary.sunny + l.weatherSummary.cloudy + l.weatherSummary.stormy
        if (total === 0) return null
        return (l.weatherSummary.sunny * 5 + l.weatherSummary.cloudy * 3 + l.weatherSummary.stormy * 1) / total
      })
      .filter((s): s is number => s !== null)
    const groupClimatScore = learnerClimatScores.length > 0
      ? learnerClimatScores.reduce((a, b) => a + b, 0) / learnerClimatScores.length
      : undefined

    // ── Construction des données du rapport ──
    const reportData: GroupReportData = {
      groupName: group.name,
      trainerName,
      generatedAt: new Date().toISOString(),
      participantCount: learnerIds.length,
      totalAxes,
      totalActions,
      avgActionsPerWeek,
      avgActionsPerAxe,
      activeLearnersCount,
      groupRegularityPct,
      groupClimatScore,
      weatherHistory,
      weatherSummary: groupWeatherSummary,
      learners,
    }

    // ── Analyse IA (non bloquante : si l'IA échoue, le PDF sort quand même) ──
    const aiAnalysis = await generateAIAnalysis(reportData)

    // ── Génération du PDF (React-PDF) ──
    const pdfBuffer = await renderToBuffer(
      GroupReportDocument({ data: reportData, aiAnalysis })
    )

    // ── Nom du fichier ──
    const safeGroupName = group.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
    const dateFile = new Date().toISOString().slice(0, 10)
    const filename = `rapport-${safeGroupName}-${dateFile}.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(pdfBuffer.length),
      },
    })
  } catch (err) {
    console.error('Erreur génération rapport PDF:', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération du rapport' },
      { status: 500 },
    )
  }
}
