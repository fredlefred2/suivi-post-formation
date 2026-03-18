export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCurrentWeek, calculateStreak, getCheckinContext } from '@/lib/utils'
import { getDynamique } from '@/lib/axeHelpers'
import type { ActionFeedbackData } from '@/lib/types'
import OnboardingFlow from './OnboardingFlow'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { week, year } = getCurrentWeek()
  const checkinCtx = getCheckinContext()

  const [
    { data: profile },
    { data: axes },
    { data: checkinForTargetWeek },
    { data: allCheckins },
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, created_at').eq('id', user!.id).single(),
    supabase.from('axes')
      .select('id, subject, description, difficulty, initial_score, actions(id, description, created_at)')
      .eq('learner_id', user!.id)
      .order('created_at'),
    supabase.from('checkins')
      .select('weather')
      .eq('learner_id', user!.id)
      .eq('week_number', checkinCtx.checkinWeek)
      .eq('year', checkinCtx.checkinYear)
      .maybeSingle(),
    supabase.from('checkins')
      .select('id, weather, week_number, year, created_at')
      .eq('learner_id', user!.id)
      .order('created_at', { ascending: true }),
  ])

  // Check-in affiché seulement si fenêtre ouverte (ven→lun) ET pas encore fait
  const checkinDone = !checkinCtx.isOpen || !!checkinForTargetWeek
  const totalCheckins = allCheckins?.length ?? 0
  // Total actions menées
  const totalCompletedActions = axes?.reduce((acc, axe) => {
    return acc + ((axe.actions as { id: string }[])?.length ?? 0)
  }, 0) ?? 0

  // Delta actions de la semaine ISO courante (depuis lundi 00h)
  const now = new Date()
  const dayOfWeekNow = now.getDay() // 0=dim, 1=lun, ..., 6=sam
  const diffToMonday = dayOfWeekNow === 0 ? 6 : dayOfWeekNow - 1
  const thisMonday = new Date(now)
  thisMonday.setHours(0, 0, 0, 0)
  thisMonday.setDate(now.getDate() - diffToMonday)
  const deltaActionsThisWeek = axes?.reduce((acc, axe) => {
    return acc + ((axe.actions as { id: string; created_at: string }[]) ?? [])
      .filter(a => a.created_at >= thisMonday.toISOString()).length
  }, 0) ?? 0

  // Frise météo : les 4 derniers check-ins
  const weatherHistory = (allCheckins ?? [])
    .slice(-4)
    .map(c => c.weather as string)

  // Streak (semaines consécutives de check-in)
  const streak = calculateStreak(
    (allCheckins ?? []).map(c => ({ week_number: c.week_number, year: c.year })),
    week,
    year
  )

  // Actions de la semaine ISO précédente (lundi→dimanche, stable)
  // thisMonday déjà calculé plus haut
  const lastMonday = new Date(thisMonday)
  lastMonday.setDate(thisMonday.getDate() - 7)
  const lastWeekActions = axes?.reduce((acc, axe) => {
    return acc + ((axe.actions as { id: string; created_at: string }[]) ?? [])
      .filter(a => a.created_at >= lastMonday.toISOString() && a.created_at < thisMonday.toISOString()).length
  }, 0) ?? 0

  // Rang dans le groupe
  let rank: number | null = null
  let groupSize: number | null = null
  try {
    const { data: membership } = await admin
      .from('group_members')
      .select('group_id')
      .eq('learner_id', user!.id)
      .limit(1)
      .maybeSingle()

    if (membership) {
      const { data: membersRaw } = await admin
        .from('group_members')
        .select('learner_id')
        .eq('group_id', membership.group_id)

      const memberIds = (membersRaw ?? []).map(m => m.learner_id)

      if (memberIds.length > 1) {
        const { data: allAxes } = await admin
          .from('axes')
          .select('learner_id, actions(id)')
          .in('learner_id', memberIds)

        const actionCounts: Record<string, number> = {}
        memberIds.forEach(id => { actionCounts[id] = 0 })
        ;(allAxes ?? []).forEach(axe => {
          const count = ((axe.actions as { id: string }[]) ?? []).length
          actionCounts[axe.learner_id] = (actionCounts[axe.learner_id] ?? 0) + count
        })

        const sorted = Object.entries(actionCounts).sort(([, a], [, b]) => b - a)
        rank = sorted.findIndex(([id]) => id === user!.id) + 1
        groupSize = memberIds.length
      }
    }
  } catch {
    // Silently fail — rank is optional
  }

  // Première action (pour la suppression dans l'onboarding)
  const firstActionId = axes?.flatMap((axe) =>
    ((axe.actions as { id: string }[]) ?? []).map((a) => a.id)
  )[0] ?? null

  // Admin client (réutilisé pour feedback + rang)
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Feedback (likes + commentaires) pour les actions du dashboard
  const allActionIds = (axes ?? []).flatMap(
    (axe) => ((axe.actions ?? []) as { id: string }[]).map((a) => a.id)
  )

  const [{ data: likesData }, { data: commentsData }] = await Promise.all([
    allActionIds.length > 0
      ? admin.from('action_likes').select('action_id').in('action_id', allActionIds)
      : Promise.resolve({ data: [] as { action_id: string }[] }),
    allActionIds.length > 0
      ? admin.from('action_comments').select('action_id').in('action_id', allActionIds)
      : Promise.resolve({ data: [] as { action_id: string }[] }),
  ])

  // Comptes par axe
  const likesCountByAxe: Record<string, number> = {}
  const commentsCountByAxe: Record<string, number> = {}
  ;(axes ?? []).forEach((axe) => {
    const actionIds = new Set(((axe.actions ?? []) as { id: string }[]).map(a => a.id))
    likesCountByAxe[axe.id] = (likesData ?? []).filter(l => actionIds.has(l.action_id)).length
    commentsCountByAxe[axe.id] = (commentsData ?? []).filter(c => actionIds.has(c.action_id)).length
  })

  // Axes formatés pour le client
  const axeItems = (axes ?? []).map((axe, index) => {
    const actions = (axe.actions ?? []) as { id: string; description: string; created_at: string }[]
    const completedCount = actions.length
    const lastAction = actions.length > 0
      ? actions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null
    return {
      id: axe.id,
      index,
      subject: axe.subject,
      description: (axe as { description?: string | null }).description ?? null,
      completedCount,
      dyn: getDynamique(completedCount),
      likesCount: likesCountByAxe[axe.id] ?? 0,
      commentsCount: commentsCountByAxe[axe.id] ?? 0,
      lastAction: lastAction ? { description: lastAction.description, date: lastAction.created_at } : null,
    }
  })

  // Étapes de progression
  const axesCount = axes?.length ?? 0
  const stepsData = [
    { label: 'Axes définis', done: axesCount >= 3 },
    { label: 'Première action', done: totalCompletedActions > 0 },
    { label: 'Premier check-in', done: totalCheckins > 0 },
  ]

  return (
    <OnboardingFlow
      userId={user!.id}
      firstName={profile?.first_name ?? ''}
      axesCount={axesCount}
      totalActions={totalCompletedActions}
      totalCheckins={totalCheckins}
      firstActionId={firstActionId}
    >
      <DashboardClient
        firstName={profile?.first_name ?? ''}
        checkinDone={checkinDone}
        checkinWeekLabel={checkinCtx.weekLabel}
        totalCheckins={totalCheckins}
        totalActions={totalCompletedActions}
        deltaActionsThisWeek={deltaActionsThisWeek}
        weatherHistory={weatherHistory}
        axesCount={axesCount}
        axes={axeItems}
        stepsData={stepsData}
        streak={streak}
        rank={rank}
        groupSize={groupSize}
        lastWeekActions={lastWeekActions}
        checkinIsOpen={checkinCtx.isOpen}
        axesForCheckin={(axes ?? []).map(a => ({ id: a.id, initial_score: a.initial_score ?? 1 }))}
      />
    </OnboardingFlow>
  )
}
