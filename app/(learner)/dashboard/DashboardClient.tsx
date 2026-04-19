'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { useCountUp } from '@/lib/useCountUp'
import QuickAddAction from '@/app/components/QuickAddAction'
import QuickCheckin from '@/app/components/QuickCheckin'
import { TipProvider } from '@/app/components/WeeklyChallenge'
import DashboardIcons from '@/app/components/DashboardIcons'
import OpenAppPrompt from '@/app/components/OpenAppPrompt'
import AxeRing from '@/app/components/AxeRing'
import { CheckinHistoryModal, CoachHistoryModal } from '@/app/components/HistoryModals'
import { useOnboarding } from '@/lib/onboarding-context'
import { getNextLevel } from '@/lib/axeHelpers'
import { useRouter } from 'next/navigation'

type AxeItem = {
  id: string
  index: number
  subject: string
  description: string | null
  completedCount: number
  dyn: { label: string; icon: string; color: string; delta: number }
  likesCount: number
  commentsCount: number
  lastAction: { description: string; date: string } | null
}

type InitialTip = {
  id: string
  content: string
  advice: string | null
  example: string | null
  axe_subject?: string
} | null

type Props = {
  firstName: string
  checkinDone: boolean
  checkinWeekLabel: string
  totalCheckins: number
  totalActions: number
  deltaActionsThisWeek: number
  weatherHistory: string[]
  axesCount: number
  axes: AxeItem[]
  stepsData: { label: string; done: boolean }[]
  streak: number
  rank: number | null
  groupSize: number | null
  lastWeekActions: number
  checkinIsOpen: boolean
  axesForCheckin: { id: string; initial_score: number }[]
  groupTheme: string | null
  // Données orchestrateur précalculées server-side (zéro latence client)
  initialTip: InitialTip
  initialMessagesUnread: number
  initialLastAction: { daysSince: number; isStale: boolean } | null
  initialDismissals: Record<string, string>
}

export default function DashboardClient({
  firstName,
  checkinDone,
  checkinWeekLabel,
  totalCheckins,
  totalActions,
  deltaActionsThisWeek,
  weatherHistory,
  axesCount,
  axes,
  stepsData,
  streak,
  rank,
  groupSize,
  lastWeekActions,
  checkinIsOpen,
  axesForCheckin,
  groupTheme,
  initialTip,
  initialMessagesUnread,
  initialLastAction,
  initialDismissals,
  onboardingStep,
}: Props & { onboardingStep?: string }) {
  const router = useRouter()
  const { isOnboarding } = useOnboarding()
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickCheckinOpen, setQuickCheckinOpen] = useState(false)
  const [tipAvailable, setTipAvailable] = useState(!!initialTip)
  const [forceCoach, setForceCoach] = useState(false)
  const [messagesUnread, setMessagesUnread] = useState(initialMessagesUnread)
  const [checkinHistoryOpen, setCheckinHistoryOpen] = useState(false)
  const [coachHistoryOpen, setCoachHistoryOpen] = useState(false)

  // Rafraîchit le compteur de messages non lus quand l'utilisateur les lit
  // (event émis par MessagesClient) — le 1er chargement vient déjà des props
  useEffect(() => {
    const fetchUnread = () => {
      fetch('/api/messages/unread')
        .then(r => r.ok ? r.json() : { count: 0 })
        .then(data => setMessagesUnread(data?.count ?? 0))
        .catch(() => {})
    }
    const handleRead = () => fetchUnread()
    window.addEventListener('messages-read', handleRead)
    return () => window.removeEventListener('messages-read', handleRead)
  }, [])

  // Compteurs animes
  const animatedActions = useCountUp(totalActions)
  const animatedDelta = useCountUp(deltaActionsThisWeek)

  // Barre de progression onboarding
  const doneCount = stepsData.filter((s) => s.done).length
  const pct = Math.round((doneCount / stepsData.length) * 100)

  // ── Salutation dynamique + date du jour (client-only pour éviter mismatch SSR) ──
  const [greeting, setGreeting] = useState<string | null>(null)
  const [todayLabel, setTodayLabel] = useState<string | null>(null)
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'Bon matin' : h >= 18 ? 'Bonsoir' : 'Hello')
    const d = new Date()
    const days = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
    const months = ['janv.', 'févr.', 'mars', 'avril', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
    setTodayLabel(`${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`)
  }, [])

  // ── Météo du dernier check-in (emoji à côté du prénom) ──
  const lastWeather = weatherHistory.length > 0 ? weatherHistory[weatherHistory.length - 1] : null
  const weatherEmoji = lastWeather === 'sunny' ? '☀️'
    : lastWeather === 'cloudy' ? '⛅'
    : lastWeather === 'stormy' ? '⛈️' : ''

  // ── Phrase de contexte dynamique ────────────────────────────────
  // Priorités : rang 1 > streak >= 3 > proche d'un level-up > neutre
  const contextPhrase = (() => {
    // 1. Rang 1 dans un groupe > 1 personne
    if (rank === 1 && groupSize && groupSize > 1 && totalActions > 0) {
      return (<><span className="text-base leading-none">🏆</span> Tu es <strong>1er</strong> de ton groupe cette semaine, bravo&nbsp;!</>)
    }
    // 2. Streak >= 3 (3 semaines consécutives de check-in)
    if (streak >= 3) {
      return (<><span className="text-base leading-none">🔥</span> <strong>{streak} semaines</strong> consécutives de check-in — régularité&nbsp;!</>)
    }
    // 3. Axe le plus proche d'un level-up (delta ≤ 2)
    const closestAxe = axes
      .map(a => ({ axe: a, next: getNextLevel(a.completedCount) }))
      .filter(x => x.next && x.next.delta <= 2 && x.next.delta > 0)
      .sort((a, b) => a.next!.delta - b.next!.delta)[0]
    if (closestAxe) {
      const n = closestAxe.next!
      return (<><span className="text-base leading-none">💪</span> Encore <strong>{n.delta} action{n.delta > 1 ? 's' : ''}</strong> pour passer à {n.icon} sur <em className="not-italic font-bold">{closestAxe.axe.subject}</em></>)
    }
    // 4. Neutre
    return axes.length > 0
      ? (<>Prêt à noter une action aujourd&apos;hui&nbsp;?</>)
      : null
  })()

  // ── Détection si une des 4 icônes "À faire" a une action (halo) ──
  const hasPendingTask = (checkinIsOpen && !checkinDone) || tipAvailable || messagesUnread > 0


  return (
    <TipProvider>
      <div className="space-y-3 pb-20 sm:pb-4 dash-watermark">

        {/* ── 1. Header navy dégradé (v1.29.3) ── */}
        <div
          className="rounded-[22px] px-[18px] py-[14px] relative overflow-hidden"
          data-onboarding="checkin-area"
          style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}
        >
          {/* Cercle décoratif amber */}
          <div className="absolute -top-4 -right-3 w-[70px] h-[70px] rounded-full" style={{ background: 'rgba(251,191,36,0.14)' }} />

          <div className="relative">
            <h1 className="text-[16px] font-extrabold text-white leading-tight">
              {greeting ?? 'Salut'} {firstName} 👋
              {weatherEmoji && <span className="ml-1.5 text-[14px]" aria-hidden>{weatherEmoji}</span>}
            </h1>
            <p className="text-[12px] mt-1 font-semibold flex items-center flex-wrap gap-x-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
              💪 <span style={{ color: '#fbbf24' }} className="font-extrabold">{animatedActions}</span> actions
              <span style={{ color: 'rgba(255,255,255,0.3)' }}> · </span>
              {deltaActionsThisWeek >= 0 ? (
                <>
                  <span style={{ color: deltaActionsThisWeek > 0 ? '#fbbf24' : 'rgba(255,255,255,0.7)' }} className="font-extrabold">
                    {deltaActionsThisWeek > 0 ? `+${animatedDelta}` : '0'}
                  </span>
                  <span>cette sem.</span>
                </>
              ) : null}
              {rank && rank <= 3 && groupSize && groupSize > 1 && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}> · </span>
                  🏆 <span style={{ color: '#fbbf24' }} className="font-extrabold">
                    {rank === 1 ? '1er' : rank === 2 ? '2e' : '3e'}
                  </span>
                </>
              )}
            </p>

            {/* Phrase de contexte dynamique (v1.29.3) — masquée pendant l'onboarding */}
            {contextPhrase && !isOnboarding && (
              <div
                className="mt-2.5 px-2.5 py-1.5 rounded-xl text-[12px] leading-[1.4] flex items-center gap-1.5"
                style={{
                  background: 'rgba(251,191,36,0.14)',
                  border: '1px solid rgba(251,191,36,0.25)',
                  color: '#fef3c7',
                }}
              >
                <span className="[&_strong]:text-[#fbbf24] [&_strong]:font-extrabold [&_em]:text-white">{contextPhrase}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── 2. Carte "À faire aujourd'hui" (dégradé warm + date + halo) ── */}
        {axes.length > 0 && (
          <div
            className={`rounded-[22px] px-3 py-3.5 ${hasPendingTask ? 'tasks-card-halo' : ''}`}
            data-onboarding="tasks-card"
            style={{
              background: 'linear-gradient(180deg, #ffffff 0%, #fffbf0 100%)',
              border: '2px solid #f0ebe0',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[11px] font-extrabold tracking-wider uppercase pl-1 flex items-center gap-1.5" style={{ color: '#1a1a2e' }}>
                <span>⚡</span> À faire aujourd&apos;hui
              </p>
              {todayLabel && (
                <span className="text-[10px] font-semibold pr-1" style={{ color: '#a0937c' }}>{todayLabel}</span>
              )}
            </div>
            <DashboardIcons
              axes={axes.map(a => ({ id: a.id, completedCount: a.completedCount }))}
              streak={streak}
              checkinAvailable={checkinIsOpen}
              checkinDone={checkinDone}
              tipAvailable={tipAvailable}
              messagesUnread={messagesUnread}
              onAction={() => setQuickAddOpen(true)}
              onCheckin={() => {
                // Si check-in neuf à faire → formulaire ; sinon → historique
                if (checkinIsOpen && !checkinDone) setQuickCheckinOpen(true)
                else setCheckinHistoryOpen(true)
              }}
              onCoach={() => {
                // Si nouveau tip → fenêtre cadeau ; sinon → historique
                if (tipAvailable) setForceCoach(true)
                else setCoachHistoryOpen(true)
              }}
              onMessages={() => window.dispatchEvent(new Event('open-messages'))}
            />
          </div>
        )}

        {/* Barre de progression onboarding */}
        {pct < 100 && (
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold" style={{ color: '#1a1a2e' }}>Votre onboarding</p>
              <span className="text-xs font-bold" style={{ color: '#1a1a2e' }}>{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: '#f5f0e8' }}>
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${pct}%`,
                background: '#fbbf24',
              }} />
            </div>
            <div className="flex gap-3 mt-2">
              {stepsData.map((s, i) => (
                <span key={i} className={`text-[11px] ${s.done ? 'font-semibold' : ''}`} style={{ color: s.done ? '#059669' : '#a0937c' }}>
                  {s.done ? '✓' : '○'} {s.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Empty state ── */}
        {axes.length === 0 && totalActions === 0 && (
          <Link href="/axes" className="card p-5 text-center hover:shadow-warm-hover transition-shadow" style={{ border: '2px dashed #f0ebe0' }}>
            <p className="text-2xl mb-2">👣</p>
            <p className="text-sm font-bold" style={{ color: '#1a1a2e' }}>Commence ton parcours !</p>
            <p className="text-xs mt-1" style={{ color: '#a0937c' }}>Crée ton premier axe de progrès</p>
          </Link>
        )}

        {/* ── 3. Mes axes (format hybride : cercle + texte) ── */}
        {axes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Mes axes</h2>
              {axesCount < 3 && (
                <Link href="/axes" className="text-xs font-bold hover:underline" style={{ color: '#92400e' }}>
                  + Ajouter
                </Link>
              )}
            </div>

            {axes.map((axe) => (
              <AxeRing
                key={axe.id}
                axeId={axe.id}
                axeIndex={axe.index}
                subject={axe.subject}
                completedCount={axe.completedCount}
                likesCount={axe.likesCount}
                commentsCount={axe.commentsCount}
              />
            ))}
          </div>
        )}

        {/* Quick Add Action Modal */}
        <QuickAddAction
          axes={axes.map(a => ({ id: a.id, subject: a.subject, description: a.description, completedCount: a.completedCount }))}
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onSuccess={() => router.refresh()}
          groupTheme={groupTheme}
        />

        {/* Quick Checkin Modal */}
        <QuickCheckin
          axes={axesForCheckin}
          weekLabel={checkinWeekLabel}
          streak={streak}
          open={quickCheckinOpen}
          onClose={() => setQuickCheckinOpen(false)}
          onSuccess={() => router.refresh()}
        />

        {/* Modale historique check-ins (si clic quand rien de neuf) */}
        <CheckinHistoryModal
          open={checkinHistoryOpen}
          onClose={() => setCheckinHistoryOpen(false)}
          isOffPeriod={!checkinIsOpen}
          streak={streak}
        />

        {/* Modale historique conseils coach (si clic quand rien de neuf) */}
        <CoachHistoryModal
          open={coachHistoryOpen}
          onClose={() => setCoachHistoryOpen(false)}
        />

        {/* Orchestrateur des fenêtres plein écran à l'ouverture.
            Supprimé pendant l'onboarding pour éviter que le check-in ou
            le tip coach ne pop par-dessus le tutoriel. */}
        {!isOnboarding && (
          <OpenAppPrompt
            firstName={firstName}
            checkinAvailable={checkinIsOpen}
            checkinDone={checkinDone}
            checkinWeekLabel={checkinWeekLabel}
            streak={streak}
            forceCoach={forceCoach}
            initialTip={initialTip}
            initialLastAction={initialLastAction}
            initialDismissals={initialDismissals}
            onOpenCheckin={() => setQuickCheckinOpen(true)}
            onOpenQuickAdd={() => setQuickAddOpen(true)}
            onTipRead={() => setTipAvailable(false)}
            onForceCoachConsumed={() => setForceCoach(false)}
          />
        )}
      </div>
    </TipProvider>
  )
}
