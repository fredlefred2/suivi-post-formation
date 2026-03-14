'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, X, Plus, Search } from 'lucide-react'
import ConversationList from '@/app/components/ConversationList'
import ChatView from '@/app/components/ChatView'

type Learner = { id: string; name: string }

type Props = {
  currentUserId: string
  initialContact: { userId: string; name: string } | null
  allLearners: Learner[]
}

export default function TrainerMessagesClient({ currentUserId, initialContact, allLearners }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<{ userId: string; name: string } | null>(initialContact)
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [search, setSearch] = useState('')

  function handleSelect(userId: string, name: string) {
    setSelected({ userId, name })
    setShowNewMessage(false)
  }

  function handleBack() {
    setSelected(null)
  }

  const filteredLearners = search.trim()
    ? allLearners.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()))
    : allLearners

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title px-0 mb-0">
          <MessageCircle size={22} className="inline mr-2 -mt-0.5" />
          Messages
        </h1>
        <div className="flex items-center gap-2">
          {!selected && !showNewMessage && (
            <button
              onClick={() => setShowNewMessage(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-full transition-colors"
            >
              <Plus size={14} />
              Nouveau
            </button>
          )}
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full bg-gray-100 text-gray-600 hover:text-gray-800 hover:bg-gray-200 transition-colors"
            aria-label="Fermer"
          >
            <X size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>
      <div className="card overflow-hidden" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
        {showNewMessage ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
              <button onClick={() => setShowNewMessage(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} />
              </button>
              <div className="flex-1 relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un apprenant…"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredLearners.map((learner) => (
                <button
                  key={learner.id}
                  onClick={() => handleSelect(learner.id, learner.name)}
                  className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {learner.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <p className="text-sm font-medium text-gray-700">{learner.name}</p>
                </button>
              ))}
              {filteredLearners.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-400">Aucun résultat</p>
                </div>
              )}
            </div>
          </div>
        ) : !selected ? (
          <ConversationList onSelect={handleSelect} />
        ) : (
          <ChatView
            userId={selected.userId}
            userName={selected.name}
            currentUserId={currentUserId}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  )
}
