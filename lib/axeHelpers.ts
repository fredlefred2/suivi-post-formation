// Helpers partagés pour la dynamique d'action (dashboard, axes, team)

export const MARKERS = [
  { icon: '⚪', pos: 0      },  // 0 actions
  { icon: '👣', pos: 1 / 9  },  // 1 action
  { icon: '🥁', pos: 3 / 9  },  // 3 actions
  { icon: '🔥', pos: 6 / 9  },  // 6 actions
  { icon: '🚀', pos: 1      },  // 9 actions
]

export function getDynamique(count: number) {
  if (count === 0) return { label: 'Veille',       icon: '⚪', color: 'text-slate-700   bg-slate-100   border-slate-300',   delta: 1 }
  if (count <= 2) return { label: 'Impulsion',    icon: '👣', color: 'text-sky-800    bg-sky-100    border-sky-300',    delta: 3 - count }
  if (count <= 5) return { label: 'Rythme',       icon: '🥁', color: 'text-emerald-800 bg-emerald-100 border-emerald-300', delta: 6 - count }
  if (count <= 8) return { label: 'Intensité',    icon: '🔥', color: 'text-orange-800  bg-orange-100  border-orange-300',  delta: 9 - count }
  return               { label: 'Propulsion',   icon: '🚀', color: 'text-rose-800    bg-rose-100    border-rose-300',    delta: 0 }
}

export function getCurrentLevelIndex(count: number) {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 8) return 3
  return 4
}

export function getProgress(count: number) {
  if (count >= 9) return 100
  return Math.round((count / 9) * 100)
}

export function getCurrentLevel(count: number) {
  if (count === 0) return { label: 'Veille',       icon: '⚪' }
  if (count <= 2) return { label: 'Impulsion',    icon: '👣' }
  if (count <= 5) return { label: 'Rythme',       icon: '🥁' }
  if (count <= 8) return { label: 'Intensité',    icon: '🔥' }
  return              { label: 'Propulsion',   icon: '🚀' }
}

// Infos sur le prochain niveau (pour les toasts "encore X pour...")
export function getNextLevel(count: number): { icon: string; label: string; delta: number } | null {
  const dyn = getDynamique(count)
  if (dyn.delta === 0) return null // Déjà au max (Propulsion)
  const nextCount = count + dyn.delta
  const next = getCurrentLevel(nextCount)
  return { icon: next.icon, label: next.label, delta: dyn.delta }
}

// Icône de phase selon le rang chronologique de l'action (1-indexed)
export function getActionPhaseIcon(rank: number) {
  if (rank <= 2) return '👣'
  if (rank <= 5) return '🥁'
  if (rank <= 8) return '🔥'
  return '🚀'
}
