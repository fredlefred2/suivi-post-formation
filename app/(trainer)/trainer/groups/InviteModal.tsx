'use client'

import { useState, useEffect, useTransition } from 'react'
import { X, Plus, Trash2, Mail, QrCode, UserPlus, Loader2, RefreshCw, Copy, Printer, CheckCircle, AlertCircle } from 'lucide-react'
import {
  inviteLearnersByEmail,
  generateGroupInviteToken,
  getGroupInviteToken,
  type InviteResult,
  type InviteToken,
} from './invite-actions'
import { addLearnerToGroup } from './actions'

type Tab = 'email' | 'qr' | 'existing'

export default function InviteModal({
  groupId,
  groupName,
  onClose,
}: {
  groupId: string
  groupName: string
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('email')

  // ─── État onglet Email ───
  const [rows, setRows] = useState<{ email: string; firstName: string; lastName: string }[]>([
    { email: '', firstName: '', lastName: '' },
  ])
  const [emailResults, setEmailResults] = useState<InviteResult[] | null>(null)
  const [emailSummary, setEmailSummary] = useState<{ invited: number; alreadyInGroup: number; addedExisting: number; failed: number } | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [sendingEmail, startSendEmail] = useTransition()

  function addRow() {
    setRows([...rows, { email: '', firstName: '', lastName: '' }])
  }
  function updateRow(i: number, key: 'email' | 'firstName' | 'lastName', value: string) {
    setRows(rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r))
  }
  function removeRow(i: number) {
    setRows(rows.filter((_, idx) => idx !== i))
  }

  function sendInvitations() {
    const valid = rows.filter(r => r.email.trim() && r.firstName.trim())
    if (!valid.length) {
      setEmailError('Ajoute au moins un apprenant avec email et prénom.')
      return
    }
    setEmailError(null)
    setEmailResults(null)
    setEmailSummary(null)
    startSendEmail(async () => {
      const result = await inviteLearnersByEmail(groupId, valid)
      if (result.error) { setEmailError(result.error); return }
      setEmailResults(result.results ?? [])
      setEmailSummary(result.summary ?? null)
      // Reset rows seulement si tout est OK
      if (result.summary && result.summary.failed === 0) {
        setRows([{ email: '', firstName: '', lastName: '' }])
      }
    })
  }

  // ─── État onglet QR ───
  const [token, setToken] = useState<InviteToken | null>(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [generating, startGenerate] = useTransition()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (tab !== 'qr') return
    setTokenLoading(true)
    getGroupInviteToken(groupId).then(r => {
      if (r.error) setTokenError(r.error)
      else setToken(r.token ?? null)
      setTokenLoading(false)
    })
  }, [tab, groupId])

  function handleGenerateOrRotate() {
    setTokenError(null)
    startGenerate(async () => {
      const r = await generateGroupInviteToken(groupId)
      if (r.error) setTokenError(r.error)
      else setToken(r.token ?? null)
    })
  }

  function handleCopy() {
    if (!token) return
    navigator.clipboard.writeText(token.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handlePrint() {
    if (!token) return
    const w = window.open('', '_blank', 'width=600,height=800')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><title>QR ${groupName}</title>
      <style>body{font-family:system-ui;text-align:center;padding:60px 20px;color:#1a1a2e;}
      h1{font-size:24px;margin:0 0 12px;}h2{font-size:14px;color:#a0937c;font-weight:500;margin:0 0 32px;}
      .qr{display:inline-block;padding:24px;background:white;border:2px solid #f0ebe0;border-radius:24px;}
      .url{font-family:monospace;font-size:13px;background:#faf8f4;padding:8px 14px;border-radius:8px;display:inline-block;margin-top:24px;}
      </style></head><body>
      <h1>${groupName}</h1>
      <h2>Scanne ce QR code pour rejoindre la formation</h2>
      <div class="qr">${token.qrSvg}</div>
      <div class="url">${token.url}</div>
      </body></html>`)
    w.document.close()
    setTimeout(() => w.print(), 200)
  }

  // ─── État onglet Existant ───
  const [existingEmail, setExistingEmail] = useState('')
  const [existingError, setExistingError] = useState<string | null>(null)
  const [existingSuccess, setExistingSuccess] = useState<string | null>(null)
  const [addingExisting, startAddExisting] = useTransition()

  function addExisting() {
    setExistingError(null); setExistingSuccess(null)
    startAddExisting(async () => {
      const r = await addLearnerToGroup(groupId, existingEmail.trim())
      if (r?.error) setExistingError(r.error)
      else {
        setExistingSuccess(`${r?.name ?? 'Apprenant'} ajouté(e) au groupe.`)
        setExistingEmail('')
      }
    })
  }

  // ─── Format expiration QR ───
  function formatExpiration(iso: string): string {
    const ms = new Date(iso).getTime() - Date.now()
    if (ms <= 0) return 'expiré'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8" style={{ background: 'rgba(26,26,46,0.45)' }}
         onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-[24px] w-full max-w-[580px] max-h-[90vh] overflow-y-auto p-6" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="font-display text-lg font-bold flex items-center gap-2" style={{ color: '#1a1a2e' }}>
              <Mail size={18} /> Inviter dans {groupName}
            </h2>
            <p className="text-xs mt-1" style={{ color: '#a0937c' }}>Trois manières d&apos;ajouter des apprenants à ce groupe.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" aria-label="Fermer"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ background: '#faf8f4' }}>
          <TabBtn active={tab === 'email'} onClick={() => setTab('email')} icon={<Mail size={14} />} label="Par email" />
          <TabBtn active={tab === 'qr'} onClick={() => setTab('qr')} icon={<QrCode size={14} />} label="QR code" />
          <TabBtn active={tab === 'existing'} onClick={() => setTab('existing')} icon={<UserPlus size={14} />} label="Existant" />
        </div>

        {/* Tab content */}
        {tab === 'email' && (
          <div>
            <p className="text-xs mb-3" style={{ color: '#a0937c' }}>
              Chaque personne reçoit un mail avec un lien de connexion direct (pas de mot de passe à saisir).
            </p>

            <div className="rounded-xl overflow-hidden" style={{ border: '1.5px solid #f0ebe0' }}>
              <div className="grid gap-2 p-2 text-[10px] font-semibold uppercase tracking-wider" style={{ background: '#faf8f4', color: '#a0937c', gridTemplateColumns: '1fr 0.7fr 0.7fr 28px' }}>
                <div className="px-2">Email</div>
                <div>Prénom</div>
                <div>Nom</div>
                <div></div>
              </div>
              {rows.map((r, i) => (
                <div key={i} className="grid gap-2 p-1.5 items-center" style={{ borderTop: '1px solid #f0ebe0', gridTemplateColumns: '1fr 0.7fr 0.7fr 28px' }}>
                  <input type="email" value={r.email} onChange={e => updateRow(i, 'email', e.target.value)} placeholder="email@exemple.fr"
                    className="px-2 py-1.5 text-sm rounded-md w-full" style={{ border: '1.5px solid transparent' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#fbbf24'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'} />
                  <input type="text" value={r.firstName} onChange={e => updateRow(i, 'firstName', e.target.value)} placeholder="Prénom"
                    className="px-2 py-1.5 text-sm rounded-md w-full" style={{ border: '1.5px solid transparent' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#fbbf24'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'} />
                  <input type="text" value={r.lastName} onChange={e => updateRow(i, 'lastName', e.target.value)} placeholder="Nom"
                    className="px-2 py-1.5 text-sm rounded-md w-full" style={{ border: '1.5px solid transparent' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#fbbf24'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'transparent'} />
                  <button onClick={() => removeRow(i)} className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50" disabled={rows.length === 1} aria-label="Retirer">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button onClick={addRow} className="w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-1" style={{ background: '#faf8f4', borderTop: '1px solid #f0ebe0', color: '#1a1a2e' }}>
                <Plus size={14} /> Ajouter une ligne
              </button>
            </div>

            {emailError && <p className="mt-3 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg" style={{ border: '1.5px solid #fca5a5' }}>{emailError}</p>}

            {emailSummary && (
              <div className="mt-3 p-3 rounded-lg" style={{ background: '#faf8f4', border: '1.5px solid #f0ebe0' }}>
                <p className="text-sm font-semibold mb-2" style={{ color: '#1a1a2e' }}>Résultat :</p>
                <div className="space-y-1 text-sm">
                  {emailSummary.invited > 0 && <div className="flex items-center gap-2" style={{ color: '#10b981' }}><CheckCircle size={14} /> {emailSummary.invited} invitation{emailSummary.invited > 1 ? 's' : ''} envoyée{emailSummary.invited > 1 ? 's' : ''}</div>}
                  {emailSummary.addedExisting > 0 && <div className="flex items-center gap-2" style={{ color: '#10b981' }}><CheckCircle size={14} /> {emailSummary.addedExisting} compte{emailSummary.addedExisting > 1 ? 's' : ''} existant{emailSummary.addedExisting > 1 ? 's' : ''} ajouté{emailSummary.addedExisting > 1 ? 's' : ''} au groupe</div>}
                  {emailSummary.alreadyInGroup > 0 && <div className="flex items-center gap-2" style={{ color: '#a0937c' }}><AlertCircle size={14} /> {emailSummary.alreadyInGroup} déjà dans ce groupe (ignoré{emailSummary.alreadyInGroup > 1 ? 's' : ''})</div>}
                  {emailSummary.failed > 0 && (
                    <>
                      <div className="flex items-center gap-2" style={{ color: '#dc2626' }}><AlertCircle size={14} /> {emailSummary.failed} échec{emailSummary.failed > 1 ? 's' : ''} :</div>
                      {(emailResults ?? []).filter(r => r.status === 'failed').map((r, i) => (
                        <div key={i} className="text-xs ml-5" style={{ color: '#dc2626' }}>· {r.email} — {r.message}</div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-xl hover:bg-gray-100">Annuler</button>
              <button onClick={sendInvitations} disabled={sendingEmail} className="btn-primary">
                {sendingEmail ? <><Loader2 size={14} className="animate-spin" /> Envoi…</> : 'Envoyer les invitations'}
              </button>
            </div>
          </div>
        )}

        {tab === 'qr' && (
          <div>
            <p className="text-xs mb-3" style={{ color: '#a0937c' }}>
              Pour les apprenants qui n&apos;ont pas reçu l&apos;email ou qui arrivent en présentiel.
            </p>

            {tokenLoading ? (
              <div className="flex justify-center items-center py-12 text-gray-400">
                <Loader2 className="animate-spin" size={20} />
              </div>
            ) : tokenError ? (
              <p className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg" style={{ border: '1.5px solid #fca5a5' }}>{tokenError}</p>
            ) : !token ? (
              <div className="text-center py-8 px-4 rounded-xl" style={{ background: '#faf8f4', border: '1.5px solid #f0ebe0' }}>
                <QrCode size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="text-sm mb-4" style={{ color: '#a0937c' }}>Aucun QR code actif pour ce groupe.</p>
                <button onClick={handleGenerateOrRotate} disabled={generating} className="btn-primary">
                  {generating ? <><Loader2 size={14} className="animate-spin" /> Génération…</> : <><QrCode size={14} /> Générer un QR code</>}
                </button>
              </div>
            ) : (
              <div className="flex gap-4 items-center p-4 rounded-2xl" style={{ background: '#faf8f4' }}>
                <div className="bg-white p-2 rounded-xl flex-shrink-0" style={{ border: '1.5px solid #f0ebe0' }}
                     dangerouslySetInnerHTML={{ __html: token.qrSvg }} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs bg-white px-2 py-1 rounded-lg inline-block break-all" style={{ border: '1px solid #f0ebe0' }}>
                    {token.url}
                  </p>
                  <p className="text-xs mt-3 leading-relaxed" style={{ color: '#a0937c' }}>
                    Expire dans <strong style={{ color: '#1a1a2e' }}>{formatExpiration(token.expiresAt)}</strong><br/>
                    {token.usesCount} inscription{token.usesCount > 1 ? 's' : ''} sur {token.maxUses} max
                  </p>
                </div>
              </div>
            )}

            {token && (
              <div className="flex gap-2 justify-end mt-4 flex-wrap">
                <button onClick={handleCopy} className="btn-secondary btn-sm">
                  {copied ? <><CheckCircle size={14} /> Copié !</> : <><Copy size={14} /> Copier le lien</>}
                </button>
                <button onClick={handlePrint} className="btn-secondary btn-sm"><Printer size={14} /> Imprimer</button>
                <button onClick={handleGenerateOrRotate} disabled={generating} className="btn-secondary btn-sm">
                  {generating ? <><Loader2 size={14} className="animate-spin" /> Renouvellement…</> : <><RefreshCw size={14} /> Renouveler</>}
                </button>
              </div>
            )}
          </div>
        )}

        {tab === 'existing' && (
          <div>
            <p className="text-xs mb-3" style={{ color: '#a0937c' }}>
              Si la personne a déjà un compte (ex : en salle d&apos;attente), tu peux la rattacher à ce groupe.
            </p>

            <div>
              <label className="label">Email de l&apos;apprenant</label>
              <input type="email" value={existingEmail} onChange={e => setExistingEmail(e.target.value)}
                className="input" placeholder="marie@example.com" />
            </div>

            {existingError && <p className="mt-3 text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg" style={{ border: '1.5px solid #fca5a5' }}>{existingError}</p>}
            {existingSuccess && <p className="mt-3 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg" style={{ border: '1.5px solid #86efac' }}>{existingSuccess}</p>}

            <div className="flex gap-2 justify-end mt-4">
              <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-xl hover:bg-gray-100">Annuler</button>
              <button onClick={addExisting} disabled={addingExisting || !existingEmail.trim()} className="btn-primary">
                {addingExisting ? <><Loader2 size={14} className="animate-spin" /> Ajout…</> : 'Ajouter au groupe'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick}
      className="flex-1 py-2.5 px-3 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
      style={{
        background: active ? 'white' : 'transparent',
        color: active ? '#1a1a2e' : '#a0937c',
        boxShadow: active ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
      }}>
      {icon} {label}
    </button>
  )
}
