'use client'

import { useEffect } from 'react'

const STORAGE_KEY = 'badge_last_check'

export default function BadgeUpdater() {
  useEffect(() => {
    // Vérifier le support de l'API Badge
    if (!('setAppBadge' in navigator)) return

    async function updateBadge() {
      try {
        const since = localStorage.getItem(STORAGE_KEY) || new Date(0).toISOString()
        const res = await fetch(`/api/badge-count?since=${encodeURIComponent(since)}`)
        if (!res.ok) return

        const { count } = await res.json()

        if (count > 0) {
          await navigator.setAppBadge(count)
        } else {
          await navigator.clearAppBadge()
        }

        // Mettre à jour le timestamp pour la prochaine visite
        localStorage.setItem(STORAGE_KEY, new Date().toISOString())
      } catch {
        // Silencieux si erreur (pas installé en PWA, etc.)
      }
    }

    updateBadge()
  }, [])

  return null
}
