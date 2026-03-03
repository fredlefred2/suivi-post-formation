'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Menu, X,
  LayoutDashboard, Target, ClipboardCheck, History,
  GraduationCap, Users,
} from 'lucide-react'

const learnerNavItems = [
  { href: '/dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/axes',       label: 'Mes actions',      icon: Target           },
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

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`sm:hidden p-2 rounded-xl transition-all duration-200 ${
          isTrainer
            ? 'text-indigo-200 hover:text-white hover:bg-white/15'
            : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
        }`}
        aria-label="Ouvrir le menu"
      >
        <Menu size={22} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-indigo-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col animate-slide-in" style={{
            boxShadow: '8px 0 40px rgba(49, 46, 129, 0.15)',
          }}>
            {/* En-tête */}
            <div className="flex items-center justify-between px-5 h-16" style={{
              background: isTrainer
                ? 'linear-gradient(135deg, #1e1b4b, #4338ca)'
                : '#ffffff',
              borderBottom: isTrainer ? 'none' : '1px solid #e5e7eb',
            }}>
              <span className={`font-semibold text-sm tracking-tight ${isTrainer ? 'text-white' : 'text-gray-900'}`}>
                {isTrainer ? '🧑‍🏫 Navigation' : '🎯 Navigation'}
              </span>
              <button
                onClick={() => setOpen(false)}
                className={`p-2 rounded-xl transition-all duration-200 ${
                  isTrainer
                    ? 'text-indigo-200 hover:text-white hover:bg-white/15'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                }`}
                aria-label="Fermer le menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Liens */}
            <nav className="flex-1 px-3 pt-5 space-y-1 overflow-y-auto">
              {navItems.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'text-indigo-800 bg-indigo-100'
                        : 'text-gray-500 hover:bg-indigo-100 hover:text-indigo-800'
                    }`}
                    style={isActive ? {
                      boxShadow: '0 2px 8px rgba(99, 102, 241, 0.12)',
                      borderLeft: '3px solid #6366f1',
                    } : {}}
                  >
                    <Icon size={18} className={isActive ? 'text-indigo-500' : 'text-gray-400'} />
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
