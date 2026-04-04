'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useSearchParams } from 'next/navigation'
import {
  X,
  LayoutDashboard, Target, ClipboardCheck,
  GraduationCap, Users,
} from 'lucide-react'
import { useOnboarding } from '@/lib/onboarding-context'

const learnerNavItems = [
  { href: '/dashboard',  label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/axes',       label: 'Mes actions',      icon: Target           },
  { href: '/checkin',    label: 'Check-in',          icon: ClipboardCheck   },
  { href: '/team',       label: 'Team',              icon: Users            },
]

const trainerNavItems = [
  { href: '/trainer/dashboard',   label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/trainer/apprenants',  label: 'Participants',     icon: GraduationCap   },
  { href: '/trainer/groups',      label: 'Groupes',          icon: Users           },
]

type Props = {
  variant?: 'learner' | 'trainer'
}

export default function MobileDrawer({ variant = 'learner' }: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { isOnboarding: onboardingDisabled } = useOnboarding()

  const searchParams = useSearchParams()
  const navItems = variant === 'trainer' ? trainerNavItems : learnerNavItems
  const isTrainer = variant === 'trainer'

  // Persist group selection across trainer pages
  const getGroupHref = useCallback((href: string) => {
    if (!isTrainer) return href
    const group = searchParams.get('group') || (typeof window !== 'undefined' ? localStorage.getItem('trainer_selected_group') : null)
    if (group && (href === '/trainer/dashboard' || href === '/trainer/apprenants')) {
      return `${href}?group=${group}`
    }
    return href
  }, [isTrainer, searchParams])

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
        onClick={() => !onboardingDisabled && setOpen(true)}
        className={`sm:hidden p-2 rounded-xl transition-all duration-200 ${onboardingDisabled ? 'opacity-40 pointer-events-none' : ''}`}
        aria-label="Ouvrir le menu"
        disabled={onboardingDisabled}
      >
        <Image src="/yapluka-symbol.png" alt="Menu" width={22} height={21} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col animate-slide-in" style={{
            boxShadow: '8px 0 40px rgba(0, 0, 0, 0.08)',
          }}>
            {/* En-tête */}
            <div className="flex items-center justify-between px-5 h-16" style={{ background: '#1a1a2e' }}>
              <span className="font-display font-bold text-base tracking-tight text-white flex items-center gap-2">
                <Image src="/yapluka-symbol.png" alt="YAPLUKA" width={18} height={17} />
                YAPL<span style={{ color: '#fbbf24' }}>UKA</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-xl transition-all duration-200"
                style={{ color: 'rgba(255,255,255,0.5)' }}
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
                    href={getGroupHref(href)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'font-bold'
                        : ''
                    }`}
                    style={isActive ? {
                      color: '#1a1a2e',
                      background: '#fffbeb',
                      borderLeft: '3px solid #fbbf24',
                    } : {
                      color: '#a0937c',
                    }}
                  >
                    <Icon size={18} style={{ color: isActive ? '#1a1a2e' : '#a0937c' }} />
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
