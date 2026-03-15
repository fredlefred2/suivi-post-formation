import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { logout } from '@/app/(auth)/actions'
import { LogOut } from 'lucide-react'
import MobileDrawer from '@/app/components/MobileDrawer'
import BottomNav from '@/app/components/BottomNav'
import MessageIcon from '@/app/components/MessageIcon'
import TrainerSidebar from '@/app/components/TrainerSidebar'

const navItems = [
  { href: '/trainer/dashboard', label: 'Accueil', iconName: 'LayoutDashboard' },
  { href: '/trainer/apprenants', label: 'Participants', iconName: 'GraduationCap' },
  { href: '/trainer/groups', label: 'Groupes', iconName: 'Users' },
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

  // Récupérer tous les apprenants du formateur pour la messagerie instantanée
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: groupsRaw } = await admin
    .from('groups')
    .select('id, group_members(learner_id, profiles!inner(id, first_name, last_name))')
    .eq('trainer_id', user.id)

  type MemberRow = { learner_id: string; profiles: { id: string; first_name: string; last_name: string } }
  const allLearners: { id: string; name: string }[] = []
  const seen = new Set<string>()
  for (const g of groupsRaw ?? []) {
    for (const m of (g.group_members ?? []) as unknown as MemberRow[]) {
      if (!seen.has(m.learner_id)) {
        seen.add(m.learner_id)
        allLearners.push({ id: m.learner_id, name: `${m.profiles.first_name} ${m.profiles.last_name}` })
      }
    }
  }
  allLearners.sort((a, b) => a.name.localeCompare(b.name))

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
              {profile.first_name} {profile.last_name}
              <span className="ml-2 text-xs bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full font-medium border border-white/20">
                Formateur
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <MessageIcon variant="trainer" currentUserId={user.id} allLearners={allLearners} />
            <form action={logout}>
              <button type="submit" className="text-indigo-200 hover:text-white transition-all p-2 hover:bg-white/15 rounded-lg active:scale-90">
                <LogOut size={18} />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Sidebar desktop — fond blanc + accent ── */}
      <TrainerSidebar />

      {/* ── Contenu principal ── */}
      <main className="flex-1 px-4 py-6 sm:ml-48">
        <div className="max-w-3xl mx-auto sm:mx-0">
          {children}
        </div>
      </main>

      {/* ── Bottom nav mobile (fond noir + active state) ── */}
      <BottomNav items={navItems.map(({ href, label, iconName }) => ({
        href,
        label,
        iconName,
        shortLabel: label,
      }))} />
      <div className="h-16 sm:hidden" />
    </div>
  )
}
