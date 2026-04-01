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
import LearnerTipsSection from './LearnerTipsSection'

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

      {/* ── Header gradient : nom + météo + stats ─────────────────────────── */}
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
          boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />

        {/* Ligne 1 : Nom + météo + bouton message */}
        <div className="relative flex items-start justify-between mb-4">
          <div>
            <h1 className="text-xl font-extrabold text-white">{profile.first_name} {profile.last_name}</h1>
            <p className="text-xs text-indigo-200 mt-0.5">{(axes ?? []).length} axe{(axes ?? []).length !== 1 ? 's' : ''} de progrès</p>
          </div>
          <div className="flex items-center gap-2">
            {weatherEmoji && <span className="text-3xl drop-shadow-lg">{weatherEmoji}</span>}
            <Link
              href={`/trainer/messages?with=${params.id}`}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-white/90 hover:bg-white transition-colors"
            >
              <MessageCircle size={13} />
              Message
            </Link>
          </div>
        </div>

        {/* Stats en 3 colonnes glass */}
        <div className="relative grid grid-cols-3 gap-2">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className="text-2xl font-black text-white">{totalActions}</div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">actions</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className={`text-2xl font-black ${actionsThisWeek > 0 ? 'text-emerald-300' : 'text-white/40'}`}>
              {actionsThisWeek > 0 ? `+${actionsThisWeek}` : '0'}
            </div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">cette semaine</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className="text-2xl font-black text-white">
              {totalCheckins}
              {expected > 0 && <span className="text-sm font-normal text-indigo-300">/{expected}</span>}
            </div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">check-ins</p>
          </div>
        </div>
      </div>

      {/* ── Tips IA ─────────────────────────────────────────────────────────── */}
      {axes && axes.length > 0 && (
        <LearnerTipsSection
          learnerId={params.id}
          axes={(axes ?? []).map(axe => ({ id: axe.id, subject: axe.subject }))}
        />
      )}

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
          <p className="text-gray-500 text-sm mt-1">Aucun axe ni check-in enregistré pour le moment.</p>
        </div>
      )}

      </div>{/* end space-y-6 inner */}
      </LearnerNav>
    </div>
  )
}
