export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { formatWeek, expectedCheckins } from '@/lib/utils'
import { WEATHER_COLORS } from '@/lib/types'
import type { ActionFeedbackData } from '@/lib/types'
import Link from 'next/link'
import { ChevronLeft, MessageCircle } from 'lucide-react'
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

  // ── Groupe courant ────────────────────────────────────────────────
  const groupId = searchParams.group && searchParams.group !== 'all' && searchParams.group !== 'unassigned'
    ? searchParams.group
    : (membership.group_id as string)

  // Nom du groupe
  const { data: groupData } = await supabase
    .from('groups')
    .select('name')
    .eq('id', groupId)
    .single()
  const groupName = groupData?.name ?? 'Groupe'

  // ── Carousel : apprenants du groupe courant ───────────────────────
  const { data: allGroupMembers } = await supabase
    .from('group_members')
    .select('learner_id, group_id, profiles!inner(first_name, last_name)')
    .eq('group_id', groupId)

  type LearnerEntry = { id: string; name: string }
  const learnersInGroup: LearnerEntry[] = (allGroupMembers ?? [])
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
    return `/trainer/learner/${learnerId}?group=${groupId}`
  }

  const prevUrl = prevLearner ? buildLearnerUrl(prevLearner.id) : null
  const nextUrl = nextLearner ? buildLearnerUrl(nextLearner.id) : null
  const allUrls = learnersInGroup.map((l) => buildLearnerUrl(l.id))

  // ── Stats ──────────────────────────────────────────────────────────
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
  const lastWeather = totalCheckins > 0 ? (checkins![totalCheckins - 1].weather as string) : null
  const weatherEmoji = lastWeather ? WEATHER_ICONS[lastWeather] ?? '❓' : null

  // ── Régularité (% de semaines avec au moins 1 action) ──────────
  const joinDate = new Date(profile.created_at)
  const weeksSinceJoin = Math.max(1, Math.ceil((now.getTime() - joinDate.getTime()) / (7 * 24 * 60 * 60 * 1000)))
  const actionWeeks = new Set(allLearnerActions.map((a) => {
    const d = new Date(a.created_at)
    const yr = d.getFullYear()
    const wk = Math.ceil(((d.getTime() - new Date(yr, 0, 1).getTime()) / 86400000 + new Date(yr, 0, 1).getDay() + 1) / 7)
    return `${yr}-${wk}`
  }))
  const regularityPct = Math.min(100, Math.round((actionWeeks.size / weeksSinceJoin) * 100))

  // ── Streak check-ins ────────────────────────────────────────────
  let checkinStreak = 0
  if (checkins && checkins.length > 0) {
    const sorted = [...checkins].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year
      return b.week_number - a.week_number
    })
    let prevWeek = sorted[0].week_number
    let prevYear = sorted[0].year
    checkinStreak = 1
    for (let i = 1; i < sorted.length; i++) {
      const expectedPrev = prevWeek - 1
      if (sorted[i].week_number === expectedPrev && sorted[i].year === prevYear) {
        checkinStreak++
        prevWeek = sorted[i].week_number
      } else if (prevWeek === 1) {
        // Changement d'année, check semaine ~52
        if (sorted[i].year === prevYear - 1 && sorted[i].week_number >= 51) {
          checkinStreak++
          prevWeek = sorted[i].week_number
          prevYear = sorted[i].year
        } else break
      } else break
    }
  }

  // ── Derniers check-ins (what_worked, difficulties) ──────────────
  const lastCheckins = checkins && checkins.length > 0
    ? [...checkins].reverse().slice(0, 2).map((c) => ({
        week: c.week_number,
        year: c.year,
        weather: c.weather as string,
        what_worked: (c as Record<string, unknown>).what_worked as string | null,
        difficulties: (c as Record<string, unknown>).difficulties as string | null,
      }))
    : []

  // ── Feedback (likes + commentaires) ─────────────────────────────
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

  // ── Météo count ─────────────────────────────────────────────────
  const weatherCount = {
    sunny:  (checkins ?? []).filter((c) => c.weather === 'sunny').length,
    cloudy: (checkins ?? []).filter((c) => c.weather === 'cloudy').length,
    stormy: (checkins ?? []).filter((c) => c.weather === 'stormy').length,
  }

  return (
    <div className="space-y-4 pb-20">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={`/trainer/groups/${groupId}`}
          className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
        >
          <ChevronLeft size={16} />
          <span className="truncate max-w-[120px]">{groupName}</span>
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-semibold truncate">{profile.first_name} {profile.last_name}</span>
      </div>

      {/* Carousel navigation */}
      <LearnerNav
        prevUrl={prevUrl}
        nextUrl={nextUrl}
        currentIndex={currentIndex >= 0 ? currentIndex : 0}
        total={learnersInGroup.length}
        allUrls={allUrls}
      >
      <div className="space-y-4">

      {/* ── Header gradient ──────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-4 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 40%, #818cf8 100%)',
          boxShadow: '0 8px 30px rgba(67, 56, 202, 0.3)',
        }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-10 -left-6 w-24 h-24 rounded-full bg-white/5" />

        <div className="relative flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Avatar large */}
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))', border: '2px solid rgba(255,255,255,0.3)' }}>
              {profile.first_name[0]}{profile.last_name[0]}
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">{profile.first_name} {profile.last_name}</h1>
              <p className="text-xs text-indigo-200 mt-0.5">
                Inscrit le {new Date(profile.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          {weatherEmoji && <span className="text-3xl drop-shadow-lg">{weatherEmoji}</span>}
        </div>

        {/* 3 KPIs: actions semaine / régularité / streak */}
        <div className="relative grid grid-cols-3 gap-2">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className={`text-2xl font-black ${actionsThisWeek > 0 ? 'text-emerald-300' : 'text-white/40'}`}>
              {actionsThisWeek > 0 ? `+${actionsThisWeek}` : '0'}
            </div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">cette semaine</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className="text-2xl font-black text-white">{regularityPct}%</div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">régularité</p>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl py-2.5 px-2 text-center">
            <div className={`text-2xl font-black ${checkinStreak >= 3 ? 'text-amber-300' : 'text-white'}`}>
              {checkinStreak > 0 ? `${checkinStreak}🔥` : '0'}
            </div>
            <p className="text-[10px] text-indigo-200 mt-0.5 leading-tight">check-ins d&apos;affilée</p>
          </div>
        </div>
      </div>

      {/* ── Axes de progrès ──────────────────────────────────────────── */}
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

      {/* ── Historique météo ─────────────────────────────────────────── */}
      {checkins && checkins.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-bold text-gray-800 text-base mb-3">🌤 Historique météo</h2>

          {/* Résumé 3 blocs */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {(['sunny', 'cloudy', 'stormy'] as const).map((w) => (
              <div key={w} className={`rounded-lg p-3 text-center ${WEATHER_COLORS[w]}`}>
                <p className="text-2xl">{WEATHER_ICONS[w]}</p>
                <p className="font-bold text-lg mt-0.5">{weatherCount[w]}</p>
                <p className="text-xs mt-0.5">
                  {checkins.length > 0 ? `${Math.round((weatherCount[w] / checkins.length) * 100)}%` : '0%'}
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
                {WEATHER_ICONS[ci.weather as string]} S{ci.week_number}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Derniers check-ins ───────────────────────────────────────── */}
      {lastCheckins.length > 0 && (lastCheckins[0].what_worked || lastCheckins[0].difficulties) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h2 className="font-bold text-gray-800 text-base mb-3">📋 Derniers check-ins</h2>
          <div className="space-y-3">
            {lastCheckins[0].what_worked && (
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-xs font-semibold text-emerald-700 mb-1">✓ Ce qui a marché</p>
                <p className="text-sm text-emerald-900 leading-relaxed">{lastCheckins[0].what_worked}</p>
              </div>
            )}
            {lastCheckins[0].difficulties && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-xs font-semibold text-red-700 mb-1">△ Difficultés</p>
                <p className="text-sm text-red-900 leading-relaxed">{lastCheckins[0].difficulties}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* État vide */}
      {(!checkins || checkins.length === 0) && (!axes || axes.length === 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-10">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-gray-500 font-medium">Ce participant n&apos;a pas encore commencé.</p>
          <p className="text-gray-500 text-sm mt-1">Aucun axe ni check-in enregistré.</p>
        </div>
      )}

      </div>{/* end space-y-4 inner */}
      </LearnerNav>

      {/* FAB message */}
      <div className="fixed bottom-4 left-0 right-0 z-10 px-4">
        <div className="max-w-lg mx-auto">
          <Link
            href={`/trainer/messages?with=${params.id}`}
            className="flex items-center justify-center gap-2 w-full py-3 text-white text-sm font-semibold rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)', boxShadow: '0 4px 20px rgba(79,70,229,0.4)' }}
          >
            <MessageCircle size={16} />
            Envoyer un message à {profile.first_name}
          </Link>
        </div>
      </div>
    </div>
  )
}
