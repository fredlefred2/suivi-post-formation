'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'

type GroupInfo = { id: string; name: string; count: number }

export default function LearnerNav({
  prevUrl,
  nextUrl,
  currentIndex,
  total,
  allUrls = [],
  groups = [],
  currentGroupId,
  children,
}: {
  prevUrl: string | null
  nextUrl: string | null
  currentIndex: number
  total: number
  allUrls?: string[]
  groups?: GroupInfo[]
  currentGroupId?: string | null
  children: React.ReactNode
}) {
  const router = useRouter()
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fermeture du dropdown au clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const dx = touchStartX.current - e.changedTouches[0].clientX
    const dy = touchStartY.current - e.changedTouches[0].clientY
    // Ignorer si le geste est surtout vertical (scroll)
    if (Math.abs(dy) > Math.abs(dx)) return
    if (Math.abs(dx) < 50) return
    if (dx > 0 && nextUrl) router.push(nextUrl)
    if (dx < 0 && prevUrl) router.push(prevUrl)
  }

  const currentGroupName = groups.find((g) => g.id === currentGroupId)?.name

  // Pas de carousel si un seul apprenant et un seul groupe
  if (total <= 1 && groups.length <= 1) return <>{children}</>

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>

      {/* ── Sélecteur de groupe ────────────────────────────────────────── */}
      {groups.length > 1 && (
        <div className="relative mb-3" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className={`flex items-center gap-2 px-4 py-2.5 bg-white border rounded-xl text-sm font-medium transition-colors shadow-sm min-w-[200px] justify-between ${
              dropdownOpen
                ? 'border-indigo-400 text-indigo-700 ring-2 ring-indigo-100'
                : 'border-gray-200 text-gray-700 hover:border-indigo-300 hover:text-indigo-700'
            }`}
          >
            <span className="truncate">👥 {currentGroupName ?? 'Groupe'}</span>
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full mt-1.5 left-0 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden min-w-[220px]">
              {groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => {
                    setDropdownOpen(false)
                    if (g.id !== currentGroupId) {
                      router.push(`/trainer/apprenants?group=${g.id}`)
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    g.id === currentGroupId ? 'bg-indigo-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    g.id === currentGroupId ? 'border-indigo-600' : 'border-gray-300'
                  }`}>
                    {g.id === currentGroupId && <span className="w-2 h-2 rounded-full bg-indigo-600" />}
                  </span>
                  <span className={`text-sm ${g.id === currentGroupId ? 'text-indigo-700 font-medium' : 'text-gray-700'}`}>
                    {g.name}
                  </span>
                  <span className="ml-auto text-xs text-gray-400">{g.count} app.</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Barre de navigation : ← dots → ────────────────────────────── */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-4 mb-4">
          <button
            onClick={() => prevUrl && router.push(prevUrl)}
            disabled={!prevUrl}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex items-center gap-1.5">
            {total <= 12
              ? Array.from({ length: total }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (allUrls[i] && i !== currentIndex) router.push(allUrls[i])
                    }}
                    className={`h-2 rounded-full transition-all duration-200 ${
                      i === currentIndex
                        ? 'w-6 bg-indigo-500'
                        : 'w-2 bg-gray-300 hover:bg-gray-400 cursor-pointer'
                    }`}
                  />
                ))
              : (
                <span className="text-xs font-medium text-gray-500">
                  {currentIndex + 1} / {total}
                </span>
              )
            }
          </div>

          <button
            onClick={() => nextUrl && router.push(nextUrl)}
            disabled={!nextUrl}
            className="w-8 h-8 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-indigo-600 hover:border-indigo-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {children}
    </div>
  )
}
