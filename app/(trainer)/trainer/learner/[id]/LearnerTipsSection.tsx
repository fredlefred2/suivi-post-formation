'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'

type TipData = {
  id: string
  axe_id: string
  week_number: number
  content: string
  advice: string | null
  sent: boolean
  acted: boolean
  read_at: string | null
  next_scheduled: boolean
}

type AxeTipGroup = {
  axeId: string
  axeSubject: string
  tips: TipData[]
}

type Props = {
  learnerId: string
  axes: Array<{ id: string; subject: string }>
}

export default function LearnerTipsSection({ learnerId, axes }: Props) {
  const [axeTips, setAxeTips] = useState<AxeTipGroup[]>([])
  const [loaded, setLoaded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editAdvice, setEditAdvice] = useState('')
  const [saving, setSaving] = useState(false)
  const [showRegen, setShowRegen] = useState(false)
  const [regenAxeId, setRegenAxeId] = useState('')
  const [regenerating, setRegenerating] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genAxeId, setGenAxeId] = useState(axes[0]?.id || '')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Fetch tips ──────────────────────────────────────────────
  const fetchTips = useCallback(async () => {
    try {
      const res = await fetch(`/api/tips/admin/learner?learnerId=${learnerId}`)
      if (res.ok) {
        const data = await res.json()
        setAxeTips(data.axeTips || [])
      }
    } catch {
      // silently fail
    }
    setLoaded(true)
  }, [learnerId])

  useEffect(() => { fetchTips() }, [fetchTips])

  // ── Données dérivées ────────────────────────────────────────
  const allTips = axeTips.flatMap(g => g.tips.map(t => ({ ...t, axeSubject: g.axeSubject })))
  const scheduled = allTips.find(t => t.next_scheduled && !t.sent) || null
  const sentTips = allTips.filter(t => t.sent).sort((a, b) => b.week_number - a.week_number)

  // ── Modifier ──────────────────────────────────────────────────
  function startEdit() {
    if (!scheduled) return
    setEditContent(scheduled.content)
    setEditAdvice(scheduled.advice || '')
    setEditing(true)
  }

  async function saveEdit() {
    if (!scheduled) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/tips/admin', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipId: scheduled.id, content: editContent, advice: editAdvice }),
      })
      if (res.ok) {
        setEditing(false)
        await fetchTips()
      } else {
        setError('Erreur lors de la sauvegarde')
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Régénérer ─────────────────────────────────────────────────
  function openRegen() {
    setRegenAxeId(scheduled?.axe_id || axes[0]?.id || '')
    setShowRegen(true)
  }

  async function doRegen() {
    setRegenerating(true)
    setError(null)
    try {
      let res: Response
      if (scheduled && regenAxeId === scheduled.axe_id) {
        res = await fetch('/api/tips/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'regenerate', tipId: scheduled.id }),
        })
      } else {
        res = await fetch('/api/tips/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate-next', axeId: regenAxeId, learnerId }),
        })
      }
      if (res.ok) {
        await fetchTips()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erreur lors de la régénération')
      }
    } finally {
      setRegenerating(false)
      setShowRegen(false)
    }
  }

  // ── Générer (quand aucun tip programmé) ────────────────────────
  async function doGenerate() {
    if (!genAxeId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/tips/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-next', axeId: genAxeId, learnerId }),
      })
      if (res.ok) {
        await fetchTips()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erreur lors de la génération')
      }
    } finally {
      setGenerating(false)
    }
  }

  if (axes.length === 0) return null

  if (!loaded) return (
    <div className="rounded-2xl border-2 border-amber-200 p-4 text-center" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)' }}>
      <div className="flex items-center justify-center gap-2 text-amber-700 text-sm">
        <Loader2 size={16} className="animate-spin" /> Chargement tips...
      </div>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* ── Erreur ─────────────────────────────────────────────── */}
      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          ⚠️ {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* ── Prochain tip OU état vide ──────────────────────────── */}
      {scheduled && !editing ? (
        <div className="rounded-2xl border-2 border-amber-200 p-4" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🤖</span>
              <h2 className="font-bold text-sm text-amber-900">Prochain tip</h2>
            </div>
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              Envoi mardi 8h
            </span>
          </div>

          <div className="text-xs text-amber-700 font-medium mb-2">
            🎯 {scheduled.axeSubject}
          </div>

          <div className="bg-white/70 rounded-xl p-3 mb-2">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-1">Rappel</p>
            <p className="text-sm text-gray-700 leading-relaxed">{scheduled.content}</p>
          </div>

          {scheduled.advice && (
            <div className="bg-white/70 rounded-xl p-3 mb-3">
              <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-1">Conseil</p>
              <p className="text-sm text-gray-700 leading-relaxed">{scheduled.advice}</p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={startEdit}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white rounded-xl text-xs font-semibold text-amber-700 border border-amber-200 hover:bg-amber-50 transition-colors"
            >
              ✏️ Modifier
            </button>
            <button
              onClick={openRegen}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white rounded-xl text-xs font-semibold text-amber-700 border border-amber-200 hover:bg-amber-50 transition-colors"
            >
              🔄 Régénérer
            </button>
          </div>
        </div>
      ) : scheduled && editing ? (
        /* ── Mode édition ──────────────────────────────────────── */
        <div className="rounded-2xl border-2 border-amber-200 p-4" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fff7ed 100%)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">✏️</span>
              <h2 className="font-bold text-sm text-amber-900">Modifier le tip</h2>
            </div>
            <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-700">
              ✕ Annuler
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block mb-1">Rappel</label>
              <textarea
                rows={3}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="w-full text-sm border border-amber-200 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-300 focus:border-amber-300 outline-none resize-none bg-white/80"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block mb-1">Conseil</label>
              <textarea
                rows={4}
                value={editAdvice}
                onChange={e => setEditAdvice(e.target.value)}
                className="w-full text-sm border border-amber-200 rounded-xl p-2.5 focus:ring-2 focus:ring-amber-300 focus:border-amber-300 outline-none resize-none bg-white/80"
              />
            </div>
            <button
              onClick={saveEdit}
              disabled={saving}
              className="w-full py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
            >
              {saving ? '⏳ Enregistrement...' : '💾 Enregistrer'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Aucun tip programmé ───────────────────────────────── */
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 p-5 text-center">
          <span className="text-3xl">🤖</span>
          <p className="font-bold text-sm text-amber-900 mt-2">Aucun tip programmé</p>
          <p className="text-xs text-amber-700 mt-1">Le prochain sera généré automatiquement lundi 17h</p>

          <div className="mt-3">
            <select
              value={genAxeId}
              onChange={e => setGenAxeId(e.target.value)}
              className="text-xs border border-amber-200 rounded-lg px-2 py-1.5 bg-white text-amber-800 mb-2"
            >
              {axes.map(a => (
                <option key={a.id} value={a.id}>🎯 {a.subject}</option>
              ))}
            </select>
          </div>

          <button
            onClick={doGenerate}
            disabled={generating}
            className="px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Génération...</span>
            ) : (
              '⚡ Générer maintenant'
            )}
          </button>
        </div>
      )}

      {/* ── Historique tips envoyés ────────────────────────────── */}
      {sentTips.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📜</span>
              <h2 className="font-bold text-sm text-gray-700">Tips envoyés</h2>
              <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{sentTips.length}</span>
            </div>
            <ChevronDown
              size={16}
              className={`text-gray-400 transition-transform duration-200 ${historyOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {historyOpen && (
            <div className="mt-3 space-y-3">
              {sentTips.map(tip => (
                <div key={tip.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-semibold text-gray-500">S.{tip.week_number} — {tip.axeSubject}</span>
                    {tip.read_at ? (
                      <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓ Lu</span>
                    ) : (
                      <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Non lu</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    <strong className="text-gray-700">Rappel : </strong>{tip.content}
                  </p>
                  {tip.advice && (
                    <p className="text-xs text-gray-600 leading-relaxed mt-1">
                      <strong className="text-gray-700">Conseil : </strong>{tip.advice}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Régénérer ────────────────────────────────────── */}
      {showRegen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm shadow-2xl">
            <div className="text-center mb-4">
              <span className="text-4xl">🔄</span>
              <h3 className="font-bold text-lg mt-2">Régénérer ce tip ?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Claude va réécrire le rappel et le conseil en tenant compte du contexte actuel.
              </p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-semibold text-gray-600 block mb-1.5">Sur quel axe ?</label>
              <select
                value={regenAxeId}
                onChange={e => setRegenAxeId(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl p-2.5 bg-gray-50"
              >
                {axes.map(a => (
                  <option key={a.id} value={a.id}>
                    🎯 {a.subject}{a.id === scheduled?.axe_id ? ' (actuel)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowRegen(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={doRegen}
                disabled={regenerating}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 disabled:opacity-50"
              >
                {regenerating ? (
                  <span className="flex items-center justify-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Génération...</span>
                ) : 'Régénérer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
