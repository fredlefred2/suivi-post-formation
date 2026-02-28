import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatWeek, formatDate } from '@/lib/utils'
import {
  WEATHER_LABELS,
  WEATHER_COLORS,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
} from '@/lib/types'
import LearnerChart from './LearnerChart'
import LearnerNav from './LearnerNav'

// ── Médaille selon le nombre d'actions (identique à AxesClient) ─────────────
function getMedal(count: number) {
  if (count === 0) return null
  if (count <= 2) return { label: 'Bronze',  icon: '🥉', color: 'text-amber-700  bg-amber-50  border-amber-200'  }
  if (count <= 5) return { label: 'Argent',  icon: '🥈', color: 'text-slate-600  bg-slate-50  border-slate-200'  }
  if (count <= 8) return { label: 'Or',      icon: '🥇', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' }
  return               { label: 'Platine',  icon: '🏅', color: 'text-purple-700 bg-purple-50 border-purple-200' }
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

  // ── Carousel : liste ordonnée des apprenants du groupe ────────────────────
  type LearnerEntry = { id: string; name: string }
  let learnersInGroup: LearnerEntry[] = []
  let currentIndex = -1

  const groupId = searchParams.group && searchParams.group !== 'all' && searchParams.group !== 'unassigned'
    ? searchParams.group
    : null

  if (groupId) {
    const { data: gMembers } = await supabase
      .from('group_members')
      .select('learner_id, profiles!inner(first_name, last_name)')
      .eq('group_id', groupId)

    learnersInGroup = (gMembers ?? [])
      .map((m) => {
        const p = m.profiles as { first_name: string; last_name: string }
        return { id: m.learner_id, name: `${p.first_name} ${p.last_name}` }
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))

    currentIndex = learnersInGroup.findIndex((l) => l.id === params.id)
  }

  const prevLearner = currentIndex > 0 ? learnersInGroup[currentIndex - 1] : null
  const nextLearner = currentIndex >= 0 && currentIndex < learnersInGroup.length - 1
    ? learnersInGroup[currentIndex + 1]
    : null

  function buildLearnerUrl(learnerId: string) {
    const qs = new URLSearchParams()
    if (groupId) qs.set('group', groupId)
    if (searchParams.from) qs.set('from', searchParams.from)
    return `/trainer/learner/${learnerId}?${qs.toString()}`
  }

  const prevUrl = prevLearner ? buildLearnerUrl(prevLearner.id) : null
  const nextUrl = nextLearner ? buildLearnerUrl(nextLearner.id) : null

  // ── Lien retour ───────────────────────────────────────────────────────────
  const backHref =
    searchParams.from === 'apprenants'
      ? groupId
        ? `/trainer/apprenants?group=${groupId}`
        : '/trainer/apprenants'
      : groupId
      ? `/trainer/groups/${groupId}`
      : '/trainer/groups'

  // ── Stats globales ────────────────────────────────────────────────────────
  const totalActions = (axes ?? []).reduce((sum, a) => sum + (a.actions as ActionRow[]).length, 0)
  const axesWithMedal = (axes ?? []).filter((a) => getMedal((a.actions as ActionRow[]).length))

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
        ← Retour
      </Link>

      {/* ── Carousel + contenu ──────────────────────────────────────────────── */}
      <LearnerNav
        prevUrl={prevUrl}
        nextUrl={nextUrl}
        currentIndex={currentIndex}
        total={learnersInGroup.length}
        prevName={prevLearner?.name}
        nextName={nextLearner?.name}
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
          <span className="inline-flex items-center gap-1 text-xs bg-sky-50 text-sky-700 border border-sky-100 px-2.5 py-1 rounded-full font-medium">
            📅 {(checkins ?? []).length} check-in{(checkins ?? []).length > 1 ? 's' : ''}
          </span>
          {axesWithMedal.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full font-medium">
              🏅 {axesWithMedal.length} médaille{axesWithMedal.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* ── Médailles ───────────────────────────────────────────────────────── */}
      {axes && axes.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-4">🏅 Récompenses</h2>
          <div className={`grid gap-3 ${axes.length === 1 ? 'grid-cols-1' : axes.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {axes.map((axe) => {
              const actionsCount = (axe.actions as ActionRow[]).length
              const medal = getMedal(actionsCount)
              return (
                <div
                  key={axe.id}
                  className={`rounded-xl border p-3 text-center ${
                    medal ? medal.color : 'bg-gray-50 border-gray-200 text-gray-400'
                  }`}
                >
                  <span className="text-3xl">{medal ? medal.icon : '🎖️'}</span>
                  <p className="font-semibold text-sm mt-1.5">{medal ? medal.label : 'À gagner'}</p>
                  <p className="text-xs mt-0.5 leading-snug line-clamp-2 opacity-80">{axe.subject}</p>
                  <p className="text-xs mt-1 font-medium">
                    {actionsCount} action{actionsCount > 1 ? 's' : ''}
                  </p>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-3 text-center">
            🥉 Bronze ≤ 2 &nbsp;·&nbsp; 🥈 Argent ≤ 5 &nbsp;·&nbsp; 🥇 Or ≤ 8 &nbsp;·&nbsp; 🏅 Platine &gt; 8
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

      {/* ── Axes de progrès + actions ────────────────────────────────────────── */}
      {axes && axes.length > 0 && (
        <div className="space-y-4">
          <h2 className="section-title">🎯 Axes de progrès</h2>
          {axes.map((axe) => {
            const actions = (axe.actions as ActionRow[]).sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
            const medal = getMedal(actions.length)

            return (
              <div key={axe.id} className="card">
                {/* En-tête axe */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-base">{axe.subject}</h3>
                    {axe.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{axe.description}</p>
                    )}
                    <span
                      className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mt-1.5 ${
                        DIFFICULTY_COLORS[axe.difficulty as keyof typeof DIFFICULTY_COLORS]
                      }`}
                    >
                      {DIFFICULTY_LABELS[axe.difficulty as keyof typeof DIFFICULTY_LABELS]}
                    </span>
                  </div>
                  {/* Médaille */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold shrink-0 ${
                      medal ? medal.color : 'bg-gray-50 border-gray-200 text-gray-400'
                    }`}
                  >
                    <span className="text-base leading-none">{medal ? medal.icon : '🎖️'}</span>
                    <span>{medal ? medal.label : 'À gagner'}</span>
                  </div>
                </div>

                {/* Liste des actions */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Actions menées
                    <span className="ml-1.5 text-xs font-normal text-gray-400">({actions.length})</span>
                  </p>
                  {actions.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">Aucune action enregistrée</p>
                  ) : (
                    <ul className="space-y-2">
                      {actions.map((action) => (
                        <li key={action.id} className="flex items-start gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 mt-[7px]" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700">{action.description}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{shortDate(action.created_at)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })}
        </div>
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
