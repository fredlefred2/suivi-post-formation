'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { X, FileText, Sparkles, Loader2, Check, Info } from 'lucide-react'
import { updateGroupTheme } from '@/app/(trainer)/trainer/groups/actions'
import { QUIZ_BRIEF_MAX_LENGTH } from '@/lib/types'

type Props = {
  groupId: string
  groupName: string
  initialTheme: string | null
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

export default function GroupBriefModal({ groupId, groupName, initialTheme, open, onClose, onSaved }: Props) {
  const [value, setValue] = useState(initialTheme ?? '')
  const [rewriting, setRewriting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      setValue(initialTheme ?? '')
      setError(null)
      // auto-focus
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open, initialTheme])

  // Échap pour fermer
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const handleRewrite = async () => {
    if (value.trim().length < 20) {
      setError('Écris au moins 20 caractères avant de reformuler.')
      return
    }
    setError(null)
    setRewriting(true)
    try {
      const res = await fetch('/api/theme/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: value }),
      })
      const data = await res.json()
      if (data.rewritten) setValue(data.rewritten)
      else setError("L'IA n'a pas pu reformuler, réessaie.")
    } catch {
      setError('Erreur réseau lors de la reformulation.')
    }
    setRewriting(false)
  }

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateGroupTheme(groupId, value)
      if (result?.error) {
        setError(result.error)
      } else {
        onSaved?.()
        onClose()
      }
    })
  }

  if (!open) return null

  const length = value.length
  const tooShort = length > 0 && length < 20
  const tooLong = length > QUIZ_BRIEF_MAX_LENGTH
  const canSave = !tooLong && !isPending && value.trim() !== (initialTheme ?? '').trim()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative bg-white rounded-[26px] shadow-xl w-full max-w-[560px] max-h-[90vh] flex flex-col" style={{ border: '2px solid #f0ebe0' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4" style={{ borderBottom: '2px solid #f0ebe0' }}>
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                boxShadow: '0 3px 10px rgba(251,191,36,0.35)',
              }}
            >
              <FileText size={20} className="text-white" strokeWidth={2.2} />
            </div>
            <div>
              <h3 className="text-[17px] font-extrabold" style={{ color: '#1a1a2e' }}>Brief de formation</h3>
              <p className="text-[12px] mt-0.5" style={{ color: '#a0937c' }}>{groupName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div>
            <p className="text-[13px] font-bold mb-2" style={{ color: '#1a1a2e' }}>À quoi sert le brief ?</p>
            <p className="text-[12px] leading-relaxed" style={{ color: '#6b6761' }}>
              Le brief décrit le thème de ta formation. Il sert à générer automatiquement les questions
              du quiz bimensuel avec l&apos;IA. Plus il est précis, plus les quiz seront pertinents.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[13px] font-bold" style={{ color: '#1a1a2e' }}>Thème</label>
              <button
                onClick={handleRewrite}
                disabled={rewriting || value.trim().length < 20}
                className="flex items-center gap-1.5 text-[12px] font-bold transition-colors px-2.5 py-1 rounded-lg hover:bg-[#fffbeb] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ color: '#92400e' }}
              >
                {rewriting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                {rewriting ? 'Réécriture…' : 'Reformuler avec l\'IA'}
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              onChange={e => setValue(e.target.value)}
              className="w-full rounded-2xl px-4 py-3 text-[14px] resize-y"
              style={{
                border: `2px solid ${tooLong ? '#ef4444' : '#f0ebe0'}`,
                minHeight: 160,
                background: '#faf8f4',
                color: '#1a1a2e',
                outline: 'none',
              }}
              placeholder="Ex : Techniques de découverte client, reformulation du besoin et argumentation selon la méthode SONCAS. Contexte : vente conseil en magasin, secteur équipement de la maison."
            />
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-[11px]" style={{ color: tooShort ? '#b91c1c' : '#a0937c' }}>
                {tooShort ? 'Au moins 20 caractères pour générer un quiz.' : 'Plus c\'est précis, mieux c\'est.'}
              </p>
              <p className="text-[11px] font-bold" style={{ color: tooLong ? '#b91c1c' : '#a0937c' }}>
                {length} / {QUIZ_BRIEF_MAX_LENGTH}
              </p>
            </div>
          </div>

          {/* Info impact quiz */}
          {length >= 20 && !tooLong && (
            <div className="rounded-2xl p-3.5 flex items-start gap-2.5" style={{ background: '#fffbeb', border: '2px solid #fde68a' }}>
              <Info size={16} className="shrink-0 mt-0.5" style={{ color: '#92400e' }} />
              <p className="text-[12px] leading-relaxed" style={{ color: '#92400e' }}>
                Les 4 questions du prochain quiz (semaine paire, jeudi 8h) seront générées à partir de ce brief.
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-xl px-4 py-3 text-[13px]" style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4" style={{ borderTop: '2px solid #f0ebe0', background: '#faf8f4', borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-[13px] font-bold rounded-xl text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-extrabold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: '#fbbf24',
              color: '#1a1a2e',
              boxShadow: canSave ? '0 4px 14px rgba(251,191,36,0.3)' : 'none',
            }}
          >
            {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
            {isPending ? 'Enregistrement…' : 'Enregistrer le brief'}
          </button>
        </div>
      </div>
    </div>
  )
}
