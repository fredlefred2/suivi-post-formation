export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { formatWeek, formatDate } from '@/lib/utils'
import {
  WEATHER_LABELS,
  WEATHER_COLORS,
} from '@/lib/types'
import type { ActionFeedbackData } from '@/lib/types'
import LearnerChart from './LearnerChart'
import LearnerNav from './LearnerNav'
import LearnerAxesSection from './LearnerAxesSection'

// ── Dynamique d'action selon le nombre d'actions ────────────────────────────
function getDynamique(count: number) {
  if (count === 0) return null
  if (count <= 2) return { label: 'Impulsion',   icon: '👣', color: 'text-teal-700   bg-teal-50   border-teal-200'   }
  if (count <= 5) return { label: 'Rythme',      icon: '🥁', color: 'text-blue-700   bg-blue-50   border-blue-200'   }
  if (count <= 8) return { label: 'Intensité',   icon: '🔥', color: 'text-orange-700 bg-orange-50 border-orange-200' }
  return               { label: 'Propulsion',  icon: '🚀', color: 'text-purple-700 bg-purple-50 border-purple-200' }
}

// Date courte ex. "3 juin 2024"
function shortDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

type ActionRow = { id: string; description: string; completed: boolean; created_at: string }
type ScoreRow  = { score: number; week_number: number; year: number }

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
    supabase.from('axes').select('*, actions(*), axis_scores(*)').eq('learner_id', params.id).order('created_at'),
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
  // Utiliser le groupe passé en paramètre, sinon le groupe de l'apprenant
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

  // ── Lien retour ───────────────────────────────────────────────────────────
  const backHref =
    searchParams.from === 'apprenants'
      ? '/trainer/dashboard'
      : groupId
      ? `/trainer/groups/${groupId}`
      : '/trainer/groups'

  // ── Actions de la semaine ───────────────────────────────────────────────────
  const now = new Date()
  const dayOfWeek = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  const allLearnerActions = (axes ?? []).flatMap((axe) => axe.actions as ActionRow[])
  const actionsThisWeek = allLearnerActions.filter((a) => {
    const d = new Date(a.created_at)
    return d >= monday && d <= sunday
  }).length

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

  // ── Stats globales ────────────────────────────────────────────────────────
  const totalActions = (axes ?? []).reduce((sum, a) => sum + (a.actions as ActionRow[]).length, 0)
  const axesEnAction = (axes ?? []).filter((a) => getDynamique((a.actions as ActionRow[]).length))

  // ── Données graphique ─────────────────────────────────────────────────────
  const chartData = (checkins ?? []).map((ci) => {
    const point: Record<string, unknown> = {
      label: `S${ci.week_number}`,
      week: ci.week_number,
      year: ci.year,
    }
    for (const axe of axes ?? []) {
      const score = (axe.axis_scores as ScoreRow[])
        ?.find((s) => s.week_number === ci.week_number && s.year === ci.year)
      if (score) point[axe.subject.substring(0, 15)] = score.score
    }
    return point
  })
  const axeNames = (axes ?? []).map((a) => a.subject.substring(0, 15))

  // ── Météo count pour résumé ───────────────────────────────────────────────
  const weatherCount = {
    sunny:  (checkins ?? []).filter((c) => c.weather === 'sunny').length,
    cloudy: (checkins ?? []).filter((c) => c.weather === 'cloudy').length,
    stormy: (checkins ?? []).filter((c) => c.weather === 'stormy').length,
  }
  const groupName = (membership.groups as unknown as { name: string })?.name

  return (
    <div className="space-y-6 pb-4">

      {/* ── Bouton retour ───────────────────────────────────────────────────── */}
      <Link href={backHref} className="text-sm text-indigo-600 hover:underline inline-block">
        ← {searchParams.from === 'apprenants' ? 'Tableau de bord' : 'Retour'}
      </Link>

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

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title">{profile.first_name} {profile.last_name}</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Groupe : <span className="font-medium text-gray-600">{groupName}</span>
              &nbsp;·&nbsp;Membre depuis le {shortDate(profile.created_at)}
            </p>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg flex items-center justify-center shrink-0">
            {profile.first_name[0]}{profile.last_name[0]}
          </div>
        </div>

        {/* Badges de synthèse */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-1 rounded-full font-medium">
            🎯 {(axes ?? []).length} axe{(axes ?? []).length > 1 ? 's' : ''}
          </span>
          <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-1 rounded-full font-medium">
            ⚡ {totalActions} action{totalActions > 1 ? 's' : ''}
          </span>
          {actionsThisWeek > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full font-semibold">
              +{actionsThisWeek} cette sem.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-50 text-gray-400 border border-gray-200 px-2.5 py-1 rounded-full">
              0 cette sem.
            </span>
          )}
          <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-1 rounded-full font-medium">
            📅 {(checkins ?? []).length} check-in{(checkins ?? []).length > 1 ? 's' : ''}
          </span>
          {axesEnAction.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full font-medium">
              🚀 {axesEnAction.length} axe{axesEnAction.length > 1 ? 's' : ''} en action
            </span>
          )}
        </div>
      </div>

      {/* ── Dynamique d'action ─────────────────────────────────────────────── */}
      {axes && axes.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">⚡ Dynamique d&apos;action</h2>
          <div className={`grid gap-3 ${axes.length === 1 ? 'grid-cols-1' : axes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {axes.map((axe) => {
              const actionsCount = (axe.actions as ActionRow[]).length
              const dyn = getDynamique(actionsCount)
              return (
                <div
                  key={axe.id}
                  className={`rounded-xl border p-3 text-center ${
                    dyn ? dyn.color : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <span className="text-3xl">{dyn ? dyn.icon : '📍'}</span>
                  <p className="font-semibold text-sm mt-1.5">{dyn ? dyn.label : 'Ancrage'}</p>
                  <p className="text-xs mt-0.5 leading-snug line-clamp-2 opacity-80">{axe.subject}</p>
                  <p className="text-xs mt-1 font-medium">
                    {actionsCount} action{actionsCount > 1 ? 's' : ''}
                  </p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            📍 Ancrage &nbsp;·&nbsp; 👣 Impulsion ≤ 2 &nbsp;·&nbsp; 🥁 Rythme ≤ 5 &nbsp;·&nbsp; 🔥 Intensité ≤ 8 &nbsp;·&nbsp; 🚀 Propulsion &gt; 8
          </p>
        </div>
      )}

      {/* ── Graphique d'évolution ────────────────────────────────────────────── */}
      {chartData.length > 1 && axeNames.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">📈 Évolution des scores</h2>
          <LearnerChart data={chartData} axeNames={axeNames} />
        </div>
      )}

      {/* ── Axes de progrès + actions (avec likes/commentaires) ──────────────── */}
      {axes && axes.length > 0 && (
        <LearnerAxesSection
          axes={(axes ?? []).map((axe) => ({
            id: axe.id,
            subject: axe.subject,
            description: axe.description,
            difficulty: axe.difficulty,
            actions: axe.actions as ActionRow[],
          }))}
          feedbackMap={feedbackMap}
        />
      )}

      {/* ── Historique météo ─────────────────────────────────────────────────── */}
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
          <div className="flex flex-wrap gap-1.5 mb-5">
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

          {/* Détail check-ins */}
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Détail des check-ins</h3>
          <div className="space-y-3">
            {[...checkins].reverse().map((ci) => (
              <div key={ci.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      WEATHER_COLORS[ci.weather as keyof typeof WEATHER_COLORS]
                    }`}
                  >
                    {WEATHER_LABELS[ci.weather as keyof typeof WEATHER_LABELS]}
                  </span>
                  <span className="text-xs text-gray-400">{formatWeek(ci.week_number, ci.year)}</span>
                </div>
                {ci.what_worked && (
                  <div className="mb-1.5">
                    <p className="text-xs font-medium text-emerald-700">✅ Ce qui a bien fonctionné</p>
                    <p className="text-sm text-gray-700 mt-0.5">{ci.what_worked}</p>
                  </div>
                )}
                {ci.difficulties && (
                  <div>
                    <p className="text-xs font-medium text-red-600">⚠️ Difficultés rencontrées</p>
                    <p className="text-sm text-gray-700 mt-0.5">{ci.difficulties}</p>
                  </div>
                )}
                {!ci.what_worked && !ci.difficulties && (
                  <p className="text-xs text-gray-400 italic">Aucune note ajoutée</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* État vide */}
      {(!checkins || checkins.length === 0) && (!axes || axes.length === 0) && (
        <div className="card text-center py-10">
          <p className="text-4xl mb-3">🌱</p>
          <p className="text-gray-500 font-medium">Cet apprenant n&apos;a pas encore commencé.</p>
          <p className="text-gray-400 text-sm mt-1">Aucun axe ni check-in enregistré pour le moment.</p>
        </div>
      )}

      </div>{/* end space-y-6 inner */}
      </LearnerNav>
    </div>
  )
}
