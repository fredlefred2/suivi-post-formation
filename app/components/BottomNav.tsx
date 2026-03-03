'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  href: string
  label: string
  shortLabel?: string
  icon: LucideIcon
}

export default function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  return (
    <nav className="bg-gray-950 sm:hidden fixed bottom-0 left-0 right-0 z-10" style={{
      boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
    }}>
      <div className="flex">
        {items.map(({ href, label, shortLabel, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-all duration-150 font-medium active:scale-90 ${
                isActive ? 'text-white' : 'text-gray-500'
              }`}>
              <Icon size={20} className={`transition-transform duration-150 ${isActive ? 'text-indigo-400' : ''}`} />
              <span className="mt-0.5">{shortLabel ?? label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
