import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import LogoutButton from '@/app/components/LogoutButton'
import MobileDrawer from '@/app/components/MobileDrawer'
import BottomNav from '@/app/components/BottomNav'
import MessageIcon from '@/app/components/MessageIcon'
import TrainerSidebar from '@/app/components/TrainerSidebar'
import PushRegistration from '@/app/components/PushRegistration'

const navItems = [
  { href: '/trainer/dashboard', label: 'Accueil', iconName: 'LayoutDashboard' },
  { href: '/trainer/apprenants', label: 'Participants', iconName: 'GraduationCap' },
  { href: '/trainer/messages', label: 'Messages', iconName: 'MessageSquare' },
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
      {/* ── Header Cream & Warm ── */}
      <header className="sticky top-0 z-20 bg-white" style={{
        borderBottom: '2px solid #f0ebe0',
      }}>
        <div className="px-4 h-14 flex items-center justify-between sm:pl-52">
          <div className="flex items-center gap-2">
            <MobileDrawer variant="trainer" />
            <span className="font-display font-bold text-lg tracking-tight" style={{ color: '#1a1a2e' }}>
              YAPL<span style={{ color: '#fbbf24' }}>UKA</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <MessageIcon variant="trainer" currentUserId={user.id} allLearners={allLearners} />
            <LogoutButton />
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

      {/* ── Bottom nav mobile ── */}
      <BottomNav items={navItems.map(({ href, label, iconName }) => ({
        href,
        label,
        iconName,
        shortLabel: label,
      }))} />
      <div className="h-16 sm:hidden" />
      <PushRegistration />
    </div>
  )
}
