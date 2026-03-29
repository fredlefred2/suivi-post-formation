'use client'

import { useState, useTransition, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, X, MoreVertical, ChevronRight, Sparkles, Loader2, Download } from 'lucide-react'
import { createGroup, deleteGroup } from '@/app/(trainer)/trainer/groups/actions'
import { assignToGroup } from '@/app/(trainer)/trainer/apprenants/actions'
import type { GroupListItem } from './page'

type UnassignedLearner = { id: string; first_name: string; last_name: string }

const WEATHER_ICONS: Record<string, string> = {
  sunny: '☀️',
  cloudy: '⛅',
  stormy: '⛈️',
}

export default function TrainerGroupsListClient({
  groups,
  unassignedLearners,
}: {
  groups: GroupListItem[]
  unassignedLearners: UnassignedLearner[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null)
  const [rewritingTheme, setRewritingTheme] = useState(false)
  const [createThemeValue, setCreateThemeValue] = useState('')
  const [showWaitingRoom, setShowWaitingRoom] = useState(false)
  const [assigningTo, setAssigningTo] = useState<string | null>(null)
  const [downloadingGroupId, setDownloadingGroupId] = useState<string | null>(null)
  const [downloadStatus, setDownloadStatus] = useState('')

  // Close menus on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest('[data-menu]')) setOpenMenu(null)
  }, [])

  useEffect(() => {
    if (openMenu) document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [openMenu, handleOutsideClick])

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
      else {
        setShowForm(false)
        setCreateThemeValue('')
      }
    })
  }

  function handleDeleteGroup() {
    if (!deletingGroupId) return
    startTransition(async () => {
      await deleteGroup(deletingGroupId)
      setDeletingGroupId(null)
    })
  }

  async function handleAssign(learnerId: string, groupId: string) {
    startTransition(async () => {
      await assignToGroup(learnerId, groupId)
      fetch('/api/tips/generate-for-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, groupId }),
      }).catch(() => {})
      setAssigningTo(null)
    })
  }

  async function handleDownloadReport(groupId: string) {
    setDownloadingGroupId(groupId)
    setOpenMenu(null)
    try {
      // Étape 1 : Récupérer les données du groupe
      setDownloadStatus('Collecte des données...')
      const dataRes = await fetch(`/api/group-report?groupId=${groupId}&mode=data`, { credentials: 'include' })
      if (!dataRes.ok) throw new Error(`Erreur données (${dataRes.status})`)
      const reportData = await dataRes.json()

      // Étape 2 : Analyse IA
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
      } catch { /* IA optionnelle */ }

      // Étape 3 : Générer le PDF
      setDownloadStatus('Génération PDF...')
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

      {/* Formulaire de création */}
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
                <label className="block text-xs font-medium text-gray-600">Thème de la formation</label>
                {createThemeValue.trim().length >= 5 && (
                  <button
                    type="button"
                    disabled={rewritingTheme}
                    onClick={() => handleRewriteTheme(createThemeValue, setCreateThemeValue)}
                    className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 font-medium transition-colors disabled:opacity-50"
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
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm min-h-[80px] resize-y focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition-all"
                placeholder="Ex: Communication assertive, gestion des conflits..."
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={isPending}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50">
                {isPending ? 'Création...' : 'Créer'}
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
      {groups.length === 0 && unassignedLearners.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-12">
          <p className="text-4xl mb-3">👥</p>
          <p className="text-gray-500">Vous n&apos;avez pas encore créé de groupe.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {groups.map((group) => (
            <div key={group.id}
              className="bg-white rounded-2xl shadow-sm border border-violet-200/30 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-visible relative"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05), 0 4px 16px rgba(99,102,241,0.12)' }}
            >
              <div className="flex items-center gap-3 px-4 py-3.5">
                {/* Zone cliquable → page groupe */}
                <Link
                  href={`/trainer/groups/${group.id}`}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-lg shrink-0">
                    👥
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-[15px] truncate">{group.name}</p>
                      <span className="text-[11px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-medium shrink-0">
                        {group.memberCount}
                      </span>
                    </div>
                    {group.theme && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">{group.theme}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {group.avgWeather && (
                      <span className="text-lg">{WEATHER_ICONS[group.avgWeather]}</span>
                    )}
                    <ChevronRight size={18} className="text-gray-300" />
                  </div>
                </Link>

                {/* Menu contextuel */}
                <div className="relative" data-menu>
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === group.id ? null : group.id) }}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                  >
                    <MoreVertical size={16} />
                  </button>
                  {openMenu === group.id && (
                    <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1">
                      <Link
                        href={`/trainer/groups/${group.id}`}
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        onClick={() => setOpenMenu(null)}
                      >
                        <span>✏️</span> Modifier
                      </Link>
                      <button
                        onClick={() => handleDownloadReport(group.id)}
                        disabled={downloadingGroupId === group.id}
                        className="w-full text-left px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
                      >
                        {downloadingGroupId === group.id
                          ? <><Loader2 size={14} className="animate-spin" /> {downloadStatus || 'Génération...'}</>
                          : <><Download size={14} /> Télécharger rapport</>
                        }
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setDeletingGroupId(group.id); setOpenMenu(null) }}
                        className="w-full text-left px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <span>🗑️</span> Supprimer le groupe
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Salle d'attente */}
          {unassignedLearners.length > 0 && (
            <div
              className="rounded-2xl shadow-sm border transition-all duration-200 overflow-visible"
              style={{
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                borderColor: 'rgba(245,158,11,0.3)',
              }}
            >
              <button
                onClick={() => setShowWaitingRoom(!showWaitingRoom)}
                className="flex items-center gap-3 px-4 py-3.5 w-full text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-lg shrink-0">
                  ⏳
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-amber-800 text-[15px]">Salle d&apos;attente</p>
                    <span className="text-[11px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                      {unassignedLearners.length}
                    </span>
                  </div>
                  <p className="text-xs text-amber-600 mt-0.5">Apprenants non affectés</p>
                </div>
                <ChevronRight size={18} className={`text-amber-400 transition-transform duration-200 ${showWaitingRoom ? 'rotate-90' : ''}`} />
              </button>

              {showWaitingRoom && (
                <div className="border-t border-amber-200/50 px-4 py-3 space-y-2">
                  {unassignedLearners.map((learner) => (
                    <div key={learner.id} className="flex items-center gap-3 py-1.5">
                      <div className="w-8 h-8 rounded-full bg-amber-200 text-amber-800 font-semibold flex items-center justify-center text-xs shrink-0">
                        {learner.first_name[0]}{learner.last_name[0]}
                      </div>
                      <span className="flex-1 text-sm font-medium text-amber-900 truncate">
                        {learner.first_name} {learner.last_name}
                      </span>
                      {groups.length > 0 && (
                        <div className="relative" data-menu>
                          <button
                            onClick={() => setAssigningTo(assigningTo === learner.id ? null : learner.id)}
                            className="text-xs text-amber-700 hover:text-amber-900 font-medium bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-lg transition-colors"
                          >
                            Affecter →
                          </button>
                          {assigningTo === learner.id && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-1">
                              {groups.map((g) => (
                                <button
                                  key={g.id}
                                  disabled={isPending}
                                  onClick={() => handleAssign(learner.id, g.id)}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 transition-colors disabled:opacity-50"
                                >
                                  {g.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Version */}
      <p className="text-center text-[11px] text-gray-400 mt-8">YAPLUKA v1.28</p>

      {/* Popup confirmation suppression groupe */}
      {deletingGroupId && deletingGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeletingGroupId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full">
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
                <button onClick={() => setDeletingGroupId(null)} className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-colors">
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
