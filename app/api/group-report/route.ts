import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { weeksSince } from '@/lib/utils'
import { generateGroupReport } from '@/lib/pdf/group-report'
import type { GroupReportData, LearnerReportData, WeekWeather } from '@/lib/pdf/group-report'

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

    // ── Membres du groupe ──
    const { data: membersRaw } = await admin
      .from('group_members')
      .select('learner_id')
      .eq('group_id', groupId)

    const learnerIds = membersRaw?.map((m) => m.learner_id) ?? []

    if (learnerIds.length === 0) {
      return NextResponse.json({ error: 'Groupe vide' }, { status: 400 })
    }

    // ── Fetch parallèle : profiles, checkins, actions, axes ──
    const [profilesRes, checkinsRes, actionsRes, axesRes] = await Promise.all([
      admin.from('profiles').select('id, first_name, last_name, created_at').in('id', learnerIds),
      admin.from('checkins')
        .select('learner_id, weather, week_number, year, what_worked, difficulties, created_at')
        .in('learner_id', learnerIds)
        .order('year', { ascending: true })
        .order('week_number', { ascending: true }),
      admin.from('actions').select('id, learner_id, created_at').in('learner_id', learnerIds),
      admin.from('axes').select('id, learner_id, subject').in('learner_id', learnerIds).order('created_at'),
    ])

    const profiles = profilesRes.data ?? []
    const checkins = checkinsRes.data ?? []
    const allActions = actionsRes.data ?? []
    const axes = axesRes.data ?? []

    const profileMap: Record<string, { firstName: string; lastName: string; createdAt: string }> = {}
    profiles.forEach((p) => {
      profileMap[p.id] = { firstName: p.first_name, lastName: p.last_name, createdAt: p.created_at }
    })

    // ── Agrégation : données du groupe ──
    const totalActions = allActions.length
    const totalWeeks = learnerIds.reduce((acc, lid) => {
      const p = profileMap[lid]
      if (!p) return acc
      const ws = weeksSince(p.createdAt)
      return acc + Math.max(ws, 1)
    }, 0)
    const avgActionsPerWeek = totalWeeks > 0 ? totalActions / totalWeeks * learnerIds.length : 0

    // Météo du groupe par semaine
    const weekMap: Record<string, { sunny: number; cloudy: number; stormy: number; week: number; year: number }> = {}
    checkins.forEach((c) => {
      const key = `${c.year}-${c.week_number}`
      if (!weekMap[key]) {
        weekMap[key] = { sunny: 0, cloudy: 0, stormy: 0, week: c.week_number, year: c.year }
      }
      const w = c.weather as 'sunny' | 'cloudy' | 'stormy'
      if (weekMap[key][w] !== undefined) weekMap[key][w]++
    })

    const weatherHistory = Object.values(weekMap).sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.week - b.week
    )

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
          id: lid,
          firstName: 'Inconnu',
          lastName: '',
          createdAt: new Date().toISOString(),
          axes: [],
          totalActions: 0,
          weeksSinceJoin: 0,
          avgActionsPerWeek: 0,
          weatherHistory: [],
          weatherSummary: { sunny: 0, cloudy: 0, stormy: 0 },
          whatWorked: [],
          difficulties: [],
        }
      }

      const learnerAxes = axes.filter((a) => a.learner_id === lid).map((a) => a.subject)
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

      return {
        id: lid,
        firstName: p.firstName,
        lastName: p.lastName,
        createdAt: p.createdAt,
        axes: learnerAxes,
        totalActions: learnerActions.length,
        weeksSinceJoin: ws,
        avgActionsPerWeek: avgPerWeek,
        weatherHistory: learnerWeatherHistory,
        weatherSummary: learnerWeatherSummary,
        whatWorked,
        difficulties,
      }
    })

    // Tri par nom
    learners.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

    // ── Construction des données du rapport ──
    const reportData: GroupReportData = {
      groupName: group.name,
      generatedAt: new Date().toISOString(),
      participantCount: learnerIds.length,
      totalActions,
      avgActionsPerWeek: learnerIds.length > 0
        ? totalActions / learnerIds.length / Math.max(
            learnerIds.reduce((acc, lid) => {
              const p = profileMap[lid]
              return acc + (p ? Math.max(weeksSince(p.createdAt), 1) : 1)
            }, 0) / learnerIds.length,
            1,
          )
        : 0,
      weatherHistory,
      weatherSummary: groupWeatherSummary,
      learners,
    }

    // ── Génération du PDF ──
    const doc = generateGroupReport(reportData)
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'))

    // ── Nom du fichier ──
    const safeGroupName = group.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
    const dateFile = new Date().toISOString().slice(0, 10)
    const filename = `rapport-${safeGroupName}-${dateFile}.pdf`

    return new NextResponse(pdfBuffer, {
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
