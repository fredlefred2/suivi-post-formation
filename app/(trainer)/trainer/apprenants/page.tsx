export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { expectedCheckins } from '@/lib/utils'
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

  // 4 & 5. Feedback (likes + commentaires) via admin client
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

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
      .map((axe, i) => ({
        id: axe.id,
        index: i,
        subject: axe.subject,
        description: axe.description,
        difficulty: axe.difficulty,
        actions: axe.actions as ActionRow[],
      }))

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
