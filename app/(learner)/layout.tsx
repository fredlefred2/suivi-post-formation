import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { LayoutDashboard, Target, Users } from 'lucide-react'
import LogoutButton from '@/app/components/LogoutButton'
import MobileDrawer from '@/app/components/MobileDrawer'
import BottomNav from '@/app/components/BottomNav'
import NotificationBell from '@/app/components/NotificationBell'
import MessageIcon from '@/app/components/MessageIcon'
import { OnboardingProvider } from '@/lib/onboarding-context'
import TeamMessagePopup from '@/app/components/TeamMessagePopup'
import PushRegistration from '@/app/components/PushRegistration'
import InstallPrompt from '@/app/components/InstallPrompt'

const navItems = [
  { href: '/dashboard', label: 'Accueil', icon: LayoutDashboard, iconName: 'LayoutDashboard' },
  { href: '/axes', label: 'Actions', icon: Target, iconName: 'Target' },
  { href: '/team', label: 'Team', icon: Users, iconName: 'Users' },
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

  // Récupérer le formateur de l'apprenant pour la messagerie instantanée
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: membership } = await admin
    .from('group_members')
    .select('group_id, groups!inner(trainer_id)')
    .eq('learner_id', user.id)
    .limit(1)
    .maybeSingle()

  let trainerId = ''
  let trainerName = 'Formateur'
  if (membership) {
    trainerId = (membership.groups as unknown as { trainer_id: string }).trainer_id
    const { data: trainerProfile } = await admin
      .from('profiles')
      .select('first_name, last_name')
      .eq('id', trainerId)
      .single()
    if (trainerProfile) {
      trainerName = `${trainerProfile.first_name} ${trainerProfile.last_name}`
    }
  }

  return (
    <OnboardingProvider>
      <div className="min-h-screen flex flex-col">
        {/* ── Header Cream & Warm ── */}
        <header className="sticky top-0 z-10 bg-white" style={{
          borderBottom: '2px solid #f0ebe0',
        }}>
          <div className="px-4 h-14 flex items-center justify-between sm:pl-52">
            <div className="flex items-center gap-2">
              <MobileDrawer variant="learner" />
              <span className="font-display font-bold text-lg tracking-tight" style={{ color: '#1a1a2e' }}>
                YAPL<span style={{ color: '#fbbf24' }}>UKA</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MessageIcon variant="learner" currentUserId={user.id} trainerId={trainerId} trainerName={trainerName} />
              <NotificationBell />
              <LogoutButton />
            </div>
          </div>
        </header>

        {/* ── Sidebar desktop ── */}
        <div className="hidden sm:block fixed left-0 top-14 bottom-0 w-48 bg-white pt-6" style={{
          borderRight: '2px solid #f0ebe0',
        }}>
          <nav className="space-y-1 px-3">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 group active:scale-[0.97]"
                style={{ color: '#a0937c' }}>
                <Icon size={17} className="transition-colors" />
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
        <BottomNav items={navItems.map(({ href, label, iconName }) => ({
          href,
          label,
          iconName,
          shortLabel: label === 'Mes actions' ? 'Actions' : label === 'Tableau de bord' ? 'Accueil' : label,
        }))} />
        <div className="h-16 sm:hidden" />
        <TeamMessagePopup userId={user.id} />
        <InstallPrompt />
        <PushRegistration />
      </div>
    </OnboardingProvider>
  )
}
