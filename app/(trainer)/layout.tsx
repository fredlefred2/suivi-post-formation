import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/(auth)/actions'
import { LayoutDashboard, Users, GraduationCap, LogOut } from 'lucide-react'
import MobileDrawer from '@/app/components/MobileDrawer'

const navItems = [
  { href: '/trainer/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
  { href: '/trainer/apprenants', label: 'Apprenants', icon: GraduationCap },
  { href: '/trainer/groups', label: 'Groupes', icon: Users },
]

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
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

  if (profile.role !== 'trainer') redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-indigo-700 text-white sticky top-0 z-10">
        <div className="px-4 h-14 flex items-center justify-between sm:pl-52">
          <div className="flex items-center gap-1">
            <MobileDrawer variant="trainer" />
            <span className="font-semibold text-sm">
              🧑‍🏫 {profile.first_name} {profile.last_name}
              <span className="ml-2 text-xs bg-indigo-500 px-2 py-0.5 rounded-full">Formateur</span>
            </span>
          </div>
          <form action={logout}>
            <button type="submit" className="text-indigo-200 hover:text-white transition-colors p-2">
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
        <div className="max-w-3xl mx-auto sm:mx-0">
          {children}
        </div>
      </main>

      <nav className="bg-white border-t border-gray-100 sm:hidden fixed bottom-0 left-0 right-0 z-10">
        <div className="flex">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center py-2 text-xs text-gray-500 hover:text-indigo-600 transition-colors">
              <Icon size={20} />
              <span className="mt-0.5">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
      <div className="h-16 sm:hidden" />
    </div>
  )
}
