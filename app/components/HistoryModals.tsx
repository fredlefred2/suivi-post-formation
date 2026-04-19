'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
}

const WEATHER_EMOJI: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}
const WEATHER_LABEL: Record<string, string> = {
  sunny: 'Ça roule',
  cloudy: 'Mitigé',
  stormy: 'Difficile',
}

// ═══════════════════════════════════════════════════════════════
// Conteneur commun (même style que PromptModals)
// ═══════════════════════════════════════════════════════════════
function HistoryOverlay({
  title,
  gradient,
  onClose,
  children,
}: {
  title: string
  gradient: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col prompt-fade-in"
      style={{ background: gradient }}
    >
      <div className="flex items-center justify-between px-4 py-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))' }}>
        <div className="w-9" /> {/* spacer */}
        <p className="text-white font-bold text-[14px]">{title}</p>
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
        >
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {children}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// 1) CHECKIN HISTORY MODAL
// ═══════════════════════════════════════════════════════════════

type Checkin = {
  id: string
  week_number: number
  year: number
  weather: string
  what_worked: string | null
  difficulties: string | null
  created_at: string
}

type CheckinProps = Props & {
  isOffPeriod: boolean
  streak: number
}

export function CheckinHistoryModal({ open, onClose, isOffPeriod, streak }: CheckinProps) {
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch('/api/checkins/history')
      .then(r => r.ok ? r.json() : { checkins: [] })
      .then(data => setCheckins(data.checkins ?? []))
      .catch(() => setCheckins([]))
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const latest = checkins[0]
  const older = checkins.slice(1)
  const hasAny = checkins.length > 0

  return (
    <HistoryOverlay
      title="Mes check-ins"
      gradient="linear-gradient(180deg, #0f766e 0%, #134e4a 100%)"
      onClose={onClose}
    >
      {/* Bloc "prochain check-in" si hors période */}
      {isOffPeriod && (
        <div
          className="rounded-2xl p-4 mb-4 text-center text-white"
          style={{ background: 'rgba(251,191,36,0.15)', border: '1.5px solid rgba(251,191,36,0.35)' }}
        >
          <p className="text-[11px] font-extrabold tracking-wider uppercase mb-1" style={{ color: '#fbbf24' }}>
            ⏰ Prochain check-in
          </p>
          <p className="text-[14px] font-bold">Vendredi matin, tiens-toi prêt !</p>
          {streak >= 1 && (
            <p className="text-[12px] mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
              🔥 {streak} semaine{streak > 1 ? 's' : ''} d&apos;affilée en jeu
            </p>
          )}
        </div>
      )}

      {loading && (
        <p className="text-center text-white/50 text-sm py-10">Chargement...</p>
      )}

      {/* Empty state */}
      {!loading && !hasAny && !isOffPeriod && (
        <div className="text-center text-white py-10">
          <div className="text-5xl mb-3">📋</div>
          <p className="text-lg font-bold mb-1">Aucun check-in pour l&apos;instant</p>
          <p className="text-sm text-white/60">Ton premier check-in sera disponible vendredi matin</p>
        </div>
      )}

      {/* Dernier check-in */}
      {!loading && latest && (
        <div
          className="rounded-2xl p-4 mb-4 text-white"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          <p className="text-[10px] font-extrabold tracking-wider uppercase mb-2" style={{ color: '#fbbf24' }}>
            ✓ Dernier check-in
          </p>
          <div className="flex items-start gap-3">
            <span className="text-3xl" style={{ lineHeight: 1 }}>
              {WEATHER_EMOJI[latest.weather] ?? '❓'}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                Semaine {latest.week_number} · {formatDate(latest.created_at)}
              </p>
              <p className="text-[14px] font-extrabold">{WEATHER_LABEL[latest.weather] ?? latest.weather}</p>
              {latest.what_worked && (
                <p className="text-[12px] mt-2" style={{ color: '#86efac' }}>
                  ✓ {latest.what_worked}
                </p>
              )}
              {latest.difficulties && (
                <p className="text-[12px] mt-1" style={{ color: '#fca5a5' }}>
                  ⚠ {latest.difficulties}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Historique */}
      {!loading && older.length > 0 && (
        <>
          <p className="text-[10px] font-extrabold tracking-wider uppercase mb-2 px-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Historique
          </p>
          {older.map(ci => (
            <div
              key={ci.id}
              className="rounded-xl p-3 mb-2"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0" style={{ lineHeight: 1 }}>
                  {WEATHER_EMOJI[ci.weather] ?? '❓'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-white truncate">
                    {WEATHER_LABEL[ci.weather] ?? ci.weather}
                  </p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Semaine {ci.week_number} · {formatDate(ci.created_at)}
                  </p>
                </div>
              </div>
              {/* Réussites + difficultés si renseignées */}
              {(ci.what_worked || ci.difficulties) && (
                <div className="pl-10 mt-2 space-y-1">
                  {ci.what_worked && (
                    <p className="text-[11px] leading-relaxed" style={{ color: '#86efac' }}>
                      ✓ {ci.what_worked}
                    </p>
                  )}
                  {ci.difficulties && (
                    <p className="text-[11px] leading-relaxed" style={{ color: '#fca5a5' }}>
                      ⚠ {ci.difficulties}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </HistoryOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════
// 2) COACH HISTORY MODAL
// ═══════════════════════════════════════════════════════════════

type TipItem = {
  id: string
  content: string
  advice: string | null
  example?: string | null
  week_number: number
  acted: boolean
  sent?: boolean
  created_at?: string
  axe?: { subject: string } | { subject: string }[]
  axeSubject?: string
}

// Supabase peut renvoyer la relation en objet ou en array selon la config — on normalise
function normalizeAxeSubject(axe: TipItem['axe']): string | undefined {
  if (!axe) return undefined
  if (Array.isArray(axe)) return axe[0]?.subject
  return axe.subject
}

export function CoachHistoryModal({ open, onClose }: Props) {
  const [tips, setTips] = useState<TipItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    fetch('/api/tips/learner')
      .then(r => {
        if (!r.ok) throw new Error(`API ${r.status}`)
        return r.json()
      })
      .then(data => {
        // Ne garder que les tips envoyés (check permissif : true ou truthy)
        const raw = (data.tips ?? []) as TipItem[]
        const sent = raw
          .filter(t => t.sent !== false)  // garde true, undefined, null (plus permissif)
          .map(t => ({ ...t, axeSubject: normalizeAxeSubject(t.axe) }))
          .sort((a, b) => {
            // Trie par date de création (récent d'abord), sinon par week_number
            if (a.created_at && b.created_at) {
              return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            }
            return b.week_number - a.week_number
          })
        setTips(sent)
      })
      .catch(err => {
        console.error('[CoachHistoryModal] fetch error:', err)
        setError('Impossible de charger tes conseils')
        setTips([])
      })
      .finally(() => setLoading(false))
  }, [open])

  if (!open) return null

  const latest = tips[0]
  const older = tips.slice(1)

  return (
    <HistoryOverlay
      title="Mes conseils coach"
      gradient="linear-gradient(180deg, #1a1a2e 0%, #0f0f1e 100%)"
      onClose={onClose}
    >
      {loading && (
        <p className="text-center text-white/50 text-sm py-10">Chargement...</p>
      )}

      {/* Erreur de chargement */}
      {!loading && error && (
        <div className="text-center text-white py-10">
          <div className="text-4xl mb-3">⚠️</div>
          <p className="text-sm font-bold mb-1">{error}</p>
          <p className="text-xs text-white/50 px-6">
            Vérifie ta connexion et réessaie dans un instant
          </p>
        </div>
      )}

      {/* Empty state (aucun tip reçu) */}
      {!loading && !error && tips.length === 0 && (
        <div className="text-center text-white py-10">
          <div className="text-5xl mb-3">📬</div>
          <p className="text-lg font-bold mb-1">
            Premier conseil <span style={{ color: '#fbbf24' }}>mardi 8h</span>
          </p>
          <p className="text-sm text-white/60 px-6">
            Chaque mardi matin, ton coach t&apos;envoie un conseil personnalisé basé sur tes actions.
          </p>
        </div>
      )}

      {/* Dernier tip — mis en avant avec bloc "✓ Dernier conseil" */}
      {!loading && !error && latest && (
        <div className="mb-4">
          <p className="text-[10px] font-extrabold tracking-wider uppercase mb-2 px-1" style={{ color: '#fbbf24' }}>
            ✓ Dernier conseil
          </p>
          <TipCard tip={latest} />
        </div>
      )}

      {/* Historique */}
      {!loading && !error && older.length > 0 && (
        <>
          <p className="text-[10px] font-extrabold tracking-wider uppercase mb-2 px-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Historique ({older.length})
          </p>
          {older.map(tip => (
            <TipCard key={tip.id} tip={tip} compact />
          ))}
        </>
      )}
    </HistoryOverlay>
  )
}

// ═══════════════════════════════════════════════════════════════
// Tip card — gère le format NOUVEAU (mantra+action+example)
// et le format LEGACY (content+advice seuls, pas d'example)
// ═══════════════════════════════════════════════════════════════
function TipCard({ tip, compact = false }: { tip: TipItem; compact?: boolean }) {
  const isNewFormat = !!tip.example

  return (
    <div
      className="rounded-2xl p-4 mb-2 text-white relative"
      style={{
        background: isNewFormat ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        borderLeft: isNewFormat ? '3px solid #fbbf24' : '3px solid rgba(255,255,255,0.2)',
      }}
    >
      {tip.acted && (
        <span
          className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-extrabold"
          style={{ background: '#10b981', color: 'white' }}
          title="Lu"
        >
          ✓
        </span>
      )}

      {/* Méta (axe + semaine) */}
      <div className="flex items-center gap-2 mb-2 pr-6">
        {tip.axeSubject && (
          <span
            className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold"
            style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}
          >
            ✨ {tip.axeSubject}
          </span>
        )}
        <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Semaine {tip.week_number}
        </span>
      </div>

      {/* Mantra en italique avec guillemets amber (les deux formats l'affichent) */}
      <p
        className={`font-bold italic leading-snug ${compact ? 'text-[13px]' : 'text-[14.5px]'} mb-0`}
      >
        <span style={{ color: '#fbbf24' }}>«&nbsp;</span>
        {tip.content}
        <span style={{ color: '#fbbf24' }}>&nbsp;»</span>
      </p>

      {/* Nouveau format — action + exemple dans des sous-blocs */}
      {isNewFormat && tip.advice && (
        <div className="mt-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.85)' }}>
            <span
              className="font-extrabold uppercase mr-1"
              style={{ color: '#fbbf24', fontSize: 9, letterSpacing: '1px' }}
            >
              ⚡ Action
            </span>
            {tip.advice}
          </p>
          {tip.example && (
            <p
              className="text-[11px] leading-relaxed mt-2 pt-2 border-t"
              style={{ color: 'rgba(255,255,255,0.6)', borderColor: 'rgba(255,255,255,0.08)' }}
            >
              <span
                className="font-extrabold uppercase mr-1"
                style={{ color: 'rgba(255,255,255,0.45)', fontSize: 9, letterSpacing: '1px' }}
              >
                🎬 Exemple
              </span>
              {tip.example}
            </p>
          )}
        </div>
      )}

      {/* Ancien format — juste le conseil (advice) sous le content */}
      {!isNewFormat && tip.advice && (
        <p
          className="text-[12px] leading-relaxed p-3 rounded-xl mt-3"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}
        >
          <span
            className="font-extrabold uppercase mr-1"
            style={{ color: 'rgba(251,191,36,0.6)', fontSize: 9, letterSpacing: '1px' }}
          >
            Conseil
          </span>
          {tip.advice}
        </p>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso)
  const months = ['jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${d.getDate()} ${months[d.getMonth()]}`
}
