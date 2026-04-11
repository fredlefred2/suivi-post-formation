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
  who: string[]
  where: string[]
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
    who: ['Un client', 'Un collaborateur', 'Mon manager', 'Un collègue', 'Un prospect'],
    where: ['En réunion', 'En entretien', 'Au téléphone', 'En RDV', 'En visio', 'En informel'],
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
    who: ['Un collaborateur', 'Un membre de l\'équipe', 'Un collègue', 'Un alternant'],
    where: ['En réunion', 'En entretien', 'Sur un projet', 'Au quotidien'],
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
    who: ['Un collaborateur', 'Un collègue', 'Mon manager', 'Un membre de l\'équipe'],
    where: ['En entretien', 'En réunion', 'Par message', 'En one-to-one', 'En informel'],
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
    who: ['Un client', 'Un prospect', 'Un acheteur', 'Un décideur'],
    where: ['En RDV', 'Au téléphone', 'En visio', 'Par email', 'En salon'],
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
    who: ['Un client', 'Un prospect', 'Un décideur', 'Un interlocuteur'],
    where: ['En présentation', 'En RDV', 'En réunion', 'Par email', 'Au téléphone'],
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
    who: ['Un collaborateur', 'Mon manager', 'Un collègue', 'Un client'],
    where: ['En réunion', 'En entretien', 'En one-to-one', 'Par téléphone', 'En informel'],
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
    who: ['Mon équipe', 'Un groupe', 'Un client', 'Un comité', 'Mon manager'],
    where: ['En réunion', 'En présentation', 'En comité de direction', 'En visio', 'Devant un public'],
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
    who: ['Un collaborateur', 'Mon équipe', 'Mon manager', 'Moi-même'],
    where: ['En entretien', 'En réunion', 'Au quotidien', 'En point de suivi'],
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
    who: ['Un collaborateur', 'Un membre de l\'équipe', 'Mon équipe', 'Un collègue'],
    where: ['En réunion', 'En one-to-one', 'En entretien', 'Au quotidien', 'En informel'],
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
    who: ['Un collaborateur', 'Un client', 'Mon manager', 'Un collègue', 'Un prospect'],
    where: ['En réunion', 'En entretien', 'En RDV', 'Au téléphone', 'En informel'],
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
  who: ['Un collaborateur', 'Un client', 'Mon manager', 'Un collègue'],
  where: ['En réunion', 'En entretien', 'Au téléphone', 'Au quotidien', 'En informel'],
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

// ── Sous-questions conditionnelles (texte libre + skip) ───────

const WHO_PRECISION: Record<string, { question: string; placeholder: string }> = {
  'Un client': { question: 'Tu peux préciser qui ?', placeholder: 'Ex : Sophie, le directeur achats...' },
  'Un prospect': { question: 'Tu peux préciser qui ?', placeholder: 'Ex : la société Duval, le contact web...' },
}

const WHERE_PRECISION: Record<string, { question: string; placeholder: string }> = {
  'En réunion': { question: 'Quel type de réunion ?', placeholder: 'Ex : réunion d\'équipe, comité de direction...' },
}

// ── Composant ──────────────────────────────────────────────────

type ChatStep = 'axe' | 'action' | 'who' | 'who-detail' | 'where' | 'where-detail' | 'result' | 'confirm'

export default function QuickAddAction({ axes, open, onClose, onSuccess, onboardingMode, prefill }: Props) {
  const [step, setStep] = useState<ChatStep>('axe')
  const [selectedAxe, setSelectedAxe] = useState<AxeOption | null>(null)
  const [chosenAction, setChosenAction] = useState('')
  const [chosenWho, setChosenWho] = useState('')
  const [chosenWhere, setChosenWhere] = useState('')
  const [chosenResult, setChosenResult] = useState('')
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [levelUpInfo, setLevelUpInfo] = useState<{ icon: string; label: string } | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmInfo, setConfirmInfo] = useState<{ message: string; nextIcon: string; nextLabel: string } | null>(null)
  const [actionSuggestions, setActionSuggestions] = useState<string[]>([])
  const [resultSuggestions, setResultSuggestions] = useState<string[]>([])
  const [loadingResults, setLoadingResults] = useState(false)
  const [whoOptions, setWhoOptions] = useState<string[]>([])
  const [whereOptions, setWhereOptions] = useState<string[]>([])
  const [whoBase, setWhoBase] = useState('')
  const [whoDetailQuestion, setWhoDetailQuestion] = useState('')
  const [whoDetailPlaceholder, setWhoDetailPlaceholder] = useState('')
  const [whereBase, setWhereBase] = useState('')
  const [whereDetailQuestion, setWhereDetailQuestion] = useState('')
  const [whereDetailPlaceholder, setWhereDetailPlaceholder] = useState('')
  const [detailText, setDetailText] = useState('')
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
    setChosenWho('')
    setChosenWhere('')
    setChosenResult('')
    setCustomText('')
    setShowCustom(false)
    setLevelUpInfo(null)
    setShowConfirm(false)
    setConfirmInfo(null)
    setActionSuggestions([])
    setResultSuggestions([])
    setLoadingResults(false)
    setWhoOptions([])
    setWhereOptions([])
    setWhoBase('')
    setWhoDetailQuestion('')
    setWhoDetailPlaceholder('')
    setWhereBase('')
    setWhereDetailQuestion('')
    setWhereDetailPlaceholder('')
    setDetailText('')
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleSelectAxe(axe: AxeOption) {
    setSelectedAxe(axe)
    const set = findSuggestionSet(axe.subject)
    setActionSuggestions(pickRandom(set.actions, 3))
    setWhoOptions(set.who)
    setWhereOptions(set.where)
    setStep('action')
    setShowCustom(false)
    setCustomText('')
  }

  function handleSelectAction(action: string) {
    setChosenAction(action)
    setShowCustom(false)
    setCustomText('')
    setStep('who')
  }

  function handleCustomAction() {
    if (!customText.trim()) return
    setChosenAction(customText.trim())
    setShowCustom(false)
    setCustomText('')
    setStep('who')
  }

  function handleSelectWho(who: string) {
    setShowCustom(false)
    setCustomText('')
    const precision = WHO_PRECISION[who]
    if (precision) {
      setWhoBase(who)
      setWhoDetailQuestion(precision.question)
      setWhoDetailPlaceholder(precision.placeholder)
      setDetailText('')
      setStep('who-detail')
    } else {
      setWhoBase('')
      setChosenWho(who)
      setStep('where')
    }
  }

  function handleWhoDetailSubmit() {
    const detail = detailText.trim()
    setChosenWho(detail ? `${whoBase} (${detail})` : whoBase)
    setDetailText('')
    setStep('where')
  }

  function handleWhoDetailSkip() {
    setChosenWho(whoBase)
    setDetailText('')
    setStep('where')
  }

  async function fetchResultSuggestions(action: string, who: string, where: string) {
    setLoadingResults(true)
    setResultSuggestions([])
    try {
      const res = await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, who, where, axeSubject: selectedAxe?.subject }),
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
      console.error('[Suggestions] fetch error:', err)
    }
    // Fallback : suggestions statiques si l'API échoue
    const set = selectedAxe ? findSuggestionSet(selectedAxe.subject) : DEFAULT_SUGGESTIONS
    setResultSuggestions(pickRandom(set.results, 3))
    setLoadingResults(false)
  }

  function handleSelectWhere(where: string) {
    setShowCustom(false)
    setCustomText('')
    const precision = WHERE_PRECISION[where]
    if (precision) {
      setWhereBase(where)
      setWhereDetailQuestion(precision.question)
      setWhereDetailPlaceholder(precision.placeholder)
      setDetailText('')
      setStep('where-detail')
    } else {
      setWhereBase('')
      setChosenWhere(where)
      setStep('result')
      fetchResultSuggestions(chosenAction, chosenWho, where)
    }
  }

  function handleWhereDetailSubmit() {
    const detail = detailText.trim()
    const finalWhere = detail || whereBase
    setChosenWhere(finalWhere)
    setDetailText('')
    setStep('result')
    fetchResultSuggestions(chosenAction, chosenWho, finalWhere)
  }

  function handleWhereDetailSkip() {
    setChosenWhere(whereBase)
    setDetailText('')
    setStep('result')
    fetchResultSuggestions(chosenAction, chosenWho, whereBase)
  }

  function handleSelectResult(result: string) {
    setChosenResult(result)
    setShowCustom(false)
    setCustomText('')
    submitAction(chosenAction, chosenWho, chosenWhere, result)
  }

  function handleCustomResult() {
    if (!customText.trim()) return
    const result = customText.trim()
    setChosenResult(result)
    setShowCustom(false)
    setCustomText('')
    submitAction(chosenAction, chosenWho, chosenWhere, result)
  }

  function buildDescription(action: string, who: string, where: string, result: string): string {
    // "avec un client fidèle" / "avec mon manager"
    const whoLower = who.toLowerCase()
    const whoPart = whoLower.startsWith('un ') || whoLower.startsWith('une ') || whoLower.startsWith('mon ') || whoLower.startsWith('ma ') || whoLower.startsWith('l\'')
      ? 'avec ' + whoLower
      : 'avec ' + whoLower
    // "en réunion d'équipe" / "au téléphone"
    const whereLower = where.toLowerCase()
    const wherePart = whereLower.startsWith('en ') || whereLower.startsWith('au ') || whereLower.startsWith('par ') || whereLower.startsWith('sur ') || whereLower.startsWith('devant ')
      ? whereLower
      : 'en ' + whereLower
    return `${action}, ${whoPart}, ${wherePart}. ${result}`
  }

  function submitAction(action: string, who: string, where: string, result: string) {
    if (!selectedAxe) return

    const description = buildDescription(action, who, where, result)

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
    else if (step === 'who') { setStep('action'); setChosenAction('') }
    else if (step === 'who-detail') { setStep('who'); setWhoBase(''); setDetailText('') }
    else if (step === 'where') { setStep(whoBase ? 'who-detail' : 'who'); setChosenWho('') }
    else if (step === 'where-detail') { setStep('where'); setWhereBase(''); setDetailText('') }
    else if (step === 'result') { setStep(whereBase ? 'where-detail' : 'where'); setChosenWhere('') }
  }

  if (!open) return null

  // Messages du coach selon l'étape
  const coachMessages: Record<ChatStep, string> = {
    axe: 'Hey ! Tu as agi sur quel axe ?',
    action: 'Top ! Raconte-moi, qu\'est-ce que tu as fait ?',
    who: 'Bien joué ! C\'était avec qui ?',
    'who-detail': whoDetailQuestion,
    where: 'OK ! Et dans quel cadre ?',
    'where-detail': whereDetailQuestion,
    result: 'Et alors, qu\'est-ce que ça a donné ?',
    confirm: '',
  }

  // Bulle coach (alignée à gauche)
  function CoachBubble({ text }: { text: string }) {
    return (
      <div className="flex gap-2.5 items-start animate-fade-in-up">
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
      <div className="flex justify-end animate-fade-in-up">
        <div className="rounded-2xl rounded-tr-md px-4 py-2.5 max-w-[85%] text-[14px] font-medium"
          style={{ background: '#1a1a2e', color: '#fbbf24' }}>
          {text}
        </div>
      </div>
    )
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
        /* Mode chatbot conversationnel */
        <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl w-full max-w-md mx-0 sm:mx-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-fade-in-up overflow-hidden" style={{ border: '2px solid #f0ebe0' }}>

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

          {/* Zone de chat */}
          <div className="px-4 py-4 space-y-3 max-h-[65vh] min-h-[200px] overflow-y-auto" style={{ background: '#faf8f4' }}>

            {/* ── Historique des réponses précédentes ── */}

            {/* Étape 1 répondue : axe choisi */}
            {selectedAxe && step !== 'axe' && (
              <>
                <CoachBubble text={coachMessages.axe} />
                <UserBubble text={`${getDynamique(selectedAxe.completedCount).icon} ${selectedAxe.subject}`} />
              </>
            )}

            {/* Étape 2 répondue : action choisie */}
            {chosenAction && (step === 'who' || step === 'who-detail' || step === 'where' || step === 'where-detail' || step === 'result') && (
              <>
                <CoachBubble text={coachMessages.action} />
                <UserBubble text={chosenAction} />
              </>
            )}

            {/* Étape 3 répondue : avec qui */}
            {(whoBase || chosenWho) && (step === 'who-detail' || step === 'where' || step === 'where-detail' || step === 'result') && (
              <>
                <CoachBubble text="Bien joué ! C'était avec qui ?" />
                <UserBubble text={whoBase || chosenWho} />
              </>
            )}

            {/* Étape 3b répondue : précision who */}
            {whoBase && chosenWho && (step === 'where' || step === 'where-detail' || step === 'result') && (
              <>
                <CoachBubble text={whoDetailQuestion} />
                <UserBubble text={chosenWho} />
              </>
            )}

            {/* Étape 4 répondue : dans quel cadre */}
            {(whereBase || chosenWhere) && (step === 'where-detail' || step === 'result') && (
              <>
                <CoachBubble text="OK ! Et dans quel cadre ?" />
                <UserBubble text={whereBase || chosenWhere} />
              </>
            )}

            {/* Étape 4b répondue : précision where */}
            {whereBase && chosenWhere && step === 'result' && (
              <>
                <CoachBubble text={whereDetailQuestion} />
                <UserBubble text={chosenWhere} />
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

            {/* ── Étape 2 : Suggestions d'action ── */}
            {step === 'action' && !showCustom && (
              <div className="pl-10 space-y-2">
                {actionSuggestions.map((s, i) => (
                  <button key={i} onClick={() => handleSelectAction(s)}
                    className="w-full text-left px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] transition-all active:scale-[0.98]"
                    style={{ background: 'white', border: '1.5px solid #e8e0d4', color: '#1a1a2e' }}>
                    {s}
                  </button>
                ))}
                <button onClick={() => { setShowCustom(true); setCustomText('') }}
                  className="w-full text-left px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] font-medium transition-all active:scale-[0.98]"
                  style={{ background: '#f0ebe0', border: '1.5px solid #e8e0d4', color: '#1a1a2e' }}>
                  Autre chose...
                </button>
              </div>
            )}

            {/* ── Étape 2 bis : Saisie libre action ── */}
            {step === 'action' && showCustom && (
              <div className="pl-10 space-y-2">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && customText.trim()) { e.preventDefault(); handleCustomAction() } }}
                  className="w-full rounded-2xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:ring-2"
                  style={{ border: '1.5px solid #e8e0d4', background: 'white' }}
                  placeholder="Décris ce que tu as fait..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowCustom(false)}
                    className="text-[12px] px-3 py-1.5 rounded-full font-medium" style={{ color: '#a0937c' }}>
                    ← Retour
                  </button>
                  {customText.trim() && (
                    <button onClick={handleCustomAction}
                      className="text-[12px] px-4 py-1.5 rounded-full font-semibold"
                      style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                      Envoyer
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Étape 3 : Avec qui ? ── */}
            {step === 'who' && (
              <div className="pl-10 flex flex-wrap gap-2">
                {whoOptions.map((w, i) => (
                  <button key={i} onClick={() => handleSelectWho(w)}
                    className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-all active:scale-95"
                    style={{ background: 'white', border: '1.5px solid #e8e0d4', color: '#1a1a2e' }}>
                    {w}
                  </button>
                ))}
              </div>
            )}

            {/* ── Étape 3b : Précision who (texte libre + passer) ── */}
            {step === 'who-detail' && (
              <div className="pl-10 space-y-2">
                <input
                  type="text"
                  value={detailText}
                  onChange={(e) => setDetailText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleWhoDetailSubmit() } }}
                  className="w-full rounded-2xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:ring-2"
                  style={{ border: '1.5px solid #e8e0d4', background: 'white' }}
                  placeholder={whoDetailPlaceholder}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleWhoDetailSkip}
                    className="text-[12px] px-3 py-1.5 rounded-full font-medium" style={{ color: '#a0937c' }}>
                    Passer →
                  </button>
                  {detailText.trim() && (
                    <button onClick={handleWhoDetailSubmit}
                      className="text-[12px] px-4 py-1.5 rounded-full font-semibold"
                      style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                      OK
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Étape 4 : Dans quel cadre ? ── */}
            {step === 'where' && (
              <div className="pl-10 flex flex-wrap gap-2">
                {whereOptions.map((w, i) => (
                  <button key={i} onClick={() => handleSelectWhere(w)}
                    className="px-3.5 py-2 rounded-full text-[13px] font-medium transition-all active:scale-95"
                    style={{ background: 'white', border: '1.5px solid #e8e0d4', color: '#1a1a2e' }}>
                    {w}
                  </button>
                ))}
              </div>
            )}

            {/* ── Étape 4b : Précision where (texte libre + passer) ── */}
            {step === 'where-detail' && (
              <div className="pl-10 space-y-2">
                <input
                  type="text"
                  value={detailText}
                  onChange={(e) => setDetailText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleWhereDetailSubmit() } }}
                  className="w-full rounded-2xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:ring-2"
                  style={{ border: '1.5px solid #e8e0d4', background: 'white' }}
                  placeholder={whereDetailPlaceholder}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleWhereDetailSkip}
                    className="text-[12px] px-3 py-1.5 rounded-full font-medium" style={{ color: '#a0937c' }}>
                    Passer →
                  </button>
                  {detailText.trim() && (
                    <button onClick={handleWhereDetailSubmit}
                      className="text-[12px] px-4 py-1.5 rounded-full font-semibold"
                      style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                      OK
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Étape 5 : Résultat (suggestions IA) ── */}
            {step === 'result' && !showCustom && loadingResults && (
              <div className="pl-10">
                <div className="flex gap-1.5 items-center px-3.5 py-2.5 text-[13px]" style={{ color: '#a0937c' }}>
                  <span className="animate-bounce" style={{ animationDelay: '0ms' }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: '150ms' }}>·</span>
                  <span className="animate-bounce" style={{ animationDelay: '300ms' }}>·</span>
                  <span className="ml-1.5">Je réfléchis...</span>
                </div>
              </div>
            )}
            {step === 'result' && !showCustom && !loadingResults && (
              <div className="pl-10 space-y-2">
                {resultSuggestions.map((s, i) => (
                  <button key={i} onClick={() => handleSelectResult(s)}
                    className="w-full text-left px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] transition-all active:scale-[0.98] animate-fade-in-up"
                    style={{ background: 'white', border: '1.5px solid #e8e0d4', color: '#1a1a2e', animationDelay: `${i * 100}ms` }}>
                    {s}
                  </button>
                ))}
                <button onClick={() => { setShowCustom(true); setCustomText('') }}
                  className="w-full text-left px-3.5 py-2.5 rounded-2xl rounded-tl-md text-[13px] font-medium transition-all active:scale-[0.98]"
                  style={{ background: '#f0ebe0', border: '1.5px solid #e8e0d4', color: '#1a1a2e' }}>
                  Autre chose...
                </button>
              </div>
            )}

            {/* ── Étape 5 bis : Saisie libre résultat ── */}
            {step === 'result' && showCustom && (
              <div className="pl-10 space-y-2">
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && customText.trim()) { e.preventDefault(); handleCustomResult() } }}
                  className="w-full rounded-2xl px-3.5 py-2.5 text-[13px] focus:outline-none focus:ring-2"
                  style={{ border: '1.5px solid #e8e0d4', background: 'white' }}
                  placeholder="Qu'as-tu observé comme résultat ?"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={() => setShowCustom(false)}
                    className="text-[12px] px-3 py-1.5 rounded-full font-medium" style={{ color: '#a0937c' }}>
                    ← Retour
                  </button>
                  {customText.trim() && (
                    <button onClick={handleCustomResult} disabled={isPending}
                      className="text-[12px] px-4 py-1.5 rounded-full font-semibold disabled:opacity-40"
                      style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                      {isPending ? '...' : 'Envoyer'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
