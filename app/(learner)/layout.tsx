import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { LayoutDashboard, Target, ClipboardCheck, Users, Sparkles } from 'lucide-react'
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
  { href: '/coaching', label: 'Coach', icon: Sparkles, iconName: 'Sparkles' },
  { href: '/checkin', label: 'Check-in', icon: ClipboardCheck, iconName: 'ClipboardCheck' },
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
        {/* ── Header gradient violet (même style que formateur) ── */}
        <header className="text-white sticky top-0 z-10" style={{
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 25%, #4338ca 60%, #6366f1 100%)',
          boxShadow: '0 4px 20px rgba(49, 46, 129, 0.3)',
        }}>
          <div className="px-4 h-14 flex items-center justify-between sm:pl-52">
            <div className="flex items-center gap-1">
              <MobileDrawer variant="learner" />
              <span className="font-semibold text-sm tracking-tight">
                {profile.first_name} {profile.last_name}
                <span className="ml-2 text-xs bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full font-medium border border-white/20">
                  Participant
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1">
              <MessageIcon variant="learner" currentUserId={user.id} trainerId={trainerId} trainerName={trainerName} />
              <NotificationBell />
              <LogoutButton />
            </div>
          </div>
        </header>

        {/* ── Sidebar desktop ── */}
        <div className="hidden sm:block fixed left-0 top-14 bottom-0 w-48 bg-white border-r border-indigo-100 pt-6" style={{
          boxShadow: '4px 0 20px rgba(99, 102, 241, 0.06)',
        }}>
          <nav className="space-y-1 px-3">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-500 hover:text-indigo-800 hover:bg-indigo-100 rounded-xl transition-all duration-200 font-medium group active:scale-[0.97]">
                <Icon size={17} className="text-gray-500 group-hover:text-indigo-600 transition-colors" />
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

        {/* ── Bottom nav mobile (fond noir + active state) ── */}
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
