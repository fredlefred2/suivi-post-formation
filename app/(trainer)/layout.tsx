import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/(auth)/actions'
import { LayoutDashboard, Users, GraduationCap, LogOut } from 'lucide-react'
import MobileDrawer from '@/app/components/MobileDrawer'
import BottomNav from '@/app/components/BottomNav'

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

  if (!profile) {
    await supabase.auth.signOut()
    redirect('/login')
  }

  if (profile.role !== 'trainer') redirect('/dashboard')

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header gradient fort ── */}
      <header className="text-white sticky top-0 z-10" style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4338ca 60%, #6366f1 100%)',
        boxShadow: '0 4px 20px rgba(49, 46, 129, 0.3)',
      }}>
        <div className="px-4 h-14 flex items-center justify-between sm:pl-52">
          <div className="flex items-center gap-1">
            <MobileDrawer variant="trainer" />
            <span className="font-semibold text-sm tracking-tight">
              🧑‍🏫 {profile.first_name} {profile.last_name}
              <span className="ml-2 text-xs bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full font-medium border border-white/20">
                Formateur
              </span>
            </span>
          </div>
          <form action={logout}>
            <button type="submit" className="text-indigo-200 hover:text-white transition-all p-2 hover:bg-white/15 rounded-lg active:scale-90">
              <LogOut size={18} />
            </button>
          </form>
        </div>
      </header>

      {/* ── Sidebar desktop — fond blanc + accent ── */}
      <div className="hidden sm:block fixed left-0 top-14 bottom-0 w-48 bg-white border-r border-indigo-100 pt-6" style={{
        boxShadow: '4px 0 20px rgba(99, 102, 241, 0.06)',
      }}>
        <nav className="space-y-1 px-3">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-500 hover:text-indigo-800 hover:bg-indigo-100 rounded-xl transition-all duration-200 font-medium group active:scale-[0.97]">
              <Icon size={17} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {/* ── Contenu principal ── */}
      <main className="flex-1 px-4 py-6 sm:ml-48">
        <div className="max-w-3xl mx-auto sm:mx-0">
          {children}
        </div>
      </main>

      {/* ── Bottom nav mobile (fond noir + active state) ── */}
      <BottomNav items={navItems.map((item) => ({
        ...item,
        shortLabel: item.label === 'Tableau de bord' ? 'Accueil' : item.label,
      }))} />
      <div className="h-16 sm:hidden" />
    </div>
  )
}
