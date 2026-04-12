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

// ── Messages valorisants ───────────────────────────────────────

const FIRST_ACTION_MESSAGES = [
  { text: "Première action déclarée, c'est le premier pas qui compte !", emoji: '🌱' },
  { text: "C'est parti ! Tu viens de poser la première brique", emoji: '💪' },
  { text: "Le plus dur c'est de se lancer… et tu l'as fait !", emoji: '🚀' },
]

const VALORISANT_MESSAGES = [
  { text: "C'est en osant sur le terrain qu'on progresse", emoji: '💪' },
  { text: "Une bonne pratique de plus ancrée dans ton quotidien", emoji: '🌱' },
  { text: "Tu fais partie de ceux qui appliquent, pas juste ceux qui apprennent", emoji: '🔥' },
  { text: "Chaque mise en pratique renforce tes réflexes", emoji: '🎯' },
  { text: "La théorie prend vie quand on passe à l'action", emoji: '⚡' },
  { text: "Action après action, tu ancres de nouvelles habitudes", emoji: '🧱' },
  { text: "Bravo, tu passes à l'action ! C'est ça qui fait la différence", emoji: '👏' },
  { text: "Ce que tu viens de faire, c'est du développement concret", emoji: '📈' },
  { text: "Encore une mise en pratique, tu construis ta progression", emoji: '🏗️' },
  { text: "Tu transformes la formation en réflexes terrain", emoji: '🎯' },
  { text: "Chaque action déclarée, c'est un pas de plus", emoji: '👣' },
  { text: "Continue comme ça, l'important c'est la régularité", emoji: '🔄' },
]

function getValorisantMessage(actionCount: number): { text: string; emoji: string } {
  if (actionCount === 1) {
    return FIRST_ACTION_MESSAGES[Math.floor(Math.random() * FIRST_ACTION_MESSAGES.length)]
  }
  return VALORISANT_MESSAGES[Math.floor(Math.random() * VALORISANT_MESSAGES.length)]
}

// ── Helpers chatbot ───────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function truncate(s: string, max = 30): string {
  return s.length > max ? s.slice(0, max).trim() + '…' : s
}

// Messages par défaut (fallback)
const DEFAULT_MESSAGES: Record<string, string> = {
  axe: 'Hey ! Tu as agi sur quel axe ?',
  context: 'C\'était dans quel contexte ?',
  'context-detail': 'Tu peux préciser ?',
  action: 'Top ! Qu\'est-ce que tu as fait ?',
  result: 'Et alors, qu\'est-ce que ça a donné ?',
  confirm: '',
}

// Messages contextuels : le coach réagit au choix précédent
function contextualMessage(toStep: string, data: { axe?: string; context?: string; action?: string }): string {
  switch (toStep) {
    case 'context': {
      const a = truncate(data.axe || '')
      return pickRandom([
        `${a}, super choix ! C'était dans quel contexte ?`,
        `Ah, ${a} ! Dis-moi, c'était dans quelle situation ?`,
        `Ok, ${a} 👍 C'était dans quel contexte ?`,
        `${a}, j'aime bien ! C'était où ?`,
      ])
    }
    case 'context-detail': {
      const c = truncate(data.context || '')
      return pickRandom([
        `${c}, d'accord ! Tu veux préciser un peu ?`,
        `${c} 👍 Tu peux me donner un détail ?`,
        `Ok, ${c} ! Une petite précision ?`,
      ])
    }
    case 'action':
      return pickRandom([
        'Bien noté ! Concrètement, qu\'est-ce que tu as fait ?',
        'Ok je vois le tableau 👍 Qu\'est-ce que tu as fait ?',
        'Super, c\'est clair ! Qu\'est-ce que tu as fait exactement ?',
        'Parfait ! Raconte-moi ce que tu as fait',
      ])
    case 'result': {
      const act = truncate(data.action || '', 40)
      return pickRandom([
        `"${act}" — bien joué 💪 Qu'est-ce que ça a donné ?`,
        `${act}, c'est du concret ça ! Qu'est-ce que ça a donné ?`,
        `Ah super, ${act} ! Et le résultat ?`,
        `${act}, j'adore ! Qu'est-ce que ça a donné ?`,
      ])
    }
    default:
      return DEFAULT_MESSAGES[toStep] || ''
  }
}

// ── Détection bêtises ─────────────────────────────────────────

const VULGAR_WORDS = ['caca', 'pipi', 'merde', 'putain', 'connard', 'connasse', 'bite', 'couille', 'nique', 'fuck', 'shit', 'prout', 'enculé', 'pute', 'salop', 'chier', 'foutre']
const JOKE_WORDS = ['test', 'azerty', 'qwerty', 'rien', 'lol', 'haha', 'blabla', 'toto', 'xxx', 'zzz', 'asdf', 'aaa', 'bbb', 'jjj', 'oui', 'non', 'ok']

const REJECT_MESSAGES = [
  "😄 Hmm… c'est pas tout à fait ce qu'on a vu en formation ! Allez, pour de vrai ?",
  "🤔 Original ! Mais sérieusement, dis-moi ?",
  "😏 Hmm, t'en as pas une autre ?",
  "😄 Ok, je fais comme si j'avais rien lu… Essaie encore !",
  "🤨 Sérieusement ? Allez, je t'écoute !",
  "😅 J'ai failli y croire ! Allez, pour de vrai cette fois",
  "😄 Haha ok… mais non. Essaie encore !",
]

function checkNonsense(text: string): string | null {
  const lower = text.toLowerCase().trim()
  if (lower.length < 3) return pickRandom(REJECT_MESSAGES)
  if (/^(.)\1+$/i.test(lower)) return pickRandom(REJECT_MESSAGES)
  if (/^\d+$/.test(lower)) return pickRandom(REJECT_MESSAGES)
  if (VULGAR_WORDS.some(w => lower.includes(w))) return pickRandom(REJECT_MESSAGES)
  if (JOKE_WORDS.some(w => lower === w)) return pickRandom(REJECT_MESSAGES)
  if (lower.length > 4 && !/[aeiouyàâéèêëïîôùûü]/i.test(lower)) return pickRandom(REJECT_MESSAGES)
  return null
}

// ── Sous-composants (hors du composant principal pour éviter les re-renders) ──

// Feu d'artifice de confirmation (2 vagues de particules + étoiles + ring)
function SparkleParticles() {
  // Vague 1 : burst immédiat
  const wave1 = [
    { sx: -60, sy: -70 }, { sx: 60, sy: -70 },
    { sx: -80, sy: -10 }, { sx: 80, sy: -10 },
    { sx: -50, sy: 50 }, { sx: 50, sy: 50 },
    { sx: 0, sy: -85 }, { sx: 0, sy: 60 },
    { sx: -70, sy: -40 }, { sx: 70, sy: -40 },
    { sx: -40, sy: 65 }, { sx: 40, sy: -80 },
  ]
  // Vague 2 : retardée, plus large
  const wave2 = [
    { sx: -45, sy: -90 }, { sx: 45, sy: -90 },
    { sx: -90, sy: 20 }, { sx: 90, sy: 20 },
    { sx: -65, sy: 55 }, { sx: 65, sy: -55 },
    { sx: 25, sy: 70 }, { sx: -25, sy: -75 },
  ]
  const stars = [
    { sx: -50, sy: -75, d: 80 }, { sx: 65, sy: -50, d: 130 },
    { sx: -70, sy: 25, d: 180 }, { sx: 50, sy: 55, d: 50 },
    { sx: -30, sy: 70, d: 230 }, { sx: 75, sy: 10, d: 280 },
    { sx: 0, sy: -90, d: 160 }, { sx: -80, sy: -20, d: 320 },
  ]
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Ring doré qui explose */}
      <div className="confirm-ring" />
      {/* Vague 1 */}
      {wave1.map((p, i) => (
        <span key={`w1${i}`} className="sparkle-particle"
          style={{ '--sx': `${p.sx}px`, '--sy': `${p.sy}px`, animationDelay: `${i * 40}ms` } as React.CSSProperties} />
      ))}
      {/* Vague 2 (retardée) */}
      {wave2.map((p, i) => (
        <span key={`w2${i}`} className="sparkle-particle sparkle-particle-sm"
          style={{ '--sx': `${p.sx}px`, '--sy': `${p.sy}px`, animationDelay: `${300 + i * 50}ms` } as React.CSSProperties} />
      ))}
      {/* Étoiles */}
      {stars.map((p, i) => (
        <span key={`s${i}`} className="sparkle-star"
          style={{ '--sx': `${p.sx}px`, '--sy': `${p.sy}px`, animationDelay: `${p.d}ms` } as React.CSSProperties} />
      ))}
    </div>
  )
}

// Animation d'intro (flash doré + emoji + texte)
function IntroAnimation() {
  return (
    <div className="relative flex flex-col items-center justify-center" style={{ height: '200px' }}>
      <div className="intro-flash" />
      <div className="intro-emoji text-6xl relative z-10">⚡</div>
      <p className="intro-text text-lg font-bold mt-3 relative z-10" style={{ color: '#1a1a2e' }}>
        C&apos;est parti !
      </p>
      <p className="intro-text text-sm mt-1 relative z-10" style={{ color: '#a0937c', animationDelay: '0.7s' }}>
        Raconte-moi ce que tu as fait
      </p>
    </div>
  )
}

// Bulle coach (alignée à gauche)
function CoachBubble({ text, animate = false }: { text: string; animate?: boolean }) {
  return (
    <div className={`flex gap-2.5 items-start ${animate ? 'chat-bubble-in' : ''}`}>
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[14px]"
        style={{ background: '#1a1a2e' }}>
        ✨
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
    <div className="flex justify-end chat-bubble-in">
      <div className="rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[85%] text-[14px] font-medium"
        style={{ background: '#1a1a2e', color: '#fbbf24' }}>
        {text}
      </div>
    </div>
  )
}

// Indicateur "en train d'écrire" (avatar + dots pulsants)
function TypingIndicator() {
  return (
    <div className="flex gap-2.5 items-start chat-bubble-in">
      <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[14px]"
        style={{ background: '#1a1a2e' }}>
        ✨
      </div>
      <div className="rounded-2xl rounded-tl-md px-4 py-3 flex items-center gap-1"
        style={{ background: '#f0ebe0' }}>
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="ml-2 text-[12px]" style={{ color: '#a0937c' }}>en train d&apos;écrire</span>
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
  const [valorisantMsg, setValorisantMsg] = useState<{ text: string; emoji: string } | null>(null)
  const [stepMessages, setStepMessages] = useState<Partial<Record<ChatStep, string>>>({})
  const [rejectMsg, setRejectMsg] = useState<string | null>(null)
  const [showIntro, setShowIntro] = useState(false)
  const { toast } = useToast()
  const chatRef = useRef<HTMLDivElement>(null)
  const contextCache = useRef<Map<string, string[]>>(new Map())

  // Auto-scroll vers le bas quand le step change
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight
    }
  }, [step, loadingContexts, loadingActions, loadingResults, contextSuggestions, actionSuggestions, resultSuggestions, showCustom, rejectMsg])

  // Animation d'intro au lancement + pré-fetch contextes (sauf onboarding/prefill)
  useEffect(() => {
    if (open && !onboardingMode && !prefill) {
      setShowIntro(true)
      const timer = setTimeout(() => setShowIntro(false), 1500)
      // Pré-fetch des contextes pour tous les axes pendant l'intro
      contextCache.current.clear()
      axes.forEach(axe => {
        fetch('/api/suggestions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'contexts',
            axeSubject: axe.subject,
            axeDescription: axe.description || undefined,
            groupTheme: groupTheme || undefined,
          }),
        })
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.results?.length) {
              contextCache.current.set(axe.id, data.results)
            }
          })
          .catch(() => {})
      })
      return () => clearTimeout(timer)
    }
  }, [open, onboardingMode, prefill, axes, groupTheme])

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
    setValorisantMsg(null)
    setStepMessages({})
    setRejectMsg(null)
    setShowIntro(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  // ── Étape 1 : Axe → charge les contextes ──
  function handleSelectAxe(axe: AxeOption) {
    setSelectedAxe(axe)
    setStepMessages(prev => ({ ...prev, context: contextualMessage('context', { axe: axe.subject }) }))
    setStep('context')
    setShowCustom(false)
    setCustomText('')
    setRejectMsg(null)
    fetchContextSuggestions(axe)
  }

  async function fetchContextSuggestions(axe: AxeOption) {
    // Vérifie le cache pré-chargé pendant l'intro
    const cached = contextCache.current.get(axe.id)
    if (cached?.length) {
      setContextSuggestions(cached)
      return
    }
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
          contextCache.current.set(axe.id, data.results)
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
    setStepMessages(prev => ({ ...prev, 'context-detail': contextualMessage('context-detail', { context: ctx }) }))
    setShowCustom(false)
    setCustomText('')
    setContextDetail('')
    setRejectMsg(null)
    setStep('context-detail')
  }

  function handleCustomContext() {
    if (!customText.trim()) return
    const ctx = customText.trim()
    const nonsense = checkNonsense(ctx)
    if (nonsense) { setRejectMsg(nonsense); setCustomText(''); return }
    setChosenContext(ctx)
    setStepMessages(prev => ({ ...prev, action: contextualMessage('action', {}) }))
    setShowCustom(false)
    setCustomText('')
    setRejectMsg(null)
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
    setStepMessages(prev => ({ ...prev, action: contextualMessage('action', {}) }))
    setRejectMsg(null)
    setStep('action')
    fetchActionSuggestions(fullContext, '')
  }

  function handleContextDetailSkip() {
    setContextDetail('')
    setStepMessages(prev => ({ ...prev, action: contextualMessage('action', {}) }))
    setRejectMsg(null)
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
    setStepMessages(prev => ({ ...prev, result: contextualMessage('result', { action }) }))
    setShowCustom(false)
    setCustomText('')
    setRejectMsg(null)
    setStep('result')
    fetchResultSuggestions(action)
  }

  function handleCustomAction() {
    if (!customText.trim()) return
    const action = customText.trim()
    const nonsense = checkNonsense(action)
    if (nonsense) { setRejectMsg(nonsense); setCustomText(''); return }
    setChosenAction(action)
    setStepMessages(prev => ({ ...prev, result: contextualMessage('result', { action }) }))
    setShowCustom(false)
    setCustomText('')
    setRejectMsg(null)
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
    const nonsense = checkNonsense(result)
    if (nonsense) { setRejectMsg(nonsense); setCustomText(''); return }
    setChosenResult(result)
    setShowCustom(false)
    setCustomText('')
    setRejectMsg(null)
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
      const msg = getValorisantMessage(newCount)
      setValorisantMsg(msg)

      const oldLevel = getCurrentLevelIndex(oldCount)
      const newLevel = getCurrentLevelIndex(newCount)
      if (newLevel > oldLevel) {
        const level = getCurrentLevel(newCount)
        setLevelUpInfo(level)
        setTimeout(() => {
          setLevelUpInfo(null)
          handleClose()
          onSuccess?.(selectedAxe.id, newCount)
        }, 3500)
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
        }, 3500)
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
      const msg = getValorisantMessage(newCount)
      setValorisantMsg(msg)
      const oldLevel = getCurrentLevelIndex(oldCount)
      const newLevel = getCurrentLevelIndex(newCount)
      if (newLevel > oldLevel) {
        const level = getCurrentLevel(newCount)
        setLevelUpInfo(level)
        setTimeout(() => { setLevelUpInfo(null); handleClose(); onSuccess?.(selectedAxe.id, newCount) }, 3500)
      } else {
        const next = getNextLevel(newCount)
        setConfirmInfo(next ? { message: `Encore ${next.delta} action${next.delta > 1 ? 's' : ''} pour`, nextIcon: next.icon, nextLabel: next.label } : null)
        setShowConfirm(true)
        setTimeout(() => { setShowConfirm(false); setConfirmInfo(null); handleClose(); onSuccess?.(selectedAxe.id, newCount) }, 3500)
      }
    })
  }

  function goBack() {
    setShowCustom(false)
    setCustomText('')
    setRejectMsg(null)
    if (step === 'context') { setStep('axe'); setSelectedAxe(null) }
    else if (step === 'context-detail') { setStep('context'); setChosenContext(''); setContextDetail('') }
    else if (step === 'action') { setStep('context'); setChosenContext(''); setContextDetail('') }
    else if (step === 'result') { setStep('action'); setChosenAction('') }
  }

  if (!open) return null

  // Message du coach pour une étape (contextuel si dispo, sinon défaut)
  const getMsg = (s: ChatStep) => stepMessages[s] || DEFAULT_MESSAGES[s] || ''

  // Est-ce qu'on est en train de charger les suggestions pour l'étape courante ?
  const isLoadingStep =
    (step === 'context' && loadingContexts) ||
    (step === 'action' && loadingActions) ||
    (step === 'result' && loadingResults)

  // Rendu inline de la saisie libre (pas un sous-composant pour éviter les re-mount)
  function renderCustomInput(placeholder: string, onSubmit: () => void) {
    if (!showCustom) return null
    return (
      <>
        {rejectMsg && <CoachBubble text={rejectMsg} animate />}
        <div className="pl-10 space-y-2">
        <input
          type="text"
          value={customText}
          onChange={(e) => { setCustomText(e.target.value); if (rejectMsg) setRejectMsg(null) }}
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
      </>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {/* ── Animation d'intro (flash doré) ── */}
      {showIntro ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-auto overflow-hidden" style={{ border: '2px solid #f0ebe0' }}>
          <IntroAnimation />
        </div>
      ) : levelUpInfo ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-auto p-8 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <SparkleParticles />
          <div className="text-7xl animate-level-up mb-4">{levelUpInfo.icon}</div>
          <div className="animate-level-up-text">
            <p className="text-xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Niveau {levelUpInfo.label}</p>
            <p className="text-lg font-semibold" style={{ color: '#a0937c' }}>débloqué !</p>
            {valorisantMsg && (
              <p className="text-sm mt-3 italic" style={{ color: '#a0937c' }}>
                {valorisantMsg.emoji} {valorisantMsg.text}
              </p>
            )}
          </div>
        </div>
      ) : showConfirm ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-auto p-8 text-center" style={{ border: '2px solid #f0ebe0' }}>
          <SparkleParticles />
          <div className="text-5xl mb-3">{valorisantMsg?.emoji || '✅'}</div>
          <p className="text-xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Action ajoutée !</p>
          {valorisantMsg && (
            <p className="text-[13px] italic mt-1 px-2" style={{ color: '#a0937c' }}>
              {valorisantMsg.text}
            </p>
          )}
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
                style={{ background: '#fbbf24' }}>✨</div>
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
                <CoachBubble text={getMsg('axe')} />
                <UserBubble text={`${getDynamique(selectedAxe.completedCount).icon} ${selectedAxe.subject}`} />
              </>
            )}

            {/* Étape 2 répondue : contexte choisi */}
            {chosenContext && (step === 'context-detail' || step === 'action' || step === 'result') && (
              <>
                <CoachBubble text={getMsg('context')} />
                <UserBubble text={chosenContext} />
              </>
            )}

            {/* Étape 3 répondue : action choisie */}
            {chosenAction && step === 'result' && (
              <>
                <CoachBubble text={getMsg('action')} />
                <UserBubble text={chosenAction} />
              </>
            )}

            {/* ── Typing indicator pendant le chargement API ── */}
            {isLoadingStep && <TypingIndicator />}

            {/* ── Question en cours (masquée pendant le chargement) ── */}
            {!isLoadingStep && <CoachBubble text={getMsg(step)} animate />}

            {/* ── Étape 1 : Choix de l'axe ── */}
            {step === 'axe' && (
              <div className="pl-10 space-y-2 chat-options-in">
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
            {step === 'context' && !showCustom && !loadingContexts && (
              <div className="pl-10 space-y-2 chat-options-in">
                <SuggestionButtons items={contextSuggestions} onSelect={handleSelectContext} />
                <OtherButton onClick={() => { setShowCustom(true); setCustomText('') }} />
              </div>
            )}
            {step === 'context' && renderCustomInput('Décris le contexte...', handleCustomContext)}

            {/* ── Étape 2b : Précision contexte (texte libre + skip) ── */}
            {step === 'context-detail' && (
              <div className="pl-10 space-y-2 chat-bubble-in">
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
            {step === 'action' && !showCustom && !loadingActions && (
              <div className="pl-10 space-y-2 chat-options-in">
                <SuggestionButtons items={actionSuggestions} onSelect={handleSelectAction} />
                <OtherButton onClick={() => { setShowCustom(true); setCustomText('') }} />
              </div>
            )}
            {step === 'action' && renderCustomInput('Décris ce que tu as fait...', handleCustomAction)}

            {/* ── Étape 4 : Résultat ── */}
            {step === 'result' && !showCustom && !loadingResults && (
              <div className={`pl-10 space-y-2 chat-options-in ${isSubmitting ? 'opacity-50 pointer-events-none' : ''}`}>
                <SuggestionButtons items={resultSuggestions} onSelect={handleSelectResult} />
                <OtherButton onClick={() => { setShowCustom(true); setCustomText('') }} />
              </div>
            )}
            {step === 'result' && renderCustomInput('Qu\'as-tu observé comme résultat ?', handleCustomResult)}
          </div>
        </div>
      )}
    </div>
  )
}
