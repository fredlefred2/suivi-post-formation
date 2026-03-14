export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { formatWeek, expectedCheckins } from '@/lib/utils'
import {
  WEATHER_COLORS,
} from '@/lib/types'
import type { ActionFeedbackData } from '@/lib/types'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import LearnerNav from './LearnerNav'
import LearnerAxesSection from './LearnerAxesSection'

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}

type ActionRow = { id: string; description: string; completed: boolean; created_at: string }

export default async function LearnerDetailPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { group?: string; from?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Vérifier que l'apprenant appartient à un groupe de ce formateur
  const { data: membership } = await supabase
    .from('group_members')
    .select('group_id, groups!inner(trainer_id, name)')
    .eq('learner_id', params.id)
    .eq('groups.trainer_id', user!.id)
    .limit(1)
    .maybeSingle()

  if (!membership) notFound()

  const [
    { data: profile },
    { data: axes },
    { data: checkins },
  ] = await Promise.all([
    supabase.from('profiles').select('first_name, last_name, created_at').eq('id', params.id).single(),
    supabase.from('axes').select('*, actions(*)').eq('learner_id', params.id).order('created_at'),
    supabase.from('checkins').select('*').eq('learner_id', params.id).order('year').order('week_number'),
  ])

  if (!profile) notFound()

  // ── Groupes du formateur (pour le sélecteur) ───────────────────────────────
  const { data: allGroupsRaw } = await supabase
    .from('groups')
    .select('id, name')
    .eq('trainer_id', user!.id)
    .order('name')

  const allGroupIds = (allGroupsRaw ?? []).map((g) => g.id)

  // Membres de tous les groupes (pour comptage + carousel)
  const { data: allGroupMembers } = allGroupIds.length > 0
    ? await supabase
        .from('group_members')
        .select('learner_id, group_id, profiles!inner(first_name, last_name)')
        .in('group_id', allGroupIds)
    : { data: [] as Array<{ learner_id: string; group_id: string; profiles: { first_name: string; last_name: string } }> }

  // Groupes avec comptage pour le sélecteur
  const groupsForSelector = (allGroupsRaw ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    count: (allGroupMembers ?? []).filter((m) => m.group_id === g.id).length,
  }))

  // ── Carousel : groupe courant ──────────────────────────────────────────────
  const groupId = searchParams.group && searchParams.group !== 'all' && searchParams.group !== 'unassigned'
    ? searchParams.group
    : (membership.group_id as string)

  // Apprenants du groupe courant, triés alphabétiquement
  type LearnerEntry = { id: string; name: string }
  const learnersInGroup: LearnerEntry[] = (allGroupMembers ?? [])
    .filter((m) => m.group_id === groupId)
    .map((m) => {
      const p = m.profiles as unknown as { first_name: string; last_name: string }
      return { id: m.learner_id, name: `${p.first_name} ${p.last_name}` }
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

  const currentIndex = learnersInGroup.findIndex((l) => l.id === params.id)

  const prevLearner = currentIndex > 0 ? learnersInGroup[currentIndex - 1] : null
  const nextLearner = currentIndex >= 0 && currentIndex < learnersInGroup.length - 1
    ? learnersInGroup[currentIndex + 1]
    : null

  function buildLearnerUrl(learnerId: string) {
    const qs = new URLSearchParams()
    qs.set('group', groupId)
    if (searchParams.from) qs.set('from', searchParams.from)
    return `/trainer/learner/${learnerId}?${qs.toString()}`
  }

  const prevUrl = prevLearner ? buildLearnerUrl(prevLearner.id) : null
  const nextUrl = nextLearner ? buildLearnerUrl(nextLearner.id) : null
  const allUrls = learnersInGroup.map((l) => buildLearnerUrl(l.id))

  // ── Stats ──────────────────────────────────────────────────────────────────
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const allLearnerActions = (axes ?? []).flatMap((axe) => axe.actions as ActionRow[])
  const totalActions = allLearnerActions.length
  const actionsThisWeek = allLearnerActions.filter((a) => {
    const d = new Date(a.created_at)
    return d >= monday && d <= sunday
  }).length

  const totalCheckins = (checkins ?? []).length
  const expected = profile.created_at ? expectedCheckins(profile.created_at) : 0
  const lastWeather = totalCheckins > 0 ? (checkins![totalCheckins - 1].weather as string) : null
  const weatherEmoji = lastWeather ? WEATHER_ICONS[lastWeather] ?? '❓' : null

  // ── Feedback (likes + commentaires) sur les actions ───────────────────────
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const allActionIds = (axes ?? []).flatMap(
    (axe) => (axe.actions as ActionRow[]).map((a) => a.id)
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

  // ── Météo count pour résumé ───────────────────────────────────────────────
  const weatherCount = {
    sunny:  (checkins ?? []).filter((c) => c.weather === 'sunny').length,
    cloudy: (checkins ?? []).filter((c) => c.weather === 'cloudy').length,
    stormy: (checkins ?? []).filter((c) => c.weather === 'stormy').length,
  }

  return (
    <div className="space-y-6 pb-4">

      {/* ── Carousel + contenu ──────────────────────────────────────────────── */}
      <LearnerNav
        prevUrl={prevUrl}
        nextUrl={nextUrl}
        currentIndex={currentIndex >= 0 ? currentIndex : 0}
        total={learnersInGroup.length}
        allUrls={allUrls}
        groups={groupsForSelector}
        currentGroupId={groupId}
      >
      <div className="space-y-6">

      {/* ── Nom de l'apprenant ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">{profile.first_name} {profile.last_name}</h1>
        <Link
          href={`/trainer/messages?with=${params.id}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors"
        >
          <MessageCircle size={14} />
          Message
        </Link>
      </div>

      {/* ── Bloc 1 : Check-ins + Dernière météo ───────────────────────────── */}
      <div className="card py-5 px-4">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {/* Check-ins */}
          <div className="text-center px-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-emerald-500 mb-1.5"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>
            <p className="text-3xl font-bold text-gray-800">
              {totalCheckins}
              {expected > 0 && <span className="text-sm font-normal text-gray-400">/{expected}</span>}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Check-ins</p>
          </div>
          {/* Dernière météo */}
          <div className="text-center px-2 flex flex-col items-center justify-center">
            {weatherEmoji ? (
              <>
                <p className="text-xs text-gray-500 mb-2">Dernière météo</p>
                <span className="text-6xl leading-none">{weatherEmoji}</span>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">Dernière météo</p>
                <span className="text-5xl text-gray-300">-</span>
                <p className="text-[11px] text-gray-400 mt-1">Pas de check-in</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Bloc 2 : Actions + Delta cette semaine ────────────────────────── */}
      <div className="card py-5 px-4">
        <div className="grid grid-cols-2 divide-x divide-gray-100">
          {/* Total actions */}
          <div className="text-center px-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-amber-500 mb-1.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <p className="text-3xl font-bold text-gray-800">{totalActions}</p>
            <p className="text-xs text-gray-500 mt-0.5">Actions menées</p>
          </div>
          {/* Delta cette semaine */}
          <div className="text-center px-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`mx-auto ${actionsThisWeek > 0 ? 'text-emerald-500' : 'text-gray-400'} mb-1.5`}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            <p className={`text-3xl font-bold ${actionsThisWeek > 0 ? 'text-emerald-600' : 'text-gray-800'}`}>
              {actionsThisWeek > 0 ? `+${actionsThisWeek}` : '0'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Cette semaine</p>
          </div>
        </div>
      </div>

      {/* ── Axes de progrès ────────────────────────────────────────────────── */}
      {axes && axes.length > 0 && (
        <LearnerAxesSection
          axes={(axes ?? []).map((axe, i) => ({
            id: axe.id,
            index: i,
            subject: axe.subject,
            description: axe.description,
            difficulty: axe.difficulty,
            actions: axe.actions as ActionRow[],
          }))}
          feedbackMap={feedbackMap}
        />
      )}

      {/* ── Historique météo ───────────────────────────────────────────────── */}
      {checkins && checkins.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">🌤 Historique météo</h2>

          {/* Résumé en 3 blocs */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {(['sunny', 'cloudy', 'stormy'] as const).map((w) => (
              <div key={w} className={`rounded-lg p-3 text-center ${WEATHER_COLORS[w]}`}>
                <p className="text-2xl">{w === 'sunny' ? '☀️' : w === 'cloudy' ? '⛅' : '⛈️'}</p>
                <p className="font-bold text-lg mt-0.5">{weatherCount[w]}</p>
                <p className="text-xs mt-0.5">
                  {checkins.length > 0
                    ? `${Math.round((weatherCount[w] / checkins.length) * 100)}%`
                    : '0%'}
                </p>
              </div>
            ))}
          </div>

          {/* Timeline pills */}
          <div className="flex flex-wrap gap-1.5">
            {[...checkins].reverse().map((ci) => (
              <span
                key={ci.id}
                title={formatWeek(ci.week_number, ci.year)}
                className={`text-xs font-medium px-2 py-0.5 rounded-full cursor-default ${
                  WEATHER_COLORS[ci.weather as keyof typeof WEATHER_COLORS]
                }`}
              >
                {ci.weather === 'sunny' ? '☀️' : ci.weather === 'cloudy' ? '⛅' : '⛈️'} S{ci.week_number}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* État vide */}
      {(!checkins || checkins.length === 0) && (!axes || axes.length === 0) && (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-gray-500 font-medium">Ce participant n&apos;a pas encore commencé.</p>
          <p className="text-gray-400 text-sm mt-1">Aucun axe ni check-in enregistré pour le moment.</p>
        </div>
      )}

      </div>{/* end space-y-6 inner */}
      </LearnerNav>
    </div>
  )
}
