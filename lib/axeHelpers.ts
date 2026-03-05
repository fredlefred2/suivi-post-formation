// Helpers partagés pour la dynamique d'action (dashboard, axes, team)

export const MARKERS = [
  { icon: '📍', pos: 0      },  // 0 actions
  { icon: '👣', pos: 1 / 9  },  // 1 action
  { icon: '🥁', pos: 3 / 9  },  // 3 actions
  { icon: '🔥', pos: 6 / 9  },  // 6 actions
  { icon: '🚀', pos: 1      },  // 9 actions
]

export function getDynamique(count: number) {
  if (count === 0) return { label: 'Ancrage',     icon: '📍', color: 'text-gray-500   bg-gray-100  border-gray-300',   delta: 1 }
  if (count <= 2) return { label: 'Impulsion',   icon: '👣', color: 'text-teal-800   bg-teal-100  border-teal-300',   delta: 3 - count }
  if (count <= 5) return { label: 'Rythme',      icon: '🥁', color: 'text-blue-800   bg-blue-100  border-blue-300',   delta: 6 - count }
  if (count <= 8) return { label: 'Intensité',   icon: '🔥', color: 'text-orange-800 bg-orange-100 border-orange-300', delta: 9 - count }
  return               { label: 'Propulsion',  icon: '🚀', color: 'text-purple-800 bg-purple-100 border-purple-300', delta: 0 }
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
  if (count === 0) return { label: 'Ancrage',    icon: '📍' }
  if (count <= 2) return { label: 'Impulsion',  icon: '👣' }
  if (count <= 5) return { label: 'Rythme',     icon: '🥁' }
  if (count <= 8) return { label: 'Intensité',  icon: '🔥' }
  return              { label: 'Propulsion', icon: '🚀' }
}

// Icône de phase selon le rang chronologique de l'action (1-indexed)
export function getActionPhaseIcon(rank: number) {
  if (rank <= 2) return '👣'
  if (rank <= 5) return '🥁'
  if (rank <= 8) return '🔥'
  return '🚀'
}
