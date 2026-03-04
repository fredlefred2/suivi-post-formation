/**
 * Utilitaires partagés pour l'onboarding apprenant.
 * Utilisé par OnboardingFlow (dashboard) et AxesClient (axes).
 */

function getStorageKey(userId: string) {
  return `onboarding_ack_${userId}`
}

export function getOnboardingAck(userId: string): Record<string, boolean> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(userId)) || '{}')
  } catch {
    return {}
  }
}

export function acknowledgeStep(stepId: string, userId: string) {
  if (typeof window === 'undefined') return
  const stored = getOnboardingAck(userId)
  stored[stepId] = true
  localStorage.setItem(getStorageKey(userId), JSON.stringify(stored))
}
