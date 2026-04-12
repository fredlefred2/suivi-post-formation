// Helpers partagés pour la dynamique d'action (dashboard, axes, team)
// Échelle : Intention → Essai → Habitude → Réflexe → Maîtrise

export const MARKERS = [
  { icon: '💡', pos: 0      },  // 0 actions  — Intention
  { icon: '🧪', pos: 1 / 7  },  // 1 action   — Essai
  { icon: '🔄', pos: 3 / 7  },  // 3 actions  — Habitude
  { icon: '⚡', pos: 5 / 7  },  // 5 actions  — Réflexe
  { icon: '👑', pos: 1      },  // 7 actions  — Maîtrise
]

export function getDynamique(count: number) {
  if (count === 0) return { label: 'Intention',   icon: '💡', color: 'text-violet-700  bg-violet-100  border-violet-300',  delta: 1 }
  if (count <= 2) return { label: 'Essai',       icon: '🧪', color: 'text-sky-800    bg-sky-100    border-sky-300',    delta: 3 - count }
  if (count <= 4) return { label: 'Habitude',    icon: '🔄', color: 'text-emerald-800 bg-emerald-100 border-emerald-300', delta: 5 - count }
  if (count <= 6) return { label: 'Réflexe',     icon: '⚡', color: 'text-orange-800  bg-orange-100  border-orange-300',  delta: 7 - count }
  return               { label: 'Maîtrise',    icon: '👑', color: 'text-rose-800    bg-rose-100    border-rose-300',    delta: 0 }
}

export function getCurrentLevelIndex(count: number) {
  if (count === 0) return 0
  if (count <= 2) return 1
  if (count <= 4) return 2
  if (count <= 6) return 3
  return 4
}

export function getProgress(count: number) {
  if (count >= 7) return 100
  return Math.round((count / 7) * 100)
}

export function getCurrentLevel(count: number) {
  if (count === 0) return { label: 'Intention',   icon: '💡' }
  if (count <= 2) return { label: 'Essai',       icon: '🧪' }
  if (count <= 4) return { label: 'Habitude',    icon: '🔄' }
  if (count <= 6) return { label: 'Réflexe',     icon: '⚡' }
  return              { label: 'Maîtrise',    icon: '👑' }
}

// Infos sur le prochain niveau (pour les toasts "encore X pour...")
export function getNextLevel(count: number): { icon: string; label: string; delta: number } | null {
  const dyn = getDynamique(count)
  if (dyn.delta === 0) return null // Déjà au max (Maîtrise)
  const nextCount = count + dyn.delta
  const next = getCurrentLevel(nextCount)
  return { icon: next.icon, label: next.label, delta: dyn.delta }
}

// Icône de phase selon le rang chronologique de l'action (1-indexed)
export function getActionPhaseIcon(rank: number) {
  if (rank <= 2) return '🧪'
  if (rank <= 4) return '🔄'
  if (rank <= 6) return '⚡'
  return '👑'
}
