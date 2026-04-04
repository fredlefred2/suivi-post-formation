'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  LayoutDashboard, Target, ClipboardCheck, History,
  Users, GraduationCap, Sparkles,
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
  Sparkles,
}

type NavItem = {
  href: string
  label: string
  shortLabel?: string
  iconName: string
}

export default function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { isOnboarding: disabled } = useOnboarding()

  const isTrainer = pathname.startsWith('/trainer')

  function getGroupHref(href: string) {
    if (!isTrainer) return href
    const group = searchParams.get('group') || (typeof window !== 'undefined' ? localStorage.getItem('trainer_selected_group') : null)
    if (group && (href === '/trainer/dashboard' || href === '/trainer/apprenants')) {
      return `${href}?group=${group}`
    }
    return href
  }

  return (
    <nav className={`bg-white sm:hidden fixed bottom-0 left-0 right-0 z-10 transition-opacity duration-300 ${disabled ? 'opacity-40 pointer-events-none' : ''}`} style={{
      borderTop: '2px solid #f0ebe0',
      paddingBottom: 'env(safe-area-inset-bottom, 12px)',
    }}>
      <div className="flex">
        {items.map(({ href, label, shortLabel, iconName }) => {
          const Icon = iconMap[iconName]
          const isActive = pathname === href || pathname.startsWith(href + '/')
          if (!Icon) return null
          return (
            <Link key={href} href={getGroupHref(href)}
              data-onboarding={`nav-${href.split('/').pop()}`}
              className={`flex-1 flex flex-col items-center py-2.5 text-[10px] transition-all duration-150 font-semibold active:scale-90 relative ${
                isActive ? 'text-[#1a1a2e]' : 'text-[#a0937c]'
              }`}
              tabIndex={disabled ? -1 : undefined}
              aria-disabled={disabled || undefined}>
              <Icon size={20} className="transition-transform duration-150" />
              <span className="mt-0.5">{shortLabel ?? label}</span>
              {isActive && <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[#fbbf24]" />}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
