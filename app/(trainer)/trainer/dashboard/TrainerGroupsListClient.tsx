'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, X, ChevronDown, Pencil, Trash2, Sparkles, Loader2, Download } from 'lucide-react'
import { createGroup, deleteGroup, removeLearnerFromGroup, updateGroupTheme } from '@/app/(trainer)/trainer/groups/actions'
import { assignToGroup, deleteLearner } from '@/app/(trainer)/trainer/apprenants/actions'
import type { GroupListItem } from './page'

type MemberInfo = { learner_id: string; first_name: string; last_name: string }

export default function TrainerGroupsListClient({
  groups,
}: {
  groups: GroupListItem[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [deletingLearnerId, setDeletingLearnerId] = useState<string | null>(null)
  const [deletingLearnerGroupId, setDeletingLearnerGroupId] = useState<string | null>(null)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editTheme, setEditTheme] = useState('')
  const [rewritingTheme, setRewritingTheme] = useState(false)
  const [createThemeValue, setCreateThemeValue] = useState('')
  const [memberMenuOpen, setMemberMenuOpen] = useState<string | null>(null)
  const [downloadingGroupId, setDownloadingGroupId] = useState<string | null>(null)
  const [downloadStatus, setDownloadStatus] = useState('')

  // Close menus on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-menu]')) {
      setMemberMenuOpen(null)
    }
  }, [])

  useEffect(() => {
    if (memberMenuOpen) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [memberMenuOpen, handleOutsideClick])

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

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
    } catch { /* silently fail */ }
    setRewritingTheme(false)
  }

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const result = await createGroup(formData)
      if (result?.error) setError(result.error)
      else { setShowForm(false); setCreateThemeValue('') }
    })
  }

  function handleDeleteGroup() {
    if (!deletingGroupId) return
    startTransition(async () => {
      await deleteGroup(deletingGroupId)
      setDeletingGroupId(null)
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

  function handleReassign(learnerId: string, fromGroupId: string, toGroupId: string) {
    setMemberMenuOpen(null)
    startTransition(async () => {
      await removeLearnerFromGroup(fromGroupId, learnerId)
      await assignToGroup(learnerId, toGroupId)
      fetch('/api/tips/generate-for-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, groupId: toGroupId }),
      }).catch(() => {})
    })
  }

  function openEditGroup(group: GroupListItem) {
    setEditingGroupId(group.id)
    setEditName(group.name)
    setEditTheme(group.theme ?? '')
  }

  async function handleSaveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingGroupId) return
    startTransition(async () => {
      // Update name via createGroup won't work, use direct update
      const formData = new FormData()
      formData.set('name', editName)
      formData.set('theme', editTheme)
      await updateGroupTheme(editingGroupId, editTheme)
      setEditingGroupId(null)
    })
  }

  async function handleDownloadReport(groupId: string) {
    setDownloadingGroupId(groupId)
    try {
      setDownloadStatus('Collecte des donnees...')
      const dataRes = await fetch(`/api/group-report?groupId=${groupId}&mode=data`, { credentials: 'include' })
      if (!dataRes.ok) throw new Error(`Erreur (${dataRes.status})`)
      const reportData = await dataRes.json()

      setDownloadStatus('Analyse IA...')
      let aiAnalysis = null
      try {
        const aiRes = await fetch('/api/ai-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(reportData),
        })
        if (aiRes.ok) {
          const rawText = await aiRes.text()
          const jsonMatch = rawText.match(/\{[\s\S]*\}/)
          if (jsonMatch) aiAnalysis = JSON.parse(jsonMatch[0])
        }
      } catch { /* optionnel */ }

      setDownloadStatus('Generation PDF...')
      const pdfRes = await fetch('/api/group-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData, aiAnalysis }),
      })
      if (!pdfRes.ok) throw new Error(`Erreur PDF (${pdfRes.status})`)

      const blob = await pdfRes.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = pdfRes.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'rapport.pdf'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('[PDF] Error:', err)
    }
    setDownloadingGroupId(null)
    setDownloadStatus('')
  }

  const deletingGroup = deletingGroupId ? groups.find((g) => g.id === deletingGroupId) : null
  const deletingLearner = deletingLearnerId && deletingLearnerGroupId
    ? groups.find((g) => g.id === deletingLearnerGroupId)?.members.find((m) => m.learner_id === deletingLearnerId)
    : null

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-[22px] font-extrabold text-gray-900 tracking-tight">Mes groupes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-white text-sm font-semibold rounded-xl shadow-lg transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%)', boxShadow: '0 4px 15px rgba(79,70,229,0.4)' }}
        >
          <Plus size={15} /> Nouveau
        </button>
      </div>

      {/* Formulaire de creation */}
      {showForm && (
        <div className="bg-white rounded-2xl border-2 border-indigo-100 shadow-sm p-5">
          <p className="font-semibold text-gray-800 text-sm mb-3">Nouveau groupe</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom du groupe *</label>
              <input name="name" required className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition-all" placeholder="Ex: Management — Oct. 2024" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-600">Theme de la formation</label>
                {createThemeValue.trim().length >= 5 && (
                  <button type="button" disabled={rewritingTheme}
                    onClick={() => handleRewriteTheme(createThemeValue, setCreateThemeValue)}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors disabled:opacity-50">
                    {rewritingTheme ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {rewritingTheme ? 'Reecriture...' : 'Reformuler'}
                  </button>
                )}
              </div>
              <textarea name="theme" value={createThemeValue} onChange={e => setCreateThemeValue(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-[80px] resize-y focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition-all"
                placeholder="Ex: Communication assertive, gestion des conflits..." />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {isPending ? 'Creation...' : 'Creer'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setCreateThemeValue('') }}
                className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des groupes */}
      {groups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">Vous n&apos;avez pas encore cree de groupe.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id)
            const isSalleAttente = group.name === 'Salle d\'attente'
            return (
              <div key={group.id}
                className={`rounded-2xl shadow-sm border overflow-visible ${
                  isSalleAttente ? 'border-amber-200/50' : 'border-violet-200/30'
                }`}
                style={isSalleAttente
                  ? { background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(245,158,11,0.12)' }
                  : { background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(99,102,241,0.12)' }
                }
              >
                {/* Header du groupe */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  {/* Icone + nom cliquable vers page groupe */}
                  <Link href={`/trainer/groups/${group.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                      isSalleAttente ? 'bg-amber-100' : 'bg-indigo-50'
                    }`}>
                      {isSalleAttente ? '⏳' : '👥'}
                    </div>
                    <p className={`font-bold text-[15px] truncate ${
                      isSalleAttente ? 'text-amber-800' : 'text-gray-900'
                    }`}>{group.name}</p>
                  </Link>

                  {/* Actions a droite : nb membres (depliable) + crayon + corbeille */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Badge nb membres = bouton deplier */}
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="flex items-center gap-1 text-[11px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-full font-medium hover:bg-indigo-100 transition-colors"
                    >
                      {group.memberCount}
                      <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Crayon = modifier */}
                    <button
                      onClick={() => openEditGroup(group)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
                      title="Modifier le groupe"
                    >
                      <Pencil size={15} />
                    </button>

                    {/* Corbeille = supprimer */}
                    <button
                      onClick={() => setDeletingGroupId(group.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                      title="Supprimer le groupe"
                    >
                      <Trash2 size={15} />
                    </button>

                    {/* Download rapport */}
                    <button
                      onClick={() => handleDownloadReport(group.id)}
                      disabled={downloadingGroupId === group.id}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                      title="Telecharger rapport"
                    >
                      {downloadingGroupId === group.id
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Download size={15} />
                      }
                    </button>
                  </div>
                </div>

                {/* Volet depliable : liste des membres */}
                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {group.members.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-6">Aucun participant</p>
                    ) : (
                      <div>
                        {group.members.map((m, idx) => {
                          const isLastTwo = idx >= group.members.length - 2
                          return (
                            <div key={m.learner_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-800 font-semibold flex items-center justify-center text-xs shrink-0">
                                {m.first_name[0]}{m.last_name[0]}
                              </div>
                              <Link href={`/trainer/learner/${m.learner_id}?group=${group.id}`} className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 hover:text-indigo-600 transition-colors truncate">
                                  {m.first_name} {m.last_name}
                                </p>
                              </Link>

                              {/* Menu membre */}
                              <div className="relative" data-menu>
                                <button
                                  onClick={() => setMemberMenuOpen(memberMenuOpen === m.learner_id ? null : m.learner_id)}
                                  className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                                >
                                  <span className="text-xs">⋯</span>
                                </button>
                                {memberMenuOpen === m.learner_id && (
                                  <div className={`absolute right-0 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50 py-1 ${
                                    isLastTwo ? 'bottom-full mb-1' : 'top-full mt-1'
                                  }`}>
                                    {groups.filter(g => g.id !== group.id).length > 0 && (
                                      <>
                                        <p className="px-3 py-1.5 text-[11px] text-gray-400 font-medium uppercase tracking-wide">Reaffecter a</p>
                                        {groups.filter(g => g.id !== group.id).map(g => (
                                          <button key={g.id} disabled={isPending}
                                            onClick={() => handleReassign(m.learner_id, group.id, g.id)}
                                            className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-50 flex items-center gap-2">
                                            <span>🔄</span> {g.name}
                                          </button>
                                        ))}
                                        <div className="border-t border-gray-100 my-1" />
                                      </>
                                    )}
                                    <button
                                      onClick={() => {
                                        setMemberMenuOpen(null)
                                        setTimeout(() => {
                                          setDeletingLearnerId(m.learner_id)
                                          setDeletingLearnerGroupId(group.id)
                                        }, 50)
                                      }}
                                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                      <span>🗑️</span> Supprimer
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

      {/* Version */}
      <p className="text-center text-[11px] text-gray-400 mt-8">YAPLUKA v1.28</p>

      {/* Modale edition groupe */}
      {editingGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setEditingGroupId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full">
            <button onClick={() => setEditingGroupId(null)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-600">
              <X size={18} />
            </button>
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">Modifier le groupe</h3>
              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nom du groupe</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} required
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition-all" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-600">Theme de la formation</label>
                    {editTheme.trim().length >= 5 && (
                      <button type="button" disabled={rewritingTheme}
                        onClick={() => handleRewriteTheme(editTheme, setEditTheme)}
                        className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors disabled:opacity-50">
                        {rewritingTheme ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {rewritingTheme ? 'Reecriture...' : 'Reformuler'}
                      </button>
                    )}
                  </div>
                  <textarea value={editTheme} onChange={(e) => setEditTheme(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-[80px] resize-y focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition-all"
                    placeholder="Ex: Communication assertive..." />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={isPending}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                    {isPending ? 'Enregistrement...' : 'Enregistrer'}
                  </button>
                  <button type="button" onClick={() => setEditingGroupId(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Popup suppression groupe */}
      {deletingGroupId && deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeletingGroupId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full">
            <button onClick={() => setDeletingGroupId(null)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-600"><X size={18} /></button>
            <div className="p-6 text-center">
              <span className="text-4xl">🗑️</span>
              <h3 className="text-lg font-bold text-gray-800 mt-3">Supprimer ce groupe ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                Le groupe <strong className="text-gray-700">{deletingGroup.name}</strong> sera supprime. Les participants ne seront pas supprimes.
              </p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setDeletingGroupId(null)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
                <button disabled={isPending} onClick={handleDeleteGroup}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
                  {isPending ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popup suppression apprenant */}
      {deletingLearnerId && deletingLearner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full">
            <button onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }} className="absolute top-3 right-3 text-gray-500 hover:text-gray-600"><X size={18} /></button>
            <div className="p-6 text-center">
              <span className="text-4xl">🗑️</span>
              <h3 className="text-lg font-bold text-gray-800 mt-3">Supprimer ce participant ?</h3>
              <p className="text-sm text-gray-500 mt-2">
                <strong className="text-gray-700">{deletingLearner.first_name} {deletingLearner.last_name}</strong> et toutes ses donnees seront supprimes.
              </p>
              <p className="text-xs text-red-500 mt-2 font-medium">Cette action est irreversible.</p>
              <div className="flex gap-3 mt-5">
                <button onClick={() => { setDeletingLearnerId(null); setDeletingLearnerGroupId(null) }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">Annuler</button>
                <button disabled={isPending} onClick={handleDeleteLearner}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50">
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
