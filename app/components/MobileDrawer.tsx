'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X,
  LayoutDashboard, Target, ClipboardCheck, History,
  GraduationCap, Users,
} from 'lucide-react'

// Nav items définis côté client — pas de passage de fonctions depuis le serveur
const learnerNavItems = [
  { href: '/dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/axes',       label: 'Mes axes',         icon: Target           },
  { href: '/checkin',    label: 'Check-in',          icon: ClipboardCheck   },
  { href: '/history',    label: 'Historique',        icon: History          },
]

const trainerNavItems = [
  { href: '/trainer/dashboard',   label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/trainer/apprenants',  label: 'Apprenants',       icon: GraduationCap   },
  { href: '/trainer/groups',      label: 'Groupes',          icon: Users           },
]

type Props = {
  variant?: 'learner' | 'trainer'
}

export default function MobileDrawer({ variant = 'learner' }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const navItems = variant === 'trainer' ? trainerNavItems : learnerNavItems
  const isTrainer = variant === 'trainer'

  // Fermer à chaque navigation
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Bloquer le scroll du body quand le drawer est ouvert
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Bouton hamburger — mobile uniquement */}
      <button
        onClick={() => setOpen(true)}
        className={`sm:hidden p-2 rounded-lg transition-colors ${
          isTrainer
            ? 'text-indigo-200 hover:text-white hover:bg-indigo-600'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
        }`}
        aria-label="Ouvrir le menu"
      >
        <Menu size={22} />
      </button>

      {/* Overlay + Drawer */}
      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Fond semi-transparent */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panneau latéral */}
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-2xl flex flex-col animate-slide-in">
            {/* En-tête */}
            <div className={`flex items-center justify-between px-4 h-14 border-b border-gray-100 ${
              isTrainer ? 'bg-indigo-700' : 'bg-white'
            }`}>
              <span className={`font-semibold text-sm ${isTrainer ? 'text-white' : 'text-gray-900'}`}>
                {isTrainer ? '🧑‍🏫 Navigation' : '🎯 Navigation'}
              </span>
              <button
                onClick={() => setOpen(false)}
                className={`p-2 rounded-lg transition-colors ${
                  isTrainer
                    ? 'text-indigo-200 hover:text-white hover:bg-indigo-600'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
                aria-label="Fermer le menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Liens */}
            <nav className="flex-1 px-3 pt-4 space-y-1 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-700'
                    }`}
                  >
                    <Icon size={18} />
                    {label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  )
}
