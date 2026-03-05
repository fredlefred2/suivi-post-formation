export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, expectedCheckins } from '@/lib/utils'
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
        week={week}
        year={year}
        checkinDone={checkinDone}
        totalCheckins={totalCheckins}
        expectedCheckins={expected}
        totalActions={totalCompletedActions}
        deltaActionsThisWeek={deltaActionsThisWeek}
        lastWeather={lastWeather}
        axesCount={axesCount}
        axes={axeItems}
        stepsData={stepsData}
      />
    </OnboardingFlow>
  )
}
