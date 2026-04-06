export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { expectedCheckins, calculateStreak, getCurrentWeek } from '@/lib/utils'
import type { ActionFeedbackData } from '@/lib/types'
import ApprenantsAccordionClient from './ApprenantsAccordionClient'

type ActionRow = { id: string; description: string; completed: boolean; created_at: string }
type AxeRow = { id: string; subject: string; description: string | null; difficulty: string; learner_id: string; actions: ActionRow[]; created_at: string }
type CheckinRow = { id: string; learner_id: string; weather: string; week_number: number; year: number; created_at: string; what_worked?: string; difficulties?: string }

export default async function ApprenantsPage({
  searchParams,
}: {
  searchParams: { group?: string; learner?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { week: currentWeek, year: currentYear } = getCurrentWeek()

  // ── Groupes du formateur ─────────────────────────────────────────────────
  const { data: groups } = await supabase
    .from('groups')
    .select('id, name')
    .eq('trainer_id', user!.id)
    .order('name')

  if (!groups || groups.length === 0) {
    redirect('/trainer/groups')
  }

  const groupIds = groups.map((g) => g.id)

  // ── Membres de tous les groupes ──────────────────────────────────────────
  const { data: allMembers } = await supabase
    .from('group_members')
    .select('learner_id, group_id, profiles!inner(first_name, last_name)')
    .in('group_id', groupIds)

  if (!allMembers || allMembers.length === 0) {
    redirect('/trainer/groups')
  }

  // ── Déterminer le groupe cible ───────────────────────────────────────────
  let targetGroupId = searchParams.group
  if (!targetGroupId || targetGroupId === 'all' || targetGroupId === 'unassigned' || !groupIds.includes(targetGroupId)) {
    targetGroupId = ''
  }

  let groupMembers = targetGroupId
    ? allMembers.filter((m) => m.group_id === targetGroupId)
    : []

  if (groupMembers.length === 0) {
    for (const g of groups) {
      const gm = allMembers.filter((m) => m.group_id === g.id)
      if (gm.length > 0) {
        groupMembers = gm
        targetGroupId = g.id
        break
      }
    }
  }

  if (groupMembers.length === 0 || !targetGroupId) {
    redirect('/trainer/groups')
  }

  // Trier alphabétiquement
  const sorted = groupMembers.sort((a, b) => {
    const pa = a.profiles as unknown as { first_name: string; last_name: string }
    const pb = b.profiles as unknown as { first_name: string; last_name: string }
    return `${pa.first_name} ${pa.last_name}`.localeCompare(`${pb.first_name} ${pb.last_name}`, 'fr')
  })

  const learnerIds = sorted.map((m) => m.learner_id)

  // ── Groupes pour le sélecteur (avec comptage) ───────────────────────────
  const groupsForSelector = groups.map((g) => ({
    id: g.id,
    name: g.name,
    count: allMembers.filter((m) => m.group_id === g.id).length,
  }))

  // ── Index initial (si learner ID passé en paramètre) ────────────────────
  const initialIndex = searchParams.learner
    ? Math.max(0, learnerIds.indexOf(searchParams.learner))
    : 0

  // ══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING GROUPÉ — 5 requêtes au total pour tous les apprenants
  // ══════════════════════════════════════════════════════════════════════════

  // 1. Profils
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, created_at')
    .in('id', learnerIds)

  // 2. Axes avec actions
  const { data: allAxes } = await supabase
    .from('axes')
    .select('*, actions(*)')
    .in('learner_id', learnerIds)
    .order('created_at')

  // 3. Check-ins
  const { data: allCheckins } = await supabase
    .from('checkins')
    .select('*')
    .in('learner_id', learnerIds)
    .order('year')
    .order('week_number')

  // 3b. Feedback (likes + commentaires) + Tips via admin client (bypass RLS)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Tips par axe (via admin pour bypass RLS)
  const allAxeIds = (allAxes ?? []).map((a) => (a as AxeRow).id)
  const { data: allTips } = allAxeIds.length > 0
    ? await admin
        .from('tips')
        .select('id, axe_id, learner_id, week_number, content, advice, sent, acted, read_at')
        .in('axe_id', allAxeIds)
        .order('week_number')
    : { data: [] as Array<{ id: string; axe_id: string; learner_id: string; week_number: number; content: string; advice: string | null; sent: boolean; acted: boolean; read_at: string | null }> }

  const allActionIds = (allAxes ?? []).flatMap(
    (axe) => ((axe as AxeRow).actions as ActionRow[]).map((a) => a.id)
  )

  const [{ data: likesDetailed }, { data: commentsDetailed }] = await Promise.all([
    allActionIds.length > 0
      ? admin.from('action_likes')
          .select('action_id, trainer_id, profiles!inner(first_name, last_name)')
          .in('action_id', allActionIds)
      : Promise.resolve({ data: [] as Array<{ action_id: string; trainer_id: string; profiles: { first_name: string; last_name: string } }> }),
    allActionIds.length > 0
      ? admin.from('action_comments')
          .select('id, action_id, trainer_id, content, created_at, profiles!inner(first_name, last_name)')
          .in('action_id', allActionIds)
          .order('created_at', { ascending: true })
      : Promise.resolve({ data: [] as Array<{ id: string; action_id: string; trainer_id: string; content: string; created_at: string; profiles: { first_name: string; last_name: string } }> }),
  ])

  // ── Construire le feedbackMap global ─────────────────────────────────────
  const feedbackMap: Record<string, ActionFeedbackData> = {}
  allActionIds.forEach((id) => {
    const likes = (likesDetailed ?? []).filter((l) => l.action_id === id)
    const comments = (commentsDetailed ?? []).filter((c) => c.action_id === id)
    feedbackMap[id] = {
      likes_count: likes.length,
      comments_count: comments.length,
      liked_by_me: likes.some((l) => l.trainer_id === user!.id),
      likers: likes.map((l) => {
        const p = l.profiles as unknown as { first_name: string; last_name: string }
        return { first_name: p.first_name, last_name: p.last_name }
      }),
      comments: comments.map((c) => {
        const p = c.profiles as unknown as { first_name: string; last_name: string }
        return { id: c.id, content: c.content, created_at: c.created_at, trainer_first_name: p.first_name, trainer_last_name: p.last_name }
      }),
    }
  })

  // ── Semaine courante (pour delta actions) ────────────────────────────────
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  // ── Assembler les données par apprenant ──────────────────────────────────
  const learners = sorted.map((member) => {
    const p = (profiles ?? []).find((pr) => pr.id === member.learner_id)
    const memberProfile = member.profiles as unknown as { first_name: string; last_name: string }
    const firstName = p?.first_name ?? memberProfile.first_name
    const lastName = p?.last_name ?? memberProfile.last_name
    const createdAt = p?.created_at ?? ''

    const learnerAxes = ((allAxes ?? []) as AxeRow[])
      .filter((a) => a.learner_id === member.learner_id)
      .map((axe, i) => {
        const axeTips = (allTips ?? [])
          .filter((t) => t.axe_id === axe.id)
          .map((t) => ({
            id: t.id,
            week_number: t.week_number,
            content: t.content,
            advice: t.advice,
            sent: t.sent,
            acted: t.acted,
            read_at: t.read_at,
          }))
        return {
          id: axe.id,
          index: i,
          subject: axe.subject,
          description: axe.description,
          difficulty: axe.difficulty,
          actions: axe.actions as ActionRow[],
          tips: axeTips,
        }
      })

    const learnerCheckins = ((allCheckins ?? []) as CheckinRow[])
      .filter((c) => c.learner_id === member.learner_id)

    const allLearnerActions = learnerAxes.flatMap((a) => a.actions)
    const totalActions = allLearnerActions.length
    const actionsThisWeek = allLearnerActions.filter((a) => {
      const d = new Date(a.created_at)
      return d >= monday && d <= sunday
    }).length

    const totalCheckins = learnerCheckins.length
    const expected = createdAt ? expectedCheckins(createdAt) : 0
    const lastWeather = totalCheckins > 0 ? learnerCheckins[totalCheckins - 1].weather : null

    const weatherCount = {
      sunny: learnerCheckins.filter((c) => c.weather === 'sunny').length,
      cloudy: learnerCheckins.filter((c) => c.weather === 'cloudy').length,
      stormy: learnerCheckins.filter((c) => c.weather === 'stormy').length,
    }

    // Feedback pour cet apprenant
    const learnerActionIds = allLearnerActions.map((a) => a.id)
    const learnerFeedbackMap: Record<string, ActionFeedbackData> = {}
    learnerActionIds.forEach((id) => {
      learnerFeedbackMap[id] = feedbackMap[id] ?? {
        likes_count: 0, comments_count: 0, liked_by_me: false, likers: [], comments: [],
      }
    })

    // ── Régularité : (semaines actives / semaines depuis 1er axe) × 100 ──
    const firstAxeDate = learnerAxes.length > 0
      ? ((allAxes ?? []) as AxeRow[])
          .filter(a => a.learner_id === member.learner_id)
          .map(a => new Date(a.created_at).getTime())
          .sort((a, b) => a - b)[0]
      : null

    let regularity = 0
    if (firstAxeDate) {
      const msPerWeek = 7 * 24 * 60 * 60 * 1000
      const totalWeeks = Math.max(1, Math.ceil((now.getTime() - firstAxeDate) / msPerWeek))
      // Compter les semaines avec au moins 1 action OU 1 check-in
      const activeWeeks = new Set<string>()
      for (const action of allLearnerActions) {
        const d = new Date(action.created_at)
        // ISO week key
        const jan1 = new Date(d.getFullYear(), 0, 1)
        const wk = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7)
        activeWeeks.add(`${d.getFullYear()}-${wk}`)
      }
      for (const ci of learnerCheckins) {
        activeWeeks.add(`${ci.year}-${ci.week_number}`)
      }
      regularity = Math.min(100, Math.round((activeWeeks.size / totalWeeks) * 100))
    }

    // ── Streak check-in : même calcul que le dashboard apprenant ──
    const checkinStreak = calculateStreak(
      learnerCheckins.map(c => ({ week_number: c.week_number, year: c.year })),
      currentWeek,
      currentYear
    )

    return {
      id: member.learner_id,
      firstName,
      lastName,
      createdAt,
      totalActions,
      actionsThisWeek,
      totalCheckins,
      expectedCheckins: expected,
      lastWeather,
      weatherCount,
      checkins: learnerCheckins,
      axes: learnerAxes,
      feedbackMap: learnerFeedbackMap,
      regularity,
      checkinStreak,
    }
  })

  return (
    <ApprenantsAccordionClient
      learners={learners}
      groups={groupsForSelector}
      currentGroupId={targetGroupId}
      initialIndex={initialIndex}
    />
  )
}
