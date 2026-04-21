'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Plus, X, ChevronDown, MoreVertical, Sparkles, Loader2, FileText, HelpCircle, Settings, Trash2 } from 'lucide-react'
import { createGroup, deleteGroup, removeLearnerFromGroup } from './actions'
import { assignToGroup, deleteLearner } from '@/app/(trainer)/trainer/apprenants/actions'
import GroupBriefModal from '@/app/components/GroupBriefModal'
import { useRouter } from 'next/navigation'

type Group = {
  id: string
  name: string
  theme: string | null
  created_at: string
  group_members: Array<{ count: number }>
}

type MemberInfo = {
  learner_id: string
  first_name: string
  last_name: string
  tips_total: number
  tips_sent: number
}

export default function GroupsClient({
  groups,
  membersMap,
}: {
  groups: Group[]
  membersMap: Record<string, MemberInfo[]>
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // Tous les groupes fermés par défaut
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [deletingLearnerId, setDeletingLearnerId] = useState<string | null>(null)
  const [deletingLearnerGroupId, setDeletingLearnerGroupId] = useState<string | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [rewritingTheme, setRewritingTheme] = useState(false)
  const [createThemeValue, setCreateThemeValue] = useState('')
  const [briefGroupId, setBriefGroupId] = useState<string | null>(null)

  async function handleRewriteTheme(currentValue: string, setter: (v: string) => void) {
    if (!currentValue.trim() || currentValue.trim().length < 5) return
    setRewritingTheme(true)
    try {
      const res = await fetch('/api/theme/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: currentValue }),
      })
      const data = await res.json()
      if (data.rewritten) setter(data.rewritten)
    } catch {
      // silently fail
    }
    setRewritingTheme(false)
  }

  // Fermer les menus quand on clique ailleurs
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-menu]')) {
      setOpenMenu(null)
    }
  }, [])

  useEffect(() => {
    if (openMenu) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [openMenu, handleOutsideClick])

  function toggleGroup(id: string) {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createGroup(formData)
      if (result?.error) setError(result.error)
      else setShowForm(false)
    })
  }

  function handleReassign(learnerId: string, fromGroupId: string, toGroupId: string) {
    setOpenMenu(null)
    startTransition(async () => {
      await removeLearnerFromGroup(fromGroupId, learnerId)
      await assignToGroup(learnerId, toGroupId)
    })
  }

  function handleDeleteLearner() {
    if (!deletingLearnerId) return
    startTransition(async () => {
      await deleteLearner(deletingLearnerId)
      setDeletingLearnerId(null)
      setDeletingLearnerGroupId(null)
    })
  }

  function handleDeleteGroup() {
    if (!deletingGroupId) return
    startTransition(async () => {
      await deleteGroup(deletingGroupId)
      setDeletingGroupId(null)
    })
  }

  function openDeleteLearner(learnerId: string, groupId: string) {
    setOpenMenu(null)
    // Petit délai pour que le menu se ferme avant d'ouvrir la modale
    setTimeout(() => {
      setDeletingLearnerId(learnerId)
      setDeletingLearnerGroupId(groupId)
    }, 50)
  }

  const deletingLearner = deletingLearnerId && deletingLearnerGroupId
    ? membersMap[deletingLearnerGroupId]?.find((m) => m.learner_id === deletingLearnerId)
    : null

  const deletingGroup = deletingGroupId
    ? groups.find((g) => g.id === deletingGroupId)
    : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="page-title">Groupes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl transition-colors"
          style={{ background: '#fbbf24', color: '#1a1a2e' }}
        >
          <Plus size={14} /> Nouveau
        </button>
      </div>

      {/* Formulaire de création */}
      {showForm && (
        <div className="card border-2 border-[#f0ebe0]">
          <p className="font-semibold text-gray-800 text-sm mb-3">Nouveau groupe</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="label text-xs">Nom du groupe *</label>
              <input name="name" required className="input text-sm py-2.5" placeholder="Ex: Management — Oct. 2024" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="label text-xs mb-0">Thème de la formation</label>
                {createThemeValue.trim().length >= 5 && (
                  <button
                    type="button"
                    disabled={rewritingTheme}
                    onClick={() => handleRewriteTheme(createThemeValue, setCreateThemeValue)}
                    className="flex items-center gap-1 text-xs font-medium transition-colors disabled:opacity-50"
                    style={{ color: '#92400e' }}
                  >
                    {rewritingTheme ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {rewritingTheme ? 'Réécriture...' : 'Reformuler'}
                  </button>
                )}
              </div>
              <textarea
                name="theme"
                value={createThemeValue}
                onChange={e => setCreateThemeValue(e.target.value)}
                className="input text-sm py-2.5 min-h-[100px] resize-y"
                placeholder="Ex: Communication assertive, gestion des conflits, leadership situationnel..."
              />
              <p className="text-xs text-gray-400 mt-1">Saisissez vos mots-clés puis cliquez sur Reformuler pour obtenir un thème structuré</p>
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending} className="btn-primary">
                {isPending ? 'Création...' : 'Créer'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des groupes */}
      {groups.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-gray-500">Aucun groupe pour l&apos;instant.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const memberCount = group.group_members[0]?.count ?? 0
            const members = membersMap[group.id] ?? []
            const isExpanded = expandedGroups.has(group.id)

            const hasTheme = (group.theme ?? '').trim().length >= 20

            return (
              <div
                key={group.id}
                className="bg-white rounded-[24px] overflow-visible transition-all"
                style={{
                  border: '2px solid #f0ebe0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.03), 0 6px 20px rgba(0,0,0,0.05)',
                }}
              >
                {/* ── Header carte (titre + nb + thème) ── */}
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{ background: '#fffbeb' }}>
                      👥
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-extrabold text-[17px] truncate" style={{ color: '#1a1a2e' }}>
                          {group.name}
                        </h2>
                        <span
                          className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-extrabold shrink-0"
                          style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}
                        >
                          {memberCount}
                        </span>
                      </div>
                      {group.theme ? (
                        <p className="text-[12px] mt-0.5 line-clamp-2 leading-snug" style={{ color: '#a0937c' }}>
                          {group.theme}
                        </p>
                      ) : (
                        <p className="text-[12px] mt-0.5 italic" style={{ color: '#c4b99a' }}>
                          Pas encore de brief défini
                        </p>
                      )}
                    </div>
                  </div>

                  {/* ── 3 boutons : Brief / Quiz / Paramètres ── */}
                  <div className="flex gap-2.5 mt-4">
                    {/* Brief */}
                    <button
                      onClick={() => setBriefGroupId(group.id)}
                      className="flex-1 min-w-0 flex flex-col items-center gap-1.5 py-3 px-2 rounded-[18px] transition-all hover:-translate-y-0.5"
                      style={{
                        background: hasTheme ? 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)' : '#fffbeb',
                        border: hasTheme ? '2px solid #fde68a' : '2px dashed #fde68a',
                        color: '#1a1a2e',
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{
                          background: hasTheme ? 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)' : '#fef3c7',
                          color: hasTheme ? '#fff' : '#92400e',
                          boxShadow: hasTheme ? '0 3px 10px rgba(251,191,36,0.35)' : 'none',
                        }}
                      >
                        {hasTheme ? <FileText size={18} strokeWidth={2.3} /> : <Plus size={18} strokeWidth={2.6} />}
                      </div>
                      <span className="text-[12px] font-extrabold leading-tight">
                        {hasTheme ? 'Brief' : 'Définir le brief'}
                      </span>
                      <span className="text-[10px] font-semibold leading-tight" style={{ color: hasTheme ? '#a0937c' : '#92400e' }}>
                        {hasTheme ? 'thème défini' : 'démarrer ici'}
                      </span>
                    </button>

                    {/* Quiz */}
                    <Link
                      href={hasTheme ? `/trainer/groups/${group.id}/quiz` : '#'}
                      onClick={(e) => { if (!hasTheme) e.preventDefault() }}
                      className={`flex-1 min-w-0 flex flex-col items-center gap-1.5 py-3 px-2 rounded-[18px] transition-all hover:-translate-y-0.5 ${hasTheme ? '' : 'pointer-events-none opacity-50 cursor-not-allowed'}`}
                      style={{
                        background: '#fff',
                        border: '2px solid #f0ebe0',
                        color: '#1a1a2e',
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{
                          background: hasTheme ? 'linear-gradient(135deg, #ddd6fe 0%, #a78bfa 100%)' : '#f0ebe0',
                          color: '#fff',
                          filter: hasTheme ? 'none' : 'grayscale(1)',
                        }}
                      >
                        <HelpCircle size={18} strokeWidth={2.3} />
                      </div>
                      <span className="text-[12px] font-extrabold leading-tight">Quiz</span>
                      <span className="text-[10px] font-semibold leading-tight" style={{ color: '#a0937c' }}>
                        {hasTheme ? 'voir résultats' : 'brief requis'}
                      </span>
                    </Link>

                    {/* Paramètres */}
                    <button
                      onClick={() => setDeletingGroupId(group.id)}
                      className="flex-1 min-w-0 flex flex-col items-center gap-1.5 py-3 px-2 rounded-[18px] transition-all hover:-translate-y-0.5"
                      style={{
                        background: '#fff',
                        border: '2px solid #f0ebe0',
                        color: '#1a1a2e',
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #e5e7eb 0%, #9ca3af 100%)',
                          color: '#fff',
                        }}
                      >
                        <Settings size={18} strokeWidth={2.3} />
                      </div>
                      <span className="text-[12px] font-extrabold leading-tight">Paramètres</span>
                      <span className="text-[10px] font-semibold leading-tight" style={{ color: '#a0937c' }}>
                        supprimer
                      </span>
                    </button>
                  </div>
                </div>

                {/* ── Toggle volet apprenants ── */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center justify-center gap-2 py-3 text-[12px] font-bold hover:bg-[#fffbf0] transition-colors"
                  style={{
                    color: '#a0937c',
                    borderTop: '2px solid #f0ebe0',
                    borderBottomLeftRadius: isExpanded ? 0 : 22,
                    borderBottomRightRadius: isExpanded ? 0 : 22,
                  }}
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                  />
                  {isExpanded ? 'Replier' : memberCount === 0 ? 'Aucun apprenant' : `Voir les ${memberCount} apprenant${memberCount > 1 ? 's' : ''}`}
                </button>

                {/* ── Volet apprenants full-width ── */}
                {isExpanded && (
                  <div
                    style={{
                      background: 'linear-gradient(180deg, #faf8f4 0%, #fffbf0 100%)',
                      borderTop: '1px solid #f0ebe0',
                      borderBottomLeftRadius: 22,
                      borderBottomRightRadius: 22,
                    }}
                  >
                    {members.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Aucun apprenant dans ce groupe</p>
                    ) : (
                      <div>
                        {members
                          .sort((a, b) => a.last_name.localeCompare(b.last_name, 'fr'))
                          .map((m, idx) => {
                            const isLastTwo = idx >= members.length - 2
                            return (
                              <div
                                key={m.learner_id}
                                className="flex items-center gap-3 px-5 py-3 hover:bg-white/70 transition-colors"
                                style={{ borderTop: idx === 0 ? 'none' : '1px solid #f0ebe0' }}
                              >
                                {/* Avatar */}
                                <div className="w-9 h-9 rounded-full font-extrabold flex items-center justify-center text-[12px] shrink-0" style={{ background: '#1a1a2e', color: '#fbbf24' }}>
                                  {m.first_name[0]}{m.last_name[0]}
                                </div>

                                {/* Nom cliquable → fiche apprenant */}
                                <Link
                                  href={`/trainer/apprenants?group=${group.id}&learner=${m.learner_id}`}
                                  className="flex-1 min-w-0"
                                >
                                  <p className="text-[14px] font-bold truncate" style={{ color: '#1a1a2e' }}>
                                    {m.first_name} {m.last_name}
                                  </p>
                                  <p className="text-[11px]" style={{ color: '#a0937c' }}>
                                    Voir la fiche détaillée →
                                  </p>
                                </Link>

                                {/* Menu membre */}
                                <div className="relative" data-menu>
                                  <button
                                    onClick={() => setOpenMenu(openMenu === m.learner_id ? null : m.learner_id)}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                  >
                                    <MoreVertical size={16} />
                                  </button>
                                  {openMenu === m.learner_id && (
                                    <div className={`absolute right-0 w-48 bg-white rounded-[18px] shadow-lg z-30 py-1 ${
                                      isLastTwo ? 'bottom-full mb-1' : 'top-full mt-1'
                                    }`} style={{ border: '2px solid #f0ebe0' }}>
                                      {groups.filter(g => g.id !== group.id).length > 0 && (
                                        <>
                                          <p className="px-3 py-1.5 text-[11px] text-gray-400 font-medium uppercase tracking-wide">Réaffecter à</p>
                                          {groups
                                            .filter(g => g.id !== group.id)
                                            .map(g => (
                                              <button
                                                key={g.id}
                                                disabled={isPending}
                                                onClick={() => handleReassign(m.learner_id, group.id, g.id)}
                                                className="w-full text-left px-3 py-2 text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                                                style={{ color: '#1a1a2e' }}
                                                onMouseEnter={e => { e.currentTarget.style.background = '#fffbeb' }}
                                                onMouseLeave={e => { e.currentTarget.style.background = '' }}
                                              >
                                                <span>🔄</span> {g.name}
                                              </button>
                                            ))}
                                          <div className="border-t border-gray-100 my-1" />
                                        </>
                                      )}
                                      <button
                                        onClick={() => openDeleteLearner(m.learner_id, group.id)}
                                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                      >
                                        <Trash2 size={14} /> Supprimer
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modale Brief de formation (nouveau — v1.29.4) */}
      {briefGroupId && (() => {
        const g = groups.find(x => x.id === briefGroupId)
        if (!g) return null
        return (
          <GroupBriefModal
            groupId={g.id}
            groupName={g.name}
            initialTheme={g.theme}
            open={!!briefGroupId}
            onClose={() => setBriefGroupId(null)}
            onSaved={() => router.refresh()}
          />
        )
      })()}

      {/* Popup confirmation suppression apprenant */}
      {deletingLearnerId && deletingLearner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }} />
          <div className="relative bg-white rounded-[28px] shadow-xl max-w-sm w-full" style={{ border: '2px solid #f0ebe0' }}>
            <button onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }} className="absolute top-3 right-3 text-gray-500 hover:text-gray-600">
              <X size={18} />
            </button>
            <div className="p-6 text-center">
              <span className="text-4xl">🗑️</span>
              <h3 className="text-lg font-bold text-gray-800 mt-3">Supprimer ce participant ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Vous allez supprimer définitivement <strong className="text-gray-700">{deletingLearner.first_name} {deletingLearner.last_name}</strong> ainsi que toutes ses données (axes, actions, check-ins).
              </p>
              <p className="text-xs text-red-500 mt-2 font-medium">Cette action est irréversible.</p>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }}
                  className="btn-secondary flex-1"
                >
                  Annuler
                </button>
                <button
                  disabled={isPending}
                  onClick={handleDeleteLearner}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup confirmation suppression groupe */}
      {deletingGroupId && deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeletingGroupId(null)} />
          <div className="relative bg-white rounded-[28px] shadow-xl max-w-sm w-full" style={{ border: '2px solid #f0ebe0' }}>
            <button onClick={() => setDeletingGroupId(null)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-600">
              <X size={18} />
            </button>
            <div className="p-6 text-center">
              <span className="text-4xl">🗑️</span>
              <h3 className="text-lg font-bold text-gray-800 mt-3">Supprimer ce groupe ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Le groupe <strong className="text-gray-700">{deletingGroup.name}</strong> sera supprimé. Les participants ne seront pas supprimés.
              </p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setDeletingGroupId(null)} className="btn-secondary flex-1">
                  Annuler
                </button>
                <button
                  disabled={isPending}
                  onClick={handleDeleteGroup}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {isPending ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
