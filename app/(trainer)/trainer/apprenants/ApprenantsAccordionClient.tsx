'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown } from 'lucide-react'
import { getDynamique, getCurrentLevelIndex } from '@/lib/axeHelpers'
import type { ActionFeedbackData } from '@/lib/types'
import ActionFeedback from '@/app/components/ActionFeedback'
import { formatRelativeAge } from '@/lib/utils'
import ActivityGauge from '@/app/components/ui/ActivityGauge'

const WEATHER_ICONS: Record<string, string> = { sunny: '☀️', cloudy: '⛅', stormy: '⛈️' }
const LEVEL_DOT_BG: Record<number, string> = { 0: '#f1f5f9', 1: '#e0f2fe', 2: '#d1fae5', 3: '#ffedd5', 4: '#ffe4e6' }

function getDynamiqueForCount(count: number) {
  const dyn = getDynamique(count)
  return { icon: dyn.icon, level: getCurrentLevelIndex(count), label: dyn.label }
}

type ActionRow = { id: string; description: string; completed: boolean; created_at: string }
type CheckinRow = { id: string; learner_id: string; weather: string; week_number: number; year: number; created_at: string }

type TipData = {
  id: string
  week_number: number
  content: string
  advice: string | null
  sent: boolean
  acted: boolean
  read_at: string | null
}

type AxeData = {
  id: string
  index: number
  subject: string
  description: string | null
  difficulty: string
  actions: ActionRow[]
  tips: TipData[]
}

type LearnerCardData = {
  id: string
  firstName: string
  lastName: string
  createdAt: string
  totalActions: number
  actionsThisWeek: number
  totalCheckins: number
  expectedCheckins: number
  lastWeather: string | null
  weatherCount: { sunny: number; cloudy: number; stormy: number }
  checkins: CheckinRow[]
  axes: AxeData[]
  feedbackMap: Record<string, ActionFeedbackData>
  regularity: number
  checkinStreak: number
  gestes7d: number
  gestes14d: number
  gestesCumulative: number
  activityZone: 'red' | 'orange' | 'green'
}

type GroupInfo = { id: string; name: string; count: number }

type Props = {
  learners: LearnerCardData[]
  groups: GroupInfo[]
  currentGroupId: string
  initialIndex: number
}

export default function ApprenantsAccordionClient({
  learners,
  groups,
  currentGroupId,
  initialIndex,
}: Props) {
  const router = useRouter()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  // Track which axes show all actions (keyed by axeId)
  const [expandedAxeActions, setExpandedAxeActions] = useState<Set<string>>(new Set())
  // Track which axe shows tips tab instead of actions (keyed by axeId)
  const [axeTipsTab, setAxeTipsTab] = useState<Set<string>>(new Set())
  // Track tip editing state
  const [editingTipId, setEditingTipId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editAdvice, setEditAdvice] = useState('')
  const [tipLoading, setTipLoading] = useState<string | null>(null)
  const [addingTip, setAddingTip] = useState<string | null>(null) // axeId currently generating
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)
  const expandedRef = useRef<HTMLDivElement>(null)

  const selectedGroup = groups.find(g => g.id === currentGroupId)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [dropdownOpen])

  // Scroll to expanded learner
  useEffect(() => {
    if (expandedId && expandedRef.current) {
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [expandedId])

  function handleGroupChange(groupId: string) {
    setDropdownOpen(false)
    localStorage.setItem('trainer_selected_group', groupId)
    router.push(`/trainer/apprenants?group=${groupId}`)
  }

  function toggleLearner(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  function toggleAxeActions(axeId: string) {
    setExpandedAxeActions(prev => {
      const next = new Set(prev)
      next.has(axeId) ? next.delete(axeId) : next.add(axeId)
      return next
    })
  }

  function toggleAxeTipsTab(axeId: string) {
    setAxeTipsTab(prev => {
      const next = new Set(prev)
      next.has(axeId) ? next.delete(axeId) : next.add(axeId)
      return next
    })
  }

  function startEditTip(tip: TipData) {
    setEditingTipId(tip.id)
    setEditContent(tip.content)
    setEditAdvice(tip.advice ?? '')
  }

  function showError(msg: string) {
    setErrorMsg(msg)
    setTimeout(() => setErrorMsg(null), 3000)
  }

  async function saveTip(tipId: string) {
    setTipLoading(tipId)
    try {
      const res = await fetch('/api/tips/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipId, content: editContent, advice: editAdvice }),
      })
      if (!res.ok) throw new Error()
      setEditingTipId(null)
      router.refresh()
    } catch {
      showError('Erreur lors de la sauvegarde du tip')
    }
    setTipLoading(null)
  }

  async function regenerateTip(tipId: string) {
    setTipLoading(tipId)
    try {
      const res = await fetch('/api/tips/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'regenerate', tipId }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      showError('Erreur lors de la régénération du tip')
    }
    setTipLoading(null)
  }

  async function deleteTip(tipId: string) {
    setTipLoading(tipId)
    try {
      const res = await fetch(`/api/tips/admin?tipId=${tipId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      showError('Erreur lors de la suppression du tip')
    }
    setTipLoading(null)
  }

  async function addTip(axeId: string, learnerId: string) {
    setAddingTip(axeId)
    try {
      const res = await fetch('/api/tips/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-next', axeId, learnerId }),
      })
      if (!res.ok) throw new Error()
      router.refresh()
    } catch {
      showError('Erreur lors de la génération du tip')
    }
    setAddingTip(null)
  }

  return (
    <div className="space-y-3 pb-4">

      {/* ── Dropdown groupe ── */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-2.5 bg-white text-sm font-semibold transition-colors"
          style={{
            border: dropdownOpen ? '2px solid #fbbf24' : '2px solid #f0ebe0',
            borderRadius: 14,
            color: '#1a1a2e',
          }}
        >
          <span>{selectedGroup?.name ?? 'Groupe'}</span>
          <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} style={{ color: '#a0937c' }} />
        </button>
        {dropdownOpen && (
          <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-white shadow-xl overflow-hidden" style={{ border: '2px solid #f0ebe0', borderRadius: 14 }}>
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => handleGroupChange(g.id)}
                className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-left transition-colors"
                style={{
                  background: g.id === currentGroupId ? '#fffbeb' : 'white',
                  color: '#1a1a2e',
                  fontWeight: g.id === currentGroupId ? 700 : 500,
                }}
              >
                <span>{g.name}</span>
                <span className="text-xs" style={{ color: '#a0937c' }}>{g.count} app.</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Liste accordion ── */}
      {learners.map(learner => {
        const isExpanded = expandedId === learner.id
        const totalActions = learner.totalActions

        return (
          <div key={learner.id}>
            {/* ── En-tête apprenant (toujours visible) ── */}
            <div
              ref={isExpanded ? expandedRef : undefined}
              onClick={() => toggleLearner(learner.id)}
              className="flex items-center gap-2.5 cursor-pointer transition-all"
              style={{
                padding: '12px 14px',
                background: isExpanded ? '#fffbeb' : 'white',
                border: isExpanded ? '1.5px solid #fbbf24' : '1.5px solid #f0ebe0',
                borderRadius: isExpanded ? '16px 16px 0 0' : 16,
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-[18px] shrink-0"
                style={{ background: '#1a1a2e' }}
                title={
                  learner.lastWeather
                    ? `Dernière météo : ${learner.lastWeather}`
                    : 'Pas encore de check-in'
                }
              >
                {learner.lastWeather ? (WEATHER_ICONS[learner.lastWeather] ?? '—') : '—'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: '#1a1a2e' }}>
                  {learner.firstName} {learner.lastName}
                </p>
                <p className="text-[11px]" style={{ color: '#a0937c' }}>
                  <span style={{ color: '#1a1a2e', fontWeight: 700 }}>{learner.gestesCumulative}</span> geste{learner.gestesCumulative !== 1 ? 's' : ''}
                  <span className="opacity-60"> · {totalActions} act. · {learner.totalCheckins} chk.</span>
                </p>
              </div>
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0"
                style={{
                  background: '#1a1a2e',
                  color: learner.regularity >= 75 ? '#6ee7b7' : learner.regularity >= 50 ? '#fbbf24' : '#f87171',
                }}
              >
                {learner.regularity}%
              </div>
              <div
                className="shrink-0 flex items-center justify-center"
                style={{ width: 46, height: 32 }}
                title={
                  learner.activityZone === 'green'
                    ? `Actif · ${learner.gestes7d} geste${learner.gestes7d !== 1 ? 's' : ''} cette sem. · ${learner.gestes14d} la sem. d'avant`
                    : learner.activityZone === 'orange'
                    ? `Activité partielle · 7j : ${learner.gestes7d} · 8-14j : ${learner.gestes14d}`
                    : `Aucun geste sur 14 jours`
                }
              >
                <ActivityGauge zone={learner.activityZone} size={44} />
              </div>
              <span
                className="text-sm shrink-0 transition-transform"
                style={{ color: '#a0937c', transform: isExpanded ? 'rotate(180deg)' : 'none' }}
              >
                ▾
              </span>
            </div>

            {/* ── Fiche dépliée ── */}
            {isExpanded && (
              <div
                className="bg-white"
                style={{
                  border: '1.5px solid #fbbf24',
                  borderTop: 'none',
                  borderRadius: '0 0 16px 16px',
                  padding: 16,
                  marginBottom: 0,
                }}
              >
                {/* Mini header stats navy */}
                <div className="rounded-2xl p-3.5 relative overflow-hidden mb-3" style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)' }}>
                  <div className="absolute -top-5 -right-3 w-14 h-14 rounded-full" style={{ background: 'rgba(251,191,36,0.15)' }} />
                  <div className="relative grid grid-cols-3 gap-1.5">
                    <div className="text-center">
                      <div className="font-display text-xl font-bold" style={{ color: learner.actionsThisWeek > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                        {learner.actionsThisWeek > 0 ? `+${learner.actionsThisWeek}` : '0'}
                      </div>
                      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>cette semaine</p>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-xl font-bold text-white">{totalActions}</div>
                      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>actions</p>
                    </div>
                    <div className="text-center">
                      <div className="font-display text-xl font-bold" style={{ color: learner.checkinStreak > 0 ? '#fbbf24' : 'rgba(255,255,255,0.4)' }}>
                        {learner.checkinStreak > 0 ? `${learner.checkinStreak}🔥` : '0'}
                      </div>
                      <p className="text-[9px]" style={{ color: 'rgba(255,255,255,0.4)' }}>streak</p>
                    </div>
                  </div>
                </div>

                {/* Weather strip */}
                {learner.checkins.length > 0 && (
                  <div className="flex gap-1 px-2 py-2 mb-3 overflow-x-auto" style={{ background: '#faf8f4', borderRadius: 12 }}>
                    {learner.checkins.map((ci, idx) => (
                      <div
                        key={ci.id}
                        className="flex flex-col items-center shrink-0"
                        style={{
                          padding: '4px 6px',
                          borderRadius: 10,
                          minWidth: 36,
                          background: idx === learner.checkins.length - 1 ? '#fffbeb' : 'white',
                          border: idx === learner.checkins.length - 1 ? '1px solid #fbbf24' : '1px solid #f0ebe0',
                        }}
                      >
                        <span className="text-base leading-none">{WEATHER_ICONS[ci.weather] ?? '❓'}</span>
                        <span className="text-[8px] font-bold mt-0.5" style={{ color: '#a0937c' }}>S{ci.week_number}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Axes avec actions + feedback */}
                {learner.axes.length === 0 ? (
                  <div className="text-center py-4" style={{ color: '#a0937c' }}>
                    <p className="text-sm">Aucun axe defini</p>
                  </div>
                ) : (
                  learner.axes.map((axe, axeIdx) => {
                    const dyn = getDynamiqueForCount(axe.actions.length)
                    const sortedActions = [...axe.actions].sort(
                      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                    )
                    const showAll = expandedAxeActions.has(axe.id)
                    const visibleActions = showAll ? sortedActions : sortedActions.slice(0, 3)
                    const hasMore = sortedActions.length > 3
                    const showTips = axeTipsTab.has(axe.id)
                    const tipsSent = axe.tips.filter(t => t.sent).length
                    const tipsTotal = axe.tips.length

                    return (
                      <div
                        key={axe.id}
                        className="mb-2"
                        style={{ border: '1.5px solid #f0ebe0', borderRadius: 14, padding: '10px 12px', background: 'white' }}
                      >
                        {/* Axe header */}
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0"
                            style={{ background: '#1a1a2e', color: '#fbbf24' }}
                          >
                            {axeIdx + 1}
                          </div>
                          <span className="text-xs font-semibold flex-1 truncate" style={{ color: '#1a1a2e' }}>{axe.subject}</span>
                          <span className="text-sm">{dyn.icon}</span>
                          {tipsTotal > 0 && (
                            <span className="text-[10px] font-semibold shrink-0" style={{ color: '#a0937c' }}>💡 {tipsSent}/{tipsTotal}</span>
                          )}
                        </div>

                        {/* Sub-tabs Actions / Tips — toujours visibles */}
                        <div className="flex mt-2.5 mb-2" style={{ borderBottom: '1.5px solid #f0ebe0' }}>
                          <button
                            onClick={() => showTips && toggleAxeTipsTab(axe.id)}
                            className="flex-1 pb-1.5 text-[11px] font-semibold text-center transition-all"
                            style={{
                              color: !showTips ? '#1a1a2e' : '#a0937c',
                              borderBottom: !showTips ? '2px solid #fbbf24' : '2px solid transparent',
                              marginBottom: -1.5,
                            }}
                          >
                            Actions ({axe.actions.length})
                          </button>
                          <button
                            onClick={() => !showTips && toggleAxeTipsTab(axe.id)}
                            className="flex-1 pb-1.5 text-[11px] font-semibold text-center transition-all"
                            style={{
                              color: showTips ? '#1a1a2e' : '#a0937c',
                              borderBottom: showTips ? '2px solid #fbbf24' : '2px solid transparent',
                              marginBottom: -1.5,
                            }}
                          >
                            Tips ({tipsTotal})
                          </button>
                        </div>

                        {/* ── Tab Actions ─��� */}
                        {!showTips && (
                          <>
                            {sortedActions.length === 0 ? (
                              <p className="text-[11px] italic mt-2" style={{ color: '#a0937c' }}>Aucune action</p>
                            ) : (
                              <div className="space-y-1.5">
                                {visibleActions.map(action => {
                                  const fb = learner.feedbackMap[action.id]
                                  return (
                                    <div key={action.id} style={{ padding: '8px 10px', background: '#faf8f4', border: '1px solid #f0ebe0', borderRadius: 12 }}>
                                      <p className="text-xs leading-relaxed" style={{ color: '#1a1a2e' }}>{action.description}</p>
                                      <div className="flex items-center justify-between mt-1">
                                        <span className="text-[9px]" style={{ color: '#a0937c' }}>
                                          {formatRelativeAge(action.created_at)}
                                        </span>
                                        {fb && (
                                          <div className="scale-90 origin-right">
                                            <ActionFeedback actionId={action.id} feedback={fb} canInteract={true} />
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                                {hasMore && (
                                  <button
                                    onClick={() => toggleAxeActions(axe.id)}
                                    className="w-full py-1.5 text-center text-[10px] font-semibold transition-all"
                                    style={{
                                      border: '1.5px dashed #f0ebe0',
                                      borderRadius: 10,
                                      color: '#a0937c',
                                      background: showAll ? '#fffbeb' : 'transparent',
                                      borderColor: showAll ? '#fbbf24' : '#f0ebe0',
                                    }}
                                  >
                                    {showAll ? '▲ Replier' : `Voir les ${sortedActions.length - 3} precedentes`}
                                  </button>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* ── Tab Tips ── */}
                        {showTips && (
                          <div className="space-y-1.5">
                            {axe.tips.length === 0 ? (
                              <p className="text-[11px] italic py-3 text-center" style={{ color: '#a0937c' }}>Aucun tip pour cet axe</p>
                            ) : (
                              [...axe.tips].reverse().map((tip, reverseIdx) => {
                                const tipNumber = axe.tips.length - reverseIdx
                                const isEditing = editingTipId === tip.id
                                const isLoading = tipLoading === tip.id
                                const statusBadge = tip.read_at
                                  ? { label: '✅ Lu', bg: '#fde68a', color: '#92400e' }
                                  : tip.sent
                                  ? { label: '📤 Envoyé', bg: '#e0f2fe', color: '#0369a1' }
                                  : { label: '⏳ En attente', bg: '#f1f5f9', color: '#64748b' }

                                return (
                                  <div
                                    key={tip.id}
                                    style={{
                                      padding: '10px 12px',
                                      borderRadius: 12,
                                      border: tip.sent ? '1px solid #fde68a' : '1px solid #f0ebe0',
                                      background: tip.sent ? '#fffbeb' : 'white',
                                      opacity: isLoading ? 0.5 : 1,
                                    }}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                      <span className="text-[9px] font-extrabold text-white px-2 py-0.5" style={{ background: '#1a1a2e', borderRadius: 6 }}>
                                        Tip {tipNumber}
                                      </span>
                                      <span className="text-[9px] font-bold px-2 py-0.5" style={{ background: statusBadge.bg, color: statusBadge.color, borderRadius: 6 }}>
                                        {statusBadge.label}
                                      </span>
                                      {tip.sent && <span className="text-[10px] ml-auto" style={{ color: '#a0937c' }}>🔒</span>}
                                    </div>

                                    {isEditing ? (
                                      <div className="space-y-2 mt-2">
                                        <div>
                                          <label className="text-[9px] font-bold" style={{ color: '#a0937c' }}>💪 Rappel</label>
                                          <textarea
                                            value={editContent}
                                            onChange={e => setEditContent(e.target.value)}
                                            className="w-full text-xs p-2 mt-0.5 resize-y min-h-[60px]"
                                            style={{ border: '1px solid #f0ebe0', borderRadius: 8, background: '#faf8f4' }}
                                          />
                                        </div>
                                        <div>
                                          <label className="text-[9px] font-bold" style={{ color: '#a0937c' }}>💡 Conseil</label>
                                          <textarea
                                            value={editAdvice}
                                            onChange={e => setEditAdvice(e.target.value)}
                                            className="w-full text-xs p-2 mt-0.5 resize-y min-h-[60px]"
                                            style={{ border: '1px solid #f0ebe0', borderRadius: 8, background: '#faf8f4' }}
                                          />
                                        </div>
                                        <div className="flex gap-2">
                                          <button
                                            onClick={() => saveTip(tip.id)}
                                            className="flex-1 text-[10px] font-bold py-1.5 text-white"
                                            style={{ background: '#fbbf24', color: '#1a1a2e', borderRadius: 8 }}
                                          >
                                            Enregistrer
                                          </button>
                                          <button
                                            onClick={() => setEditingTipId(null)}
                                            className="flex-1 text-[10px] font-bold py-1.5"
                                            style={{ border: '1px solid #f0ebe0', borderRadius: 8, color: '#a0937c' }}
                                          >
                                            Annuler
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <p className="text-xs leading-relaxed" style={{ color: '#1a1a2e' }}>
                                          <strong>💪</strong> {tip.content}
                                        </p>
                                        {tip.advice && (
                                          <div className="text-[11px] leading-relaxed mt-1 p-1.5" style={{
                                            background: tip.sent ? '#fef9ee' : '#faf8f4',
                                            borderRadius: 8,
                                            color: '#64748b',
                                          }}>
                                            <strong>💡</strong> {tip.advice}
                                          </div>
                                        )}

                                        {/* Actions pour tips non envoyés */}
                                        {!tip.sent && (
                                          <div className="flex gap-1 mt-2 pt-2" style={{ borderTop: '1px solid #f0ebe0' }}>
                                            <button
                                              onClick={() => startEditTip(tip)}
                                              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 transition-all"
                                              style={{ border: '1px solid #f0ebe0', borderRadius: 8, color: '#1a1a2e', background: 'white' }}
                                            >
                                              ✏️ Modifier
                                            </button>
                                            <button
                                              onClick={() => regenerateTip(tip.id)}
                                              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 transition-all"
                                              style={{ border: '1px solid #f0ebe0', borderRadius: 8, color: '#1a1a2e', background: 'white' }}
                                            >
                                              🔄 Régénérer
                                            </button>
                                            <button
                                              onClick={() => deleteTip(tip.id)}
                                              className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 transition-all"
                                              style={{ border: '1px solid #f0ebe0', borderRadius: 8, color: '#a0937c', background: 'white' }}
                                            >
                                              🗑️ Supprimer
                                            </button>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )
                              })
                            )}

                            {/* Bouton ajouter un tip */}
                            <button
                              onClick={() => addTip(axe.id, learner.id)}
                              disabled={addingTip === axe.id}
                              className="w-full flex items-center justify-center gap-1 py-2 text-[11px] font-semibold transition-all"
                              style={{
                                border: '1.5px dashed #f0ebe0',
                                borderRadius: 10,
                                color: addingTip === axe.id ? '#a0937c' : '#a0937c',
                                background: addingTip === axe.id ? '#fffbeb' : 'transparent',
                              }}
                            >
                              {addingTip === axe.id ? '⏳ Génération IA...' : '+ Ajouter un tip'}
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}

                {/* Bouton message */}
                <button
                  onClick={() => router.push(`/trainer/messages?with=${learner.id}`)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 mt-2 text-sm font-bold text-white transition-colors"
                  style={{ background: 'linear-gradient(165deg, #1a1a2e 0%, #2a1a3e 100%)', borderRadius: 14 }}
                >
                  💬 Envoyer un message a {learner.firstName}
                </button>
              </div>
            )}
          </div>
        )
      })}

      {learners.length === 0 && (
        <div className="text-center py-8" style={{ color: '#a0937c' }}>
          <p className="text-2xl mb-2">👥</p>
          <p className="text-sm">Aucun participant dans ce groupe</p>
        </div>
      )}
      {/* ── Toast erreur ── */}
      {errorMsg && (
        <div
          className="fixed bottom-20 left-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium text-white text-center shadow-lg"
          style={{ background: '#e11d48' }}
        >
          {errorMsg}
        </div>
      )}
    </div>
  )
}
