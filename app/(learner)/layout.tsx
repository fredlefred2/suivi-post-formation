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

  // Pas de profil = compte incomplet → déconnexion propre
  if (!profile) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  if (profile.role !== 'learner') redirect('/trainer/dashboard')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="px-4 h-14 flex items-center justify-between sm:pl-52">
          <div className="flex items-center gap-1">
            <MobileDrawer variant="learner" />
            <span className="font-semibold text-gray-900 text-sm">
              🎯 {profile.first_name} {profile.last_name}
            </span>
          </div>
          <form action={logout}>
            <button type="submit" className="text-gray-400 hover:text-gray-600 transition-colors p-2">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>

      <div className="hidden sm:block fixed left-0 top-14 bottom-0 w-48 bg-white border-r border-gray-100 pt-4">
        <nav className="space-y-1 px-3">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors">
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 px-4 py-6 sm:ml-48">
        <div className="max-w-2xl mx-auto sm:mx-0">
          {children}
        </div>
      </main>

      <nav className="bg-white border-t border-gray-100 sm:hidden fixed bottom-0 left-0 right-0 z-10">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center py-2 text-xs text-gray-500 hover:text-indigo-600 transition-colors">
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
