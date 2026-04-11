'use client'

import { useState, useEffect, useTransition } from 'react'
import { X, ChevronLeft } from 'lucide-react'
import { createAction } from '@/app/(learner)/axes/actions'
import { getNextLevel, getCurrentLevelIndex, getCurrentLevel, getDynamique } from '@/lib/axeHelpers'
import { useToast } from '@/app/components/Toast'

type AxeOption = {
  id: string
  subject: string
  completedCount: number
}

type Props = {
  axes: AxeOption[]
  open: boolean
  onClose: () => void
  onSuccess?: (axeId: string, newCount: number) => void
  onboardingMode?: boolean
  prefill?: { content: string; axeId: string } | null
}

const LEVEL_BORDER_COLORS: Record<number, string> = {
  0: '#94a3b8', // slate — Veille
  1: '#38bdf8', // sky — Impulsion
  2: '#34d399', // emerald — Rythme
  3: '#fb923c', // orange — Intensité
  4: '#fb7185', // rose — Propulsion
}

const LEVEL_BG_COLORS: Record<number, string> = {
  0: 'rgba(148,163,184,0.08)',
  1: 'rgba(56,189,248,0.08)',
  2: 'rgba(52,211,153,0.08)',
  3: 'rgba(251,146,60,0.08)',
  4: 'rgba(251,113,133,0.08)',
}

// ── Suggestions par famille d'axe ──────────────────────────────

type SuggestionSet = {
  keywords: string[]
  actions: string[]
  contexts: string[]
  results: string[]
}

const SUGGESTION_SETS: SuggestionSet[] = [
  {
    keywords: ['écoute', 'écouter', 'reformul', 'question', 'découverte', 'questionnement'],
    actions: [
      "J'ai posé une question ouverte",
      "J'ai reformulé ce que mon interlocuteur a dit",
      "J'ai laissé un silence après une question",
      "J'ai creusé une réponse vague avec un « c'est-à-dire ? »",
      "J'ai pris des notes pour rester concentré sur l'échange",
    ],
    contexts: ['Client', 'Collaborateur', 'Manager', 'Collègue', 'En réunion', 'En entretien'],
    results: [
      "Il/elle s'est ouvert(e) davantage",
      "J'ai obtenu une info que je n'avais pas",
      "L'échange a été plus fluide que d'habitude",
      "J'ai mieux compris sa position",
      "Ça a créé un climat de confiance",
    ],
  },
  {
    keywords: ['délég', 'autonomie', 'confier', 'responsabilis'],
    actions: [
      "J'ai confié une tâche que je faisais habituellement",
      "J'ai laissé quelqu'un prendre une décision seul",
      "J'ai résisté à l'envie de contrôler le résultat",
      "J'ai expliqué le pourquoi plutôt que le comment",
      "J'ai fait un point de suivi sans reprendre la main",
    ],
    contexts: ['Collaborateur', 'Équipe', 'En réunion', 'Sur un projet', 'En entretien'],
    results: [
      "La personne a pris confiance",
      "Le résultat était à la hauteur",
      "J'ai gagné du temps sur autre chose",
      "Ça a responsabilisé l'équipe",
      "J'ai été surpris(e) positivement",
    ],
  },
  {
    keywords: ['feedback', 'retour', 'recadra', 'félicit', 'reconnais'],
    actions: [
      "J'ai fait un retour positif spontané",
      "J'ai formulé un feedback correctif avec bienveillance",
      "J'ai dit précisément ce qui m'avait plu",
      "J'ai fait un retour dans l'heure plutôt que d'attendre",
      "J'ai séparé les faits de mon ressenti",
    ],
    contexts: ['Collaborateur', 'Collègue', 'En réunion', 'En entretien', 'Par message', 'Manager'],
    results: [
      "La personne a bien réagi",
      "Ça a ouvert une discussion constructive",
      "J'ai vu un changement dès la fois suivante",
      "Ça a renforcé notre relation",
      "C'était moins difficile que prévu",
    ],
  },
  {
    keywords: ['négo', 'concession', 'contrepartie', 'closing', 'prix', 'vente', 'vendre'],
    actions: [
      "J'ai préparé mes concessions et contreparties avant le RDV",
      "J'ai défendu ma position sans céder immédiatement",
      "J'ai demandé une contrepartie avant d'accorder un geste",
      "J'ai proposé la vente au bon moment",
      "J'ai reformulé l'objection avant d'y répondre",
    ],
    contexts: ['Client', 'Prospect', 'En RDV', 'Au téléphone', 'En visio', 'Par email'],
    results: [
      "Le client a accepté",
      "J'ai maintenu ma marge",
      "Ça a accéléré la décision",
      "J'ai obtenu un engagement concret",
      "Le client a compris la valeur",
    ],
  },
  {
    keywords: ['argument', 'argu', 'cabp', 'bénéfice', 'preuve', 'convaincre'],
    actions: [
      "J'ai structuré mon argument en bénéfice client",
      "J'ai appuyé mon argument avec une preuve concrète",
      "J'ai adapté mon discours au profil de mon interlocuteur",
      "J'ai mis en avant un bénéfice plutôt qu'une caractéristique",
      "J'ai préparé 3 arguments clés avant mon RDV",
    ],
    contexts: ['Client', 'Prospect', 'En présentation', 'En RDV', 'En réunion', 'Par email'],
    results: [
      "Mon interlocuteur a été convaincu",
      "J'ai senti une adhésion immédiate",
      "Il/elle a posé des questions d'intérêt",
      "Ça a fait la différence vs la concurrence",
      "J'étais plus à l'aise qu'avant",
    ],
  },
  {
    keywords: ['conflit', 'tension', 'asserti', 'dire non', 'cadre', 'recadrer', 'triangle'],
    actions: [
      "J'ai dit non en expliquant pourquoi",
      "J'ai exprimé mon désaccord calmement",
      "J'ai posé le cadre en début d'échange",
      "J'ai utilisé le DESC pour formuler ma demande",
      "J'ai identifié un jeu de triangle toxique et j'en suis sorti",
    ],
    contexts: ['Collaborateur', 'Manager', 'Collègue', 'En réunion', 'En entretien', 'Client'],
    results: [
      "La situation s'est apaisée",
      "Mon interlocuteur a respecté ma position",
      "On a trouvé un compromis",
      "J'ai gagné en crédibilité",
      "Ça m'a soulagé(e) de l'avoir fait",
    ],
  },
  {
    keywords: ['parole', 'oral', 'présent', 'voix', 'posture', 'discours', 'réunion', 'animer'],
    actions: [
      "J'ai marqué une pause avant de répondre",
      "J'ai structuré mon intervention en 3 points",
      "J'ai regardé mon auditoire au lieu de mes notes",
      "J'ai éliminé un mot parasite de mon discours",
      "J'ai soigné mon accroche pour capter l'attention",
    ],
    contexts: ['En réunion', 'En présentation', 'Devant l\'équipe', 'En comité', 'Face à un client', 'En visio'],
    results: [
      "J'ai senti l'attention du public",
      "On m'a fait un retour positif",
      "J'étais plus à l'aise que d'habitude",
      "Mon message est passé clairement",
      "J'ai tenu mon timing",
    ],
  },
  {
    keywords: ['objectif', 'smart', 'pilotage', 'organis', 'priorité', 'temps', 'planif'],
    actions: [
      "J'ai formulé un objectif SMART pour un collaborateur",
      "J'ai priorisé mes tâches en début de journée",
      "J'ai dit non à une tâche non prioritaire",
      "J'ai fait un point d'avancement structuré",
      "J'ai planifié ma semaine en bloquant du temps pour l'essentiel",
    ],
    contexts: ['Avec l\'équipe', 'En entretien', 'Pour moi-même', 'En réunion', 'Avec mon manager'],
    results: [
      "J'ai été plus efficace",
      "Le collaborateur savait exactement quoi faire",
      "J'ai dégagé du temps pour l'important",
      "Ça a clarifié les attentes",
      "J'ai réduit mon stress",
    ],
  },
  {
    keywords: ['motiv', 'engag', 'remotiv', 'encourager', 'impliquer'],
    actions: [
      "J'ai pris le temps de comprendre ce qui freine un collaborateur",
      "J'ai valorisé une réussite devant l'équipe",
      "J'ai adapté une mission au profil de la personne",
      "J'ai demandé son avis avant de décider",
      "J'ai donné du sens à une tâche ingrate",
    ],
    contexts: ['Collaborateur', 'Équipe', 'En réunion', 'En one-to-one', 'En entretien'],
    results: [
      "J'ai vu un regain d'énergie",
      "La personne s'est investie davantage",
      "Ça a amélioré l'ambiance",
      "Il/elle m'a remercié(e)",
      "L'équipe a suivi le mouvement",
    ],
  },
  {
    keywords: ['disc', 'profil', 'adapter', 'communic', 'style'],
    actions: [
      "J'ai identifié le profil DISC de mon interlocuteur",
      "J'ai adapté mon rythme à un profil Stable",
      "J'ai été plus direct avec un profil Dominant",
      "J'ai mis plus de convivialité avec un profil Influent",
      "J'ai donné plus de détails à un profil Consciencieux",
    ],
    contexts: ['Collaborateur', 'Client', 'Manager', 'Collègue', 'En réunion', 'En entretien'],
    results: [
      "L'échange a été plus fluide",
      "J'ai senti que ça passait mieux",
      "La personne s'est détendue",
      "J'ai obtenu ce que je voulais plus facilement",
      "J'ai compris pourquoi ça coinçait avant",
    ],
  },
]

// Fallback générique si aucun keyword ne matche
const DEFAULT_SUGGESTIONS: SuggestionSet = {
  keywords: [],
  actions: [
    "J'ai mis en pratique un truc vu en formation",
    "J'ai testé une nouvelle approche",
    "J'ai osé faire différemment",
    "J'ai pris du recul avant de réagir",
    "J'ai préparé un échange important",
  ],
  contexts: ['Collaborateur', 'Client', 'Manager', 'Collègue', 'En réunion', 'En entretien'],
  results: [
    "Ça a bien fonctionné",
    "J'ai vu une différence",
    "C'était encourageant",
    "J'ai été surpris(e) du résultat",
    "Ça m'a donné envie de continuer",
  ],
}

function findSuggestionSet(axeSubject: string): SuggestionSet {
  const lower = axeSubject.toLowerCase()
  for (const set of SUGGESTION_SETS) {
    if (set.keywords.some(kw => lower.includes(kw))) return set
  }
  return DEFAULT_SUGGESTIONS
}

function pickRandom<T>(arr: T[], count: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

// ── Composant ──────────────────────────────────────────────────

type ChatStep = 'axe' | 'action' | 'context' | 'result' | 'confirm'

export default function QuickAddAction({ axes, open, onClose, onSuccess, onboardingMode, prefill }: Props) {
  const [step, setStep] = useState<ChatStep>('axe')
  const [selectedAxe, setSelectedAxe] = useState<AxeOption | null>(null)
  const [chosenAction, setChosenAction] = useState('')
  const [chosenContext, setChosenContext] = useState('')
  const [chosenResult, setChosenResult] = useState('')
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [levelUpInfo, setLevelUpInfo] = useState<{ icon: string; label: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmInfo, setConfirmInfo] = useState<{ message: string; nextIcon: string; nextLabel: string } | null>(null)
  const [actionSuggestions, setActionSuggestions] = useState<string[]>([])
  const [resultSuggestions, setResultSuggestions] = useState<string[]>([])
  const [contextOptions, setContextOptions] = useState<string[]>([])
  const { toast } = useToast()

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
    setChosenAction('')
    setChosenContext('')
    setChosenResult('')
    setCustomText('')
    setShowCustom(false)
    setLevelUpInfo(null)
    setShowConfirm(false)
    setConfirmInfo(null)
    setActionSuggestions([])
    setResultSuggestions([])
    setContextOptions([])
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSelectAxe(axe: AxeOption) {
    setSelectedAxe(axe)
    const set = findSuggestionSet(axe.subject)
    setActionSuggestions(pickRandom(set.actions, 3))
    setContextOptions(set.contexts)
    setResultSuggestions(pickRandom(set.results, 3))
    setStep('action')
    setShowCustom(false)
    setCustomText('')
  }

  function handleSelectAction(action: string) {
    setChosenAction(action)
    setShowCustom(false)
    setCustomText('')
    setStep('context')
  }

  function handleCustomAction() {
    if (!customText.trim()) return
    setChosenAction(customText.trim())
    setShowCustom(false)
    setCustomText('')
    setStep('context')
  }

  function handleSelectContext(ctx: string) {
    setChosenContext(ctx)
    setShowCustom(false)
    setCustomText('')
    setStep('result')
  }

  function handleSelectResult(result: string) {
    setChosenResult(result)
    setShowCustom(false)
    setCustomText('')
    // Soumettre directement
    submitAction(chosenAction, chosenContext, result)
  }

  function handleCustomResult() {
    if (!customText.trim()) return
    const result = customText.trim()
    setChosenResult(result)
    setShowCustom(false)
    setCustomText('')
    submitAction(chosenAction, chosenContext, result)
  }

  function buildDescription(action: string, context: string, result: string): string {
    return `${action}, ${context.toLowerCase().startsWith('en ') || context.toLowerCase().startsWith('au ') || context.toLowerCase().startsWith('par ') || context.toLowerCase().startsWith('sur ') || context.toLowerCase().startsWith('pour ') || context.toLowerCase().startsWith('devant ') || context.toLowerCase().startsWith('face ') || context.toLowerCase().startsWith('avec ') ? context.toLowerCase() : 'avec ' + context.toLowerCase().replace(/^(un |une |le |la |les |mon |ma |mes )/, '')}. ${result}`
  }

  function submitAction(action: string, context: string, result: string) {
    if (!selectedAxe) return

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
    if (step === 'action') { setStep('axe'); setSelectedAxe(null) }
    else if (step === 'context') { setStep('action'); setChosenAction('') }
    else if (step === 'result') { setStep('context'); setChosenContext('') }
  }

  if (!open) return null

  // Titres de chat pour chaque étape
  const chatTitles: Record<ChatStep, string> = {
    axe: '💪 Sur quoi tu as agi ?',
    action: '🎯 Qu\'est-ce que tu as fait ?',
    context: '👤 C\'était dans quel contexte ?',
    result: '✨ Qu\'as-tu observé ?',
    confirm: '',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={handleClose} />

      {levelUpInfo ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-4 p-8 text-center animate-fade-in-up" style={{ border: '2px solid #f0ebe0' }}>
          <div className="text-7xl animate-level-up mb-4">{levelUpInfo.icon}</div>
          <div className="animate-level-up-text">
            <p className="text-xl font-bold mb-1" style={{ color: '#1a1a2e' }}>Niveau {levelUpInfo.label}</p>
            <p className="text-lg font-semibold" style={{ color: '#a0937c' }}>débloqué !</p>
            <p className="text-sm mt-3" style={{ color: '#a0937c' }}>Continue comme ça 💪</p>
          </div>
        </div>
      ) : showConfirm ? (
        <div className="relative bg-white rounded-[28px] shadow-2xl w-full max-w-xs mx-4 p-8 text-center animate-fade-in-up" style={{ border: '2px solid #f0ebe0' }}>
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
        <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl w-full max-w-md mx-0 sm:mx-4 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-fade-in-up" style={{ border: '2px solid #f0ebe0' }}>
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
        /* Mode chatbot — flow en 4 étapes */
        <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl w-full max-w-md mx-0 sm:mx-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] animate-fade-in-up overflow-hidden" style={{ border: '2px solid #f0ebe0' }}>

          {/* Header chat-style */}
          <div className="px-5 py-4 flex items-center gap-3" style={{ background: '#1a1a2e' }}>
            {step !== 'axe' && (
              <button onClick={goBack} className="text-white/60 active:text-white">
                <ChevronLeft size={20} />
              </button>
            )}
            <div className="flex-1">
              <p className="text-white font-bold text-[15px]">{chatTitles[step]}</p>
              {selectedAxe && step !== 'axe' && (
                <p className="text-white/50 text-xs mt-0.5">{getDynamique(selectedAxe.completedCount).icon} {selectedAxe.subject}</p>
              )}
            </div>
            <button onClick={handleClose} className="text-white/40 active:text-white">
              <X size={20} />
            </button>
          </div>

          <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
            {/* ── Étape 1 : Choix de l'axe ── */}
            {step === 'axe' && axes.map((axe) => {
              const levelIdx = getCurrentLevelIndex(axe.completedCount)
              const marker = getDynamique(axe.completedCount)
              const borderColor = LEVEL_BORDER_COLORS[levelIdx] ?? LEVEL_BORDER_COLORS[0]
              const bgColor = LEVEL_BG_COLORS[levelIdx] ?? LEVEL_BG_COLORS[0]
              return (
                <button
                  key={axe.id}
                  onClick={() => handleSelectAxe(axe)}
                  className="w-full text-left p-4 rounded-xl transition-all active:scale-[0.98]"
                  style={{ background: bgColor, border: `2px solid ${borderColor}` }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                      style={{ background: `linear-gradient(135deg, ${borderColor}, ${borderColor}dd)` }}>
                      <span className="drop-shadow-sm">{marker.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 truncate">{axe.subject}</p>
                      <p className="text-xs text-gray-500">{axe.completedCount} action{axe.completedCount !== 1 ? 's' : ''} · {marker.label}</p>
                    </div>
                  </div>
                </button>
              )
            })}

            {/* ── Étape 2 : Qu'est-ce que tu as fait ? ── */}
            {step === 'action' && !showCustom && (
              <>
                {actionSuggestions.map((s, i) => (
                  <button key={i} onClick={() => handleSelectAction(s)}
                    className="w-full text-left px-4 py-3 rounded-xl text-[14px] font-medium transition-all active:scale-[0.98]"
                    style={{ background: '#faf8f4', border: '1.5px solid #f0ebe0', color: '#1a1a2e' }}>
                    {s}
                  </button>
                ))}
                <button onClick={() => { setShowCustom(true); setCustomText('') }}
                  className="w-full text-left px-4 py-3 rounded-xl text-[14px] transition-all active:scale-[0.98]"
                  style={{ background: 'transparent', border: '1.5px dashed #d0c8b8', color: '#a0937c' }}>
                  ✏️ Autre chose...
                </button>
              </>
            )}

            {/* ── Étape 2 bis : Saisie libre ── */}
            {step === 'action' && showCustom && (
              <div className="space-y-3">
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="input w-full h-20 resize-none text-[14px]"
                  placeholder="Décris ce que tu as fait..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowCustom(false)} className="btn-secondary flex-1 text-sm">← Retour</button>
                  <button onClick={handleCustomAction} disabled={!customText.trim()}
                    className="btn-primary flex-1 text-sm disabled:opacity-50">Valider</button>
                </div>
              </div>
            )}

            {/* ── Étape 3 : Contexte ── */}
            {step === 'context' && (
              <>
                {/* Rappel du choix */}
                <div className="px-3 py-2 rounded-lg text-[12px] mb-1" style={{ background: '#fef3c7', color: '#92400e' }}>
                  ✅ {chosenAction}
                </div>
                <div className="flex flex-wrap gap-2">
                  {contextOptions.map((ctx, i) => (
                    <button key={i} onClick={() => handleSelectContext(ctx)}
                      className="px-4 py-2.5 rounded-full text-[13px] font-semibold transition-all active:scale-95"
                      style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                      {ctx}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Étape 4 : Résultat ── */}
            {step === 'result' && !showCustom && (
              <>
                {/* Rappel des choix */}
                <div className="px-3 py-2 rounded-lg text-[12px] space-y-1" style={{ background: '#fef3c7', color: '#92400e' }}>
                  <p>✅ {chosenAction}</p>
                  <p>👤 {chosenContext}</p>
                </div>
                {resultSuggestions.map((s, i) => (
                  <button key={i} onClick={() => handleSelectResult(s)}
                    className="w-full text-left px-4 py-3 rounded-xl text-[14px] font-medium transition-all active:scale-[0.98]"
                    style={{ background: '#faf8f4', border: '1.5px solid #f0ebe0', color: '#1a1a2e' }}>
                    {s}
                  </button>
                ))}
                <button onClick={() => { setShowCustom(true); setCustomText('') }}
                  className="w-full text-left px-4 py-3 rounded-xl text-[14px] transition-all active:scale-[0.98]"
                  style={{ background: 'transparent', border: '1.5px dashed #d0c8b8', color: '#a0937c' }}>
                  ✏️ Autre chose...
                </button>
              </>
            )}

            {/* ── Étape 4 bis : Saisie libre résultat ── */}
            {step === 'result' && showCustom && (
              <div className="space-y-3">
                <div className="px-3 py-2 rounded-lg text-[12px] space-y-1" style={{ background: '#fef3c7', color: '#92400e' }}>
                  <p>✅ {chosenAction}</p>
                  <p>👤 {chosenContext}</p>
                </div>
                <textarea
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  className="input w-full h-20 resize-none text-[14px]"
                  placeholder="Qu'as-tu observé comme résultat ?"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowCustom(false)} className="btn-secondary flex-1 text-sm">← Retour</button>
                  <button onClick={handleCustomResult} disabled={isPending || !customText.trim()}
                    className="btn-primary flex-1 text-sm disabled:opacity-50">
                    {isPending ? '...' : 'Valider'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
