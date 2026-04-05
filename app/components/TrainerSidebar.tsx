'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { LayoutDashboard, GraduationCap, Users } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: '/trainer/dashboard', label: 'Accueil', icon: LayoutDashboard },
  { href: '/trainer/apprenants', label: 'Participants', icon: GraduationCap },
  { href: '/trainer/groups', label: 'Groupes', icon: Users },
]

export default function TrainerSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function getGroupHref(href: string) {
    const group = searchParams.get('group') || (typeof window !== 'undefined' ? localStorage.getItem('trainer_selected_group') : null)
    if (group && (href === '/trainer/dashboard' || href === '/trainer/apprenants')) {
      return `${href}?group=${group}`
    }
    return href
  }

  return (
    <div className="hidden sm:block fixed left-0 top-14 bottom-0 w-48 bg-white pt-6" style={{
      borderRight: '2px solid #f0ebe0',
    }}>
      <nav className="space-y-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={getGroupHref(href)}
              className={`flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 font-medium group active:scale-[0.97] ${
                isActive ? 'font-bold' : ''
              }`}
              style={isActive ? {
                color: '#1a1a2e',
                background: '#fffbeb',
                borderLeft: '3px solid #fbbf24',
              } : {
                color: '#a0937c',
              }}>
              <Icon size={17} className="transition-colors" style={{ color: isActive ? '#1a1a2e' : '#a0937c' }} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
