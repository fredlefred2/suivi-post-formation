'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { createAction } from '@/app/(learner)/axes/actions'
import { getNextLevel, getCurrentLevelIndex, getCurrentLevel, getDynamique } from '@/lib/axeHelpers'
import { useToast } from '@/app/components/Toast'

type AxeOption = {
  id: string
  subject: string
  description?: string | null
  completedCount: number
}

type Props = {
  axes: AxeOption[]
  open: boolean
  onClose: () => void
  onSuccess?: (axeId: string, newCount: number) => void
  onboardingMode?: boolean
  prefill?: { content: string; axeId: string } | null
  groupTheme?: string | null
}

// ── Composant ──────────────────────────────────────────────────

// Flow : Axe → Contexte → Précision contexte → Action → Résultat
type ChatStep = 'axe' | 'context' | 'context-detail' | 'action' | 'result' | 'confirm'

export default function QuickAddAction({ axes, open, onClose, onSuccess, onboardingMode, prefill, groupTheme }: Props) {
  const [step, setStep] = useState<ChatStep>('axe')
  const [selectedAxe, setSelectedAxe] = useState<AxeOption | null>(null)
  const [chosenContext, setChosenContext] = useState('')
  const [contextDetail, setContextDetail] = useState('')
  const [chosenAction, setChosenAction] = useState('')
  const [chosenResult, setChosenResult] = useState('')
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [levelUpInfo, setLevelUpInfo] = useState<{ icon: string; label: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmInfo, setConfirmInfo] = useState<{ message: string; nextIcon: string; nextLabel: string } | null>(null)
  const [contextSuggestions, setContextSuggestions] = useState<string[]>([])
  const [loadingContexts, setLoadingContexts] = useState(false)
  const [actionSuggestions, setActionSuggestions] = useState<string[]>([])
  const [loadingActions, setLoadingActions] = useState(false)
  const [resultSuggestions, setResultSuggestions] = useState<string[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { toast } = useToast()
  const chatRef = useRef<HTMLDivElement>(null)

  // Auto-scroll vers le bas quand le step change
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [step, loadingContexts, loadingActions, loadingResults, contextSuggestions, actionSuggestions, resultSuggestions, showCustom])

  // Prefill depuis défi de la semaine (mode legacy)
  useEffect(() => {
    if (prefill && open) {
      const axe = axes.find(a => a.id === prefill.axeId)
      if (axe) {
        setSelectedAxe(axe)
        setChosenAction(prefill.content)
        setStep('confirm')
      }
    }
  }, [prefill, open, axes])

  // Onboarding mode: auto-select first axe, pre-fill
  useEffect(() => {
    if (onboardingMode && open && axes.length > 0 && !selectedAxe) {
      const firstAxe = axes[0]
      setSelectedAxe(firstAxe)
      setChosenAction('J\'ai préparé le compte-rendu de la réunion')
      setStep('confirm')
    }
  }, [onboardingMode, open, axes, selectedAxe])

  function reset() {
    setStep('axe')
    setSelectedAxe(null)
    setChosenContext('')
    setContextDetail('')
    setChosenAction('')
    setChosenResult('')
    setCustomText('')
    setShowCustom(false)
    setLevelUpInfo(null)
    setShowConfirm(false)
    setConfirmInfo(null)
    setContextSuggestions([])
    setLoadingContexts(false)
    setActionSuggestions([])
    setLoadingActions(false)
    setResultSuggestions([])
    setLoadingResults(false)
    setIsSubmitting(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  // ── Étape 1 : Axe → charge les contextes ──
  function handleSelectAxe(axe: AxeOption) {
    setSelectedAxe(axe)
    setStep('context')
    setShowCustom(false)
    setCustomText('')
    fetchContextSuggestions(axe)
  }

  async function fetchContextSuggestions(axe: AxeOption) {
    setLoadingContexts(true)
    setContextSuggestions([])
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contexts',
          axeSubject: axe.subject,
          axeDescription: axe.description || undefined,
          groupTheme: groupTheme || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results?.length) {
          setContextSuggestions(data.results)
          setLoadingContexts(false)
          return
        }
      }
    } catch (err) {
      console.error('[Suggestions] fetch contexts error:', err)
    }
    setContextSuggestions(['En réunion', 'En entretien', 'Au téléphone', 'En présentation'])
    setLoadingContexts(false)
  }

  // ── Étape 2 : Contexte → précision texte libre ──
  function handleSelectContext(ctx: string) {
    setChosenContext(ctx)
    setShowCustom(false)
    setCustomText('')
    setContextDetail('')
    setStep('context-detail')
  }

  function handleCustomContext() {
    if (!customText.trim()) return
    const ctx = customText.trim()
    setChosenContext(ctx)
    setShowCustom(false)
    setCustomText('')
    // Pas besoin de précision si c'est déjà du texte libre
    setStep('action')
    fetchActionSuggestions(ctx, '')
  }

  // ── Étape 2b : Précision contexte → charge les actions ──
  function handleContextDetailSubmit() {
    const detail = contextDetail.trim()
    const fullContext = detail ? `${chosenContext} (${detail})` : chosenContext
    setChosenContext(fullContext)
    setContextDetail('')
    setStep('action')
    fetchActionSuggestions(fullContext, '')
  }

  function handleContextDetailSkip() {
    setContextDetail('')
    setStep('action')
    fetchActionSuggestions(chosenContext, '')
  }

  // ── Étape 3 : Action ──
  async function fetchActionSuggestions(context: string, _unused: string) {
    setLoadingActions(true)
    setActionSuggestions([])
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'actions',
          context,
          axeSubject: selectedAxe?.subject,
          axeDescription: selectedAxe?.description || undefined,
          groupTheme: groupTheme || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results?.length) {
          setActionSuggestions(data.results)
          setLoadingActions(false)
          return
        }
      }
    } catch (err) {
      console.error('[Suggestions] fetch actions error:', err)
    }
    setActionSuggestions([
      "J'ai testé une nouvelle approche",
      "J'ai osé faire différemment",
      "J'ai pris du recul avant de réagir",
    ])
    setLoadingActions(false)
  }

  function handleSelectAction(action: string) {
    setChosenAction(action)
    setShowCustom(false)
    setCustomText('')
    setStep('result')
    fetchResultSuggestions(action)
  }

  function handleCustomAction() {
    if (!customText.trim()) return
    const action = customText.trim()
    setChosenAction(action)
    setShowCustom(false)
    setCustomText('')
    setStep('result')
    fetchResultSuggestions(action)
  }

  // ── Étape 4 : Résultat ──
  async function fetchResultSuggestions(action: string) {
    setLoadingResults(true)
    setResultSuggestions([])
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          context: chosenContext,
          axeSubject: selectedAxe?.subject,
          axeDescription: selectedAxe?.description || undefined,
          groupTheme: groupTheme || undefined,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results?.length) {
          setResultSuggestions(data.results)
          setLoadingResults(false)
          return
        }
      }
    } catch (err) {
      console.error('[Suggestions] fetch results error:', err)
    }
    setResultSuggestions([
      "Ça a bien fonctionné",
      "J'ai vu une différence",
      "C'était encourageant",
    ])
    setLoadingResults(false)
  }

  function handleSelectResult(result: string) {
    if (isSubmitting) return
    setChosenResult(result)
    setShowCustom(false)
    setCustomText('')
    submitAction(chosenAction, chosenContext, result)
  }

  function handleCustomResult() {
    if (isSubmitting || !customText.trim()) return
    const result = customText.trim()
    setChosenResult(result)
    setShowCustom(false)
    setCustomText('')
    submitAction(chosenAction, chosenContext, result)
  }

  function buildDescription(action: string, context: string, result: string): string {
    const ctxLower = context.charAt(0).toLowerCase() + context.slice(1)
    return `${action}, ${ctxLower}. ${result}`
  }

  function submitAction(action: string, context: string, result: string) {
    if (!selectedAxe || isSubmitting) return
    setIsSubmitting(true)

    const description = buildDescription(action, context, result)

    const fd = new FormData()
    fd.set('axe_id', selectedAxe.id)
    fd.set('description', description)

    const oldCount = selectedAxe.completedCount

    startTransition(async () => {
      const res = await createAction(fd)
      if (res?.error) return

      const newCount = oldCount + 1

      const oldLevel = getCurrentLevelIndex(oldCount)
      const newLevel = getCurrentLevelIndex(newCount)
      if (newLevel > oldLevel) {
        const level = getCurrentLevel(newCount)
        setLevelUpInfo(level)
        setTimeout(() => {
          setLevelUpInfo(null)
          handleClose()
          onSuccess?.(selectedAxe.id, newCount)
        }, 2500)
      } else {
        const next = getNextLevel(newCount)
        setConfirmInfo(next ? {
          message: `Encore ${next.delta} action${next.delta > 1 ? 's' : ''} pour`,
          nextIcon: next.icon,
          nextLabel: next.label,
        } : null)
        setShowConfirm(true)
        setTimeout(() => {
          setShowConfirm(false)
          setConfirmInfo(null)
          handleClose()
          onSuccess?.(selectedAxe.id, newCount)
        }, 2500)
      }
    })
  }

  // Mode legacy pour onboarding et prefill
  function handleLegacySubmit() {
    if (!selectedAxe || !chosenAction.trim()) return
    const fd = new FormData()
    fd.set('axe_id', selectedAxe.id)
    fd.set('description', chosenAction.trim())
    const oldCount = selectedAxe.completedCount
    startTransition(async () => {
      const res = await createAction(fd)
      if (res?.error) return
      const newCount = oldCount + 1
      const oldLevel = getCurrentLevelIndex(oldCount)
      const newLevel = getCurrentLevelIndex(newCount)
      if (newLevel > oldLevel) {
        const level = getCurrentLevel(newCount)
        setLevelUpInfo(level)
        setTimeout(() => { setLevelUpInfo(null); handleClose(); onSuccess?.(selectedAxe.id, newCount) }, 2500)
      } else {
        const next = getNextLevel(newCount)
        setConfirmInfo(next ? { message: `Encore ${next.delta} action${next.delta > 1 ? 's' : ''} pour`, nextIcon: next.icon, nextLabel: next.label } : null)
        setShowConfirm(true)
        setTimeout(() => { setShowConfirm(false); setConfirmInfo(null); handleClose(); onSuccess?.(selectedAxe.id, newCount) }, 2500)
      }
    })
  }

  function goBack() {
    setShowCustom(false)
    setCustomText('')
    if (step === 'context') { setStep('axe'); setSelectedAxe(null) }
    else if (step === 'context-detail') { setStep('context'); setChosenContext(''); setContextDetail('') }
    else if (step === 'action') { setStep('context'); setChosenContext(''); setContextDetail('') }
    else if (step === 'result') { setStep('action'); setChosenAction('') }
  }

  if (!open) return null

  // Messages du coach selon l'étape
  const coachMessages: Record<ChatStep, string> = {
    axe: 'Hey ! Tu as agi sur quel axe ?',
    context: 'C\'était dans quel contexte ?',
    'context-detail': 'Tu peux préciser ?',
    action: 'Top ! Qu\'est-ce que tu as fait ?',
    result: 'Et alors, qu\'est-ce que ça a donné ?',
    confirm: '',
  }

  // Bulle coach (alignée à gauche)
  function CoachBubble({ text }: { text: string }) {
    return (
      <div className="flex gap-2.5 items-start">
        <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[14px]"
          style={{ background: '#1a1a2e' }}>
          🎯
        </div>
        <div className="rounded-2xl rounded-tl-md px-4 py-2.5 max-w-[85%] text-[14px]"
          style={{ background: '#f0ebe0', color: '#1a1a2e' }}>
          {text}
        </div>
      </div>
    )
  }

  // Bulle réponse apprenant (alignée à droite)
  function UserBubble({ text }: { text: string }) {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[85%] text-[14px] font-medium"
          style={{ background: '#1a1a2e', color: '#fbbf24' }}>
          {text}
        </div>
      </div>
    )
  }

  // Indicateur de chargement
  function LoadingDots() {
    return (
      <div className="pl-10">
        <div className="flex gap-1.5 items-center px-3.5 py-2.5 text-[13px]" style={{ color: '#a0937c' }}>
          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
          <span className="ml-1.5">Je réfléchis...</span>
        </div>
      </div>
    )
  }

  // Boutons de suggestion
  function SuggestionButtons({ items, onSelect }: { items: string[]; onSelect: (s: string) => void }) {
    return (
      <>
        {items.map((s, i) => (
          <button key={i} onClick={() => onSelect(s)}
            className="w-full text-left px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] transition-all active:scale-[0.98]"
            style={{ background: 'white', border: '1.5px solid #e8e0d4', color: '#1a1a2e' }}>
            {s}
          </button>
        ))}
      </>
    )
  }

  // Bouton "Non, c'est autre chose..." bien visible
  function OtherButton({ onClick }: { onClick: () => void }) {
    return (
      <button onClick={onClick}
        className="w-full text-center px-3.5 py-3 rounded-2xl rounded-tl-md text-[13px] font-bold transition-all active:scale-[0.98]"
        style={{ background: '#1a1a2e', border: '2px solid #1a1a2e', color: '#fbbf24' }}>
        ✏️ Non, c&apos;est autre chose...
      </button>
    )
  }

  // Saisie libre
  function CustomInput({ placeholder, onSubmit }: { placeholder: string; onSubmit: () => void }) {
    return showCustom ? (
      <div className="pl-10 space-y-2">
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && customText.trim()) { e.preventDefault(); onSubmit() } }}
          className="w-full rounded-2xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:ring-2"
          style={{ border: '1.5px solid #e8e0d4', background: 'white' }}
          placeholder={placeholder}
          autoFocus
        />
        <div className="flex gap-2 h-7">
          <button onClick={() => setShowCustom(false)}
            className="text-[12px] px-3 py-1.5 rounded-full font-medium" style={{ color: '#a0937c' }}>
            ← Retour
          </button>
          <button onClick={onSubmit}
            className={`text-[12px] px-4 py-1.5 rounded-full font-semibold transition-opacity ${customText.trim() ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            style={{ background: '#1a1a2e', color: '#fbbf24' }}>
            Envoyer
          </button>
        </div>
      </div>
    ) : null
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {levelUpInfo ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-auto p-8 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <div className="text-7xl animate-level-up mb-4">{levelUpInfo.icon}</div>
          <div className="animate-level-up-text">
            <p className="text-xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Niveau {levelUpInfo.label}</p>
            <p className="text-lg font-semibold" style={{ color: '#a0937c' }}>débloqué !</p>
            <p className="text-sm mt-3" style={{ color: '#a0937c' }}>Continue comme ça 💪</p>
          </div>
        </div>
      ) : showConfirm ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-auto p-8 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <div className="text-7xl mb-4">✅</div>
          <p className="text-xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Action ajoutée !</p>
          {confirmInfo ? (
            <div className="mt-3">
              <p className="text-sm text-gray-500">{confirmInfo.message}</p>
              <p className="text-2xl mt-1">{confirmInfo.nextIcon} <span className="text-lg font-semibold text-gray-500">{confirmInfo.nextLabel}</span></p>
            </div>
          ) : (
            <p className="text-lg font-semibold text-gray-500 mt-1">Niveau max atteint ! 🚀</p>
          )}
        </div>
      ) : (onboardingMode || prefill) && step === 'confirm' ? (
        /* Mode legacy pour onboarding/prefill */
        <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl w-full max-w-md mx-0 sm:mx-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" style={{ border: '2px solid #f0ebe0' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-lg" style={{ color: '#1a1a2e' }}>Qu&apos;as-tu fait ?</h3>
            <button onClick={handleClose} className="p-1 text-gray-500"><X size={20} /></button>
          </div>
          {onboardingMode && (
            <div className="rounded-xl px-3 py-2 text-sm mb-4" style={{ background: '#fffbeb', border: '2px solid #fde68a', color: '#92400e' }}>
              <p className="font-medium">🎯 C&apos;est un exemple !</p>
              <p className="text-xs mt-0.5">Ton axe est pré-sélectionné. Valide cette action pour découvrir la suite.</p>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm mb-4">
            <span className="text-base">{getDynamique(selectedAxe?.completedCount ?? 0).icon}</span>
            <span className="font-medium text-gray-700">{selectedAxe?.subject}</span>
          </div>
          <textarea
            value={chosenAction}
            onChange={(e) => setChosenAction(e.target.value)}
            className="input w-full h-24 resize-none"
            placeholder="Ex : J'ai laissé Julie animer la réunion"
            autoFocus
            required
          />
          <div className="flex gap-3 mt-4">
            <button onClick={handleLegacySubmit} disabled={isPending || !chosenAction.trim()} className="btn-primary flex-1 disabled:opacity-50">
              {isPending ? 'Enregistrement...' : 'Valider ✓'}
            </button>
          </div>
        </div>
      ) : (
        /* Mode chatbot conversationnel */
        <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl w-full max-w-md mx-0 sm:mx-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] overflow-hidden" style={{ border: '2px solid #f0ebe0' }}>

          {/* Header compact */}
          <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#1a1a2e' }}>
            <div className="flex items-center gap-2.5">
              {step !== 'axe' && (
                <button onClick={goBack} className="text-white/50 active:text-white">
                  <ChevronLeft size={18} />
                </button>
              )}
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[12px]"
                style={{ background: '#fbbf24' }}>🎯</div>
              <p className="text-white font-semibold text-[14px]">Nouvelle action</p>
            </div>
            <button onClick={handleClose} className="text-white/40 active:text-white">
              <X size={18} />
            </button>
          </div>

          {/* Zone de chat — hauteur fixe pour éviter le tressautement */}
          <div ref={chatRef} className="px-4 py-4 space-y-3 overflow-y-auto" style={{ background: '#faf8f4', height: '50vh', maxHeight: '400px' }}>

            {/* ── Historique des réponses précédentes ── */}

            {/* Étape 1 répondue : axe choisi */}
            {selectedAxe && step !== 'axe' && (
              <>
                <CoachBubble text={coachMessages.axe} />
                <UserBubble text={`${getDynamique(selectedAxe.completedCount).icon} ${selectedAxe.subject}`} />
              </>
            )}

            {/* Étape 2 répondue : contexte choisi */}
            {chosenContext && (step === 'context-detail' || step === 'action' || step === 'result') && (
              <>
                <CoachBubble text={coachMessages.context} />
                <UserBubble text={chosenContext} />
              </>
            )}

            {/* Étape 3 répondue : action choisie */}
            {chosenAction && step === 'result' && (
              <>
                <CoachBubble text={coachMessages.action} />
                <UserBubble text={chosenAction} />
              </>
            )}

            {/* ── Question en cours ── */}
            <CoachBubble text={coachMessages[step]} />

            {/* ── Étape 1 : Choix de l'axe ── */}
            {step === 'axe' && (
              <div className="pl-10 space-y-2">
                {axes.map((axe) => {
                  const marker = getDynamique(axe.completedCount)
                  return (
                    <button key={axe.id} onClick={() => handleSelectAxe(axe)}
                      className="w-full text-left px-3.5 py-2.5 rounded-2xl rounded-tl-md transition-all active:scale-[0.98]"
                      style={{ background: 'white', border: '1.5px solid #e8e0d4' }}>
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg shrink-0">{marker.icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-[13px]" style={{ color: '#1a1a2e' }}>{axe.subject}</p>
                          <p className="text-[11px]" style={{ color: '#a0937c' }}>{axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''} · {marker.label}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* ── Étape 2 : Contexte ── */}
            {step === 'context' && !showCustom && loadingContexts && <LoadingDots />}
            {step === 'context' && !showCustom && !loadingContexts && (
              <div className="pl-10 space-y-2">
                <SuggestionButtons items={contextSuggestions} onSelect={handleSelectContext} />
                <OtherButton onClick={() => { setShowCustom(true); setCustomText('') }} />
              </div>
            )}
            {step === 'context' && <CustomInput placeholder="Décris le contexte..." onSubmit={handleCustomContext} />}

            {/* ── Étape 2b : Précision contexte (texte libre + skip) ── */}
            {step === 'context-detail' && (
              <div className="pl-10 space-y-2">
                <input
                  type="text"
                  value={contextDetail}
                  onChange={(e) => setContextDetail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleContextDetailSubmit() } }}
                  className="w-full rounded-2xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:ring-2"
                  style={{ border: '1.5px solid #e8e0d4', background: 'white' }}
                  placeholder="Ex : avec le directeur achats, pour le projet X..."
                  autoFocus
                />
                <div className="flex gap-2 h-7">
                  <button onClick={handleContextDetailSkip}
                    className="text-[12px] px-3 py-1.5 rounded-full font-medium" style={{ color: '#a0937c' }}>
                    Passer →
                  </button>
                  <button onClick={handleContextDetailSubmit}
                    className={`text-[12px] px-4 py-1.5 rounded-full font-semibold transition-opacity ${contextDetail.trim() ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                    OK
                  </button>
                </div>
              </div>
            )}

            {/* ── Étape 3 : Suggestions d'action ── */}
            {step === 'action' && !showCustom && loadingActions && <LoadingDots />}
            {step === 'action' && !showCustom && !loadingActions && (
              <div className="pl-10 space-y-2">
                <SuggestionButtons items={actionSuggestions} onSelect={handleSelectAction} />
                <OtherButton onClick={() => { setShowCustom(true); setCustomText('') }} />
              </div>
            )}
            {step === 'action' && <CustomInput placeholder="Décris ce que tu as fait..." onSubmit={handleCustomAction} />}

            {/* ── Étape 4 : Résultat ── */}
            {step === 'result' && !showCustom && loadingResults && <LoadingDots />}
            {step === 'result' && !showCustom && !loadingResults && (
              <div className={`pl-10 space-y-2 ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>
                <SuggestionButtons items={resultSuggestions} onSelect={handleSelectResult} />
                <OtherButton onClick={() => { setShowCustom(true); setCustomText('') }} />
              </div>
            )}
            {step === 'result' && (
              <CustomInput placeholder="Qu'as-tu observé comme résultat ?" onSubmit={handleCustomResult} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
