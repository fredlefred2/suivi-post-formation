export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getCurrentWeek, expectedCheckins, calculateStreak } from '@/lib/utils'
import { getDynamique } from '@/lib/axeHelpers'
import OnboardingFlow from './OnboardingFlow'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { week, year } = getCurrentWeek()

  const [
    { data: profile },
    { data: axes },
    { data: thisWeekCheckin },
    { data: allCheckins },
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, created_at').eq('id', user!.id).single(),
    supabase.from('axes')
      .select('id, subject, difficulty, actions(id, created_at)')
      .eq('learner_id', user!.id)
      .order('created_at'),
    supabase.from('checkins')
      .select('weather')
      .eq('learner_id', user!.id)
      .eq('week_number', week)
      .eq('year', year)
      .maybeSingle(),
    supabase.from('checkins')
      .select('id, weather, week_number, year, created_at')
      .eq('learner_id', user!.id)
      .order('created_at', { ascending: true }),
  ])

  const checkinDone = !!thisWeekCheckin
  const totalCheckins = allCheckins?.length ?? 0
  const expected = profile?.created_at ? expectedCheckins(profile.created_at) : 0

  // Total actions menées
  const totalCompletedActions = axes?.reduce((acc, axe) => {
    return acc + ((axe.actions as { id: string }[])?.length ?? 0)
  }, 0) ?? 0

  // Delta actions des 7 derniers jours
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const deltaActionsThisWeek = axes?.reduce((acc, axe) => {
    return acc + ((axe.actions as { id: string; created_at: string }[]) ?? [])
      .filter(a => a.created_at >= sevenDaysAgo.toISOString()).length
  }, 0) ?? 0

  // Dernière météo enregistrée
  const lastWeather = allCheckins?.length
    ? (allCheckins[allCheckins.length - 1].weather as string | null)
    : null

  // Streak (semaines consécutives de check-in)
  const streak = calculateStreak(
    (allCheckins ?? []).map(c => ({ week_number: c.week_number, year: c.year })),
    week,
    year
  )

  // Actions de la semaine dernière (pour le récap)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
  const lastWeekActions = axes?.reduce((acc, axe) => {
    return acc + ((axe.actions as { id: string; created_at: string }[]) ?? [])
      .filter(a => a.created_at >= twoWeeksAgo.toISOString() && a.created_at < oneWeekAgo.toISOString()).length
  }, 0) ?? 0

  // Rang dans le groupe
  let rank: number | null = null
  let groupSize: number | null = null
  try {
    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
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

  // Axes formatés pour le client
  const axeItems = (axes ?? []).map((axe, index) => {
    const completedCount = ((axe.actions as { id: string }[]) ?? []).length
    return {
      id: axe.id,
      index,
      subject: axe.subject,
      completedCount,
      dyn: getDynamique(completedCount),
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
        totalCheckins={totalCheckins}
        expectedCheckins={expected}
        totalActions={totalCompletedActions}
        deltaActionsThisWeek={deltaActionsThisWeek}
        lastWeather={lastWeather}
        axesCount={axesCount}
        axes={axeItems}
        stepsData={stepsData}
        streak={streak}
        rank={rank}
        groupSize={groupSize}
        lastWeekActions={lastWeekActions}
      />
    </OnboardingFlow>
  )
}
