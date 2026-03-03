export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, formatWeek, expectedCheckins } from '@/lib/utils'
import { WEATHER_LABELS, DIFFICULTY_LABELS, DIFFICULTY_COLORS } from '@/lib/types'
import { AlertCircle, Target, Zap, CalendarCheck } from 'lucide-react'
import type { Difficulty } from '@/lib/types'
import AxesCarousel from './AxesCarousel'

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}

// Calcul de la dynamique d'action selon le nombre d'actions menées
function getDynamique(count: number) {
  if (count === 0) return { label: 'Ancrage',     icon: '📍', color: 'text-gray-500   bg-gray-100  border-gray-300'   }
  if (count <= 2) return { label: 'Impulsion',   icon: '👣', color: 'text-teal-800   bg-teal-100  border-teal-300'   }
  if (count <= 5) return { label: 'Rythme',      icon: '🥁', color: 'text-blue-800   bg-blue-100  border-blue-300'   }
  if (count <= 8) return { label: 'Intensité',   icon: '🔥', color: 'text-orange-800 bg-orange-100 border-orange-300' }
  return               { label: 'Propulsion',  icon: '🚀', color: 'text-purple-800 bg-purple-100 border-purple-300' }
}

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
      .select('id, subject, difficulty, actions(id)')
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

  // Nombre de check-ins attendus (basé sur le 2e vendredi après inscription)
  const expected = profile?.created_at ? expectedCheckins(profile.created_at) : 0

  // Total actions menées — toutes les actions sont considérées comme menées
  const totalCompletedActions = axes?.reduce((acc, axe) => {
    return acc + ((axe.actions as { id: string }[])?.length ?? 0)
  }, 0) ?? 0

  return (
    <div className="space-y-6 pb-4">

      {/* En-tête */}
      <div>
        <h1 className="page-title">Bonjour {profile?.first_name} 👋</h1>
        <p className="text-sm text-gray-500 mt-1">{formatWeek(week, year)}</p>
      </div>

      {/* Alerte check-in (uniquement si non réalisé) */}
      {!checkinDone && (
        <div className="rounded-xl p-4 flex items-center gap-4 bg-amber-100 border border-amber-300">
          <AlertCircle className="text-amber-600 shrink-0" size={24} />
          <div className="flex-1">
            <p className="font-medium text-amber-900">Check-in de la semaine en attente</p>
            <p className="text-sm text-amber-700">Prenez 2 minutes pour faire le point</p>
          </div>
          <Link href="/checkin" className="btn-primary shrink-0">Faire</Link>
        </div>
      )}

      {/* Badges stats */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/axes" className="card text-center py-4 px-2 hover:border-indigo-300 hover:bg-indigo-100/60 transition-colors">
          <Target className="mx-auto text-indigo-600 mb-1.5" size={20} />
          <p className="text-2xl font-bold text-indigo-700 leading-none">
            {axes?.length ?? 0}
            <span className="text-sm font-normal text-gray-400">/3</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">Axes définis</p>
        </Link>
        <Link href="/axes" className="card text-center py-4 px-2 hover:border-amber-300 hover:bg-amber-100/60 transition-colors">
          <Zap className="mx-auto text-amber-600 mb-1.5" size={20} />
          <p className="text-2xl font-bold text-amber-700 leading-none">{totalCompletedActions}</p>
          <p className="text-xs text-gray-600 mt-1">Actions menées</p>
        </Link>
        <Link href="/history" className="card text-center py-4 px-2 hover:border-emerald-300 hover:bg-emerald-100/60 transition-colors">
          <CalendarCheck className="mx-auto text-emerald-600 mb-1.5" size={20} />
          <p className="text-2xl font-bold text-emerald-700 leading-none">
            {totalCheckins}
            {expected > 0 && <span className="text-sm font-normal text-gray-400">/{expected}</span>}
          </p>
          <p className="text-xs text-gray-600 mt-1">Check-ins</p>
        </Link>
      </div>

      {/* Axes de progrès */}
      {!axes || axes.length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-gray-500 text-sm mb-3">
            Vous n&apos;avez pas encore défini vos axes de progrès
          </p>
          <Link href="/axes" className="btn-primary">Définir mes 3 axes</Link>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Mes actions de progrès</h2>
            {axes.length < 3 && (
              <Link href="/axes" className="text-sm text-indigo-600 hover:underline">
                + Ajouter
              </Link>
            )}
          </div>

          <AxesCarousel
            axes={axes.map((axe, index) => ({
              id: axe.id,
              index,
              subject: axe.subject,
              completedCount: ((axe.actions as { id: string }[]) ?? []).length,
              dyn: getDynamique(((axe.actions as { id: string }[]) ?? []).length),
            }))}
          />
        </div>
      )}

      {/* Historique des check-ins */}
      {allCheckins && allCheckins.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Mes check-ins</h2>
            <Link href="/history" className="text-sm text-indigo-600 hover:underline">
              Voir tout
            </Link>
          </div>
          <div className="card p-4">
            {checkinDone && (() => {
              const today = new Date()
              const dayOfWeek = today.getDay()
              const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7
              const nextFriday = new Date(today)
              nextFriday.setDate(today.getDate() + daysUntilFriday)
              return (
                <p className="text-sm text-gray-500 mb-3">
                  ✅ Check-in de cette semaine effectué — Prochain : <span className="font-medium text-gray-700">{nextFriday.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </p>
              )
            })()}
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
              {allCheckins.map((checkin) => (
                <div key={checkin.id} className="flex flex-col items-center gap-1 shrink-0">
                  <span className="text-2xl leading-none">
                    {WEATHER_ICONS[checkin.weather as string] ?? '❓'}
                  </span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {new Date(checkin.created_at as string).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
