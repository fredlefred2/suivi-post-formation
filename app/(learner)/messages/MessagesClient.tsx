'use client'

import { useRouter } from 'next/navigation'
import { MessageCircle, X } from 'lucide-react'
import ChatView from '@/app/components/ChatView'

type Props = {
  currentUserId: string
  trainerId: string
  trainerName: string
}

export default function MessagesClient({ currentUserId, trainerId, trainerName }: Props) {
  const router = useRouter()

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title px-0 mb-0">
          <MessageCircle size={22} className="inline mr-2 -mt-0.5" />
          {trainerName}
        </h1>
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full bg-gray-100 text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition-colors"
          aria-label="Fermer"
        >
          <X size={22} strokeWidth={2.5} />
        </button>
      </div>
      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
        <ChatView
          userId={trainerId}
          userName={trainerName}
          currentUserId={currentUserId}
          onBack={() => router.back()}
          hideBackButton
        />
      </div>
    </div>
  )
}
