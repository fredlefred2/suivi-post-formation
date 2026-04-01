'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Home, Users, User } from 'lucide-react'

export default function TrainerBottomNav() {
  const pathname = usePathname()
  const [lastGroupId, setLastGroupId] = useState<string | null>(null)
  const [lastLearnerId, setLastLearnerId] = useState<string | null>(null)
  const [lastLearnerGroupId, setLastLearnerGroupId] = useState<string | null>(null)

  // Detect current page and store last visited IDs
  useEffect(() => {
    const groupMatch = pathname.match(/^\/trainer\/groups\/([^/]+)/)
    if (groupMatch) {
      setLastGroupId(groupMatch[1])
      localStorage.setItem('trainer_last_group', groupMatch[1])
    }

    const learnerMatch = pathname.match(/^\/trainer\/learner\/([^/]+)/)
    if (learnerMatch) {
      setLastLearnerId(learnerMatch[1])
      localStorage.setItem('trainer_last_learner', learnerMatch[1])
      // Store the group context from URL params
      const params = new URLSearchParams(window.location.search)
      const groupId = params.get('group')
      if (groupId) {
        setLastLearnerGroupId(groupId)
        localStorage.setItem('trainer_last_learner_group', groupId)
      }
    }
  }, [pathname])

  // Load stored values on mount
  useEffect(() => {
    setLastGroupId(localStorage.getItem('trainer_last_group'))
    setLastLearnerId(localStorage.getItem('trainer_last_learner'))
    setLastLearnerGroupId(localStorage.getItem('trainer_last_learner_group'))
  }, [])

  const isAccueil = pathname === '/trainer/dashboard'
  const isGroupe = pathname.startsWith('/trainer/groups/')
  const isApprenant = pathname.startsWith('/trainer/learner/')

  const groupHref = lastGroupId ? `/trainer/groups/${lastGroupId}` : null
  const learnerHref = lastLearnerId
    ? `/trainer/learner/${lastLearnerId}${lastLearnerGroupId ? `?group=${lastLearnerGroupId}` : ''}`
    : null

  return (
    <nav
      className="bg-gray-950 sm:hidden fixed bottom-0 left-0 right-0 z-10"
      style={{ boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)' }}
    >
      <div className="flex">
        {/* Accueil */}
        <Link
          href="/trainer/dashboard"
          className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-all duration-150 font-medium active:scale-90 ${
            isAccueil ? 'text-white' : 'text-gray-500'
          }`}
        >
          <Home size={20} className={isAccueil ? 'text-indigo-400' : ''} />
          <span className="mt-0.5">Accueil</span>
        </Link>

        {/* Groupe */}
        {groupHref ? (
          <Link
            href={groupHref}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-all duration-150 font-medium active:scale-90 ${
              isGroupe ? 'text-white' : 'text-gray-500'
            }`}
          >
            <Users size={20} className={isGroupe ? 'text-indigo-400' : ''} />
            <span className="mt-0.5">Groupe</span>
          </Link>
        ) : (
          <div className="flex-1 flex flex-col items-center py-2.5 text-xs font-medium text-gray-700">
            <Users size={20} />
            <span className="mt-0.5">Groupe</span>
          </div>
        )}

        {/* Apprenant */}
        {learnerHref ? (
          <Link
            href={learnerHref}
            className={`flex-1 flex flex-col items-center py-2.5 text-xs transition-all duration-150 font-medium active:scale-90 ${
              isApprenant ? 'text-white' : 'text-gray-500'
            }`}
          >
            <User size={20} className={isApprenant ? 'text-indigo-400' : ''} />
            <span className="mt-0.5">Apprenant</span>
          </Link>
        ) : (
          <div className="flex-1 flex flex-col items-center py-2.5 text-xs font-medium text-gray-700">
            <User size={20} />
            <span className="mt-0.5">Apprenant</span>
          </div>
        )}
      </div>
    </nav>
  )
}
