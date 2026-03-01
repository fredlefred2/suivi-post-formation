import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/(auth)/actions'
import { LayoutDashboard, Target, ClipboardCheck, History, LogOut } from 'lucide-react'
import MobileDrawer from '@/app/components/MobileDrawer'

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/axes', label: 'Mes axes', icon: Target },
  { href: '/checkin', label: 'Check-in', icon: ClipboardCheck },
  { href: '/history', label: 'Historique', icon: History },
]

export default async function LearnerLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('first_name, last_name, role')
    .eq('id', user.id)
    .single()

  if (!profile) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  if (profile.role !== 'learner') redirect('/trainer/dashboard')

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header blanc + barre gradient visible ── */}
      <header className="bg-white sticky top-0 z-10" style={{
        boxShadow: '0 2px 15px rgba(99, 102, 241, 0.08)',
      }}>
        <div className="h-1" style={{
          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899, #f59e0b)',
        }} />
        <div className="px-4 h-14 flex items-center justify-between sm:pl-52">
          <div className="flex items-center gap-1">
            <MobileDrawer variant="learner" />
            <span className="font-semibold text-gray-900 text-sm tracking-tight">
              🎯 {profile.first_name} {profile.last_name}
            </span>
          </div>
          <form action={logout}>
            <button type="submit" className="text-gray-400 hover:text-gray-600 transition-all p-2 hover:bg-gray-100 rounded-lg">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>

      {/* ── Sidebar desktop ── */}
      <div className="hidden sm:block fixed left-0 top-[3.75rem] bottom-0 w-48 bg-white border-r border-indigo-100 pt-6" style={{
        boxShadow: '4px 0 20px rgba(99, 102, 241, 0.06)',
      }}>
        <nav className="space-y-1 px-3">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all duration-200 font-medium group">
              <Icon size={17} className="text-gray-400 group-hover:text-indigo-500 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Contenu principal ── */}
      <main className="flex-1 px-4 py-6 sm:ml-48">
        <div className="max-w-2xl mx-auto sm:mx-0">
          {children}
        </div>
      </main>

      {/* ── Bottom nav mobile ── */}
      <nav className="bg-white border-t border-indigo-100 sm:hidden fixed bottom-0 left-0 right-0 z-10" style={{
        boxShadow: '0 -4px 20px rgba(99, 102, 241, 0.08)',
      }}>
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center py-2.5 text-xs text-gray-400 hover:text-indigo-600 transition-all font-medium">
              <Icon size={20} />
              <span className="mt-0.5">{label.split(' ')[0]}</span>
            </Link>
          ))}
        </div>
      </nav>
      <div className="h-16 sm:hidden" />
    </div>
  )
}
