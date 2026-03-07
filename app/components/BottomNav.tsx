'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Target, ClipboardCheck, History,
  Users, GraduationCap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useOnboarding } from '@/lib/onboarding-context'

const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Target,
  ClipboardCheck,
  History,
  Users,
  GraduationCap,
}

type NavItem = {
  href: string
  label: string
  shortLabel?: string
  iconName: string
}

export default function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  let disabled = false
  try { disabled = useOnboarding().isOnboarding } catch { /* outside provider (trainer layout) */ }

  return (
    <nav className={`bg-gray-950 sm:hidden fixed bottom-0 left-0 right-0 z-10 transition-opacity duration-300 ${disabled ? 'opacity-40 pointer-events-none' : ''}`} style={{
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
    }}>
      <div className="flex">
        {items.map(({ href, label, shortLabel, iconName }) => {
          const Icon = iconMap[iconName]
          const isActive = pathname === href || pathname.startsWith(href + '/')
          if (!Icon) return null
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-all duration-150 font-medium active:scale-90 ${
                isActive ? 'text-white' : 'text-gray-500'
              }`}
              tabIndex={disabled ? -1 : undefined}
              aria-disabled={disabled || undefined}>
              <Icon size={20} className={`transition-transform duration-150 ${isActive ? 'text-indigo-400' : ''}`} />
              <span className="mt-0.5">{shortLabel ?? label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
