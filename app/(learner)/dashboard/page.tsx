export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCurrentWeek, formatWeek } from '@/lib/utils'
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
  if (count === 0) return { label: 'Ancrage',     icon: '📍', color: 'text-gray-400   bg-gray-50   border-gray-200'   }
  if (count <= 2) return { label: 'Impulsion',   icon: '👣', color: 'text-teal-700   bg-teal-50   border-teal-200'   }
  if (count <= 5) return { label: 'Rythme',      icon: '🥁', color: 'text-blue-700   bg-blue-50   border-blue-200'   }
  if (count <= 8) return { label: 'Intensité',   icon: '🔥', color: 'text-orange-700 bg-orange-50 border-orange-200' }
  return               { label: 'Propulsion',  icon: '🚀', color: 'text-purple-700 bg-purple-50 border-purple-200' }
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

  // Semaines écoulées depuis l'inscription (minimum 1)
  const weeksSinceStart = profile?.created_at
    ? Math.max(1, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1)
    : 1

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
        <div className="rounded-xl p-4 flex items-center gap-4 bg-amber-50 border border-amber-100">
          <AlertCircle className="text-amber-500 shrink-0" size={24} />
          <div className="flex-1">
            <p className="font-medium text-amber-800">Check-in de la semaine en attente</p>
            <p className="text-sm text-amber-600">Prenez 2 minutes pour faire le point</p>
          </div>
          <Link href="/checkin" className="btn-primary shrink-0">Faire</Link>
        </div>
      )}

      {/* Badges stats */}
      <div className="grid grid-cols-3 gap-3">
        <Link href="/axes" className="card text-center py-4 px-2 hover:border-indigo-200 hover:bg-indigo-50/50 transition-colors">
          <Target className="mx-auto text-indigo-500 mb-1.5" size={20} />
          <p className="text-2xl font-bold text-gray-900 leading-none">
            {axes?.length ?? 0}
            <span className="text-sm font-normal text-gray-400">/3</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Axes définis</p>
        </Link>
        <Link href="/axes" className="card text-center py-4 px-2 hover:border-amber-200 hover:bg-amber-50/50 transition-colors">
          <Zap className="mx-auto text-amber-500 mb-1.5" size={20} />
          <p className="text-2xl font-bold text-gray-900 leading-none">{totalCompletedActions}</p>
          <p className="text-xs text-gray-500 mt-1">Actions menées</p>
        </Link>
        <Link href="/history" className="card text-center py-4 px-2 hover:border-emerald-200 hover:bg-emerald-50/50 transition-colors">
          <CalendarCheck className="mx-auto text-emerald-500 mb-1.5" size={20} />
          <p className="text-2xl font-bold text-gray-900 leading-none">
            {totalCheckins}
            <span className="text-sm font-normal text-gray-400">/{weeksSinceStart}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">Check-ins</p>
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
              const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
              const nextMonday = new Date(today)
              nextMonday.setDate(today.getDate() + daysUntilMonday)
              return (
                <p className="text-sm text-gray-500 mb-3">
                  ✅ Check-in de cette semaine effectué — Prochain : <span className="font-medium text-gray-700">{nextMonday.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
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
