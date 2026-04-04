'use client'

import { LogOut } from 'lucide-react'
import { logout } from '@/app/(auth)/actions'

export default function LogoutButton() {
  async function handleLogout() {
    // Nettoyer localStorage et sessionStorage avant déconnexion
    if (typeof window !== 'undefined') {
      const keysToRemove = Object.keys(localStorage).filter(
        (k) =>
          k.startsWith('onboarding_') ||
          k.startsWith('install_dismissed') ||
          k.startsWith('push_banner') ||
          k.startsWith('whatsnew_') ||
          k.startsWith('draft-')
      )
      keysToRemove.forEach((k) => localStorage.removeItem(k))
      sessionStorage.clear()
    }
    await logout()
  }

  return (
    <form action={handleLogout}>
      <button
        type="submit"
        className="transition-all p-2 rounded-full active:scale-90"
        style={{ color: '#a0937c' }}
      >
        <LogOut size={18} />
      </button>
    </form>
  )
}
