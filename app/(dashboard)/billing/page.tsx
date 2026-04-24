'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Mic, MessageSquare, Lock, Unlock, Plus, RefreshCw, AlertTriangle,
  CheckCircle, Loader2, ChevronDown, ChevronUp, Upload, FileText,
  ExternalLink, CreditCard, Calendar,
} from 'lucide-react'
import { useUser } from '@/lib/user-context'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

// ── Types ─────────────────────────────────────────────────────────────────────

type TenantUsage = {
  plan: {
    tenant_slug: string
    voice_minutes_limit: number
    carried_forward_minutes: number
    text_conversations_limit: number
    billing_cycle_start: string
    plan_type: string
    is_locked: boolean
    locked_at: string | null
  }
  voiceMinutes: number
  textCount: number
  effectiveVoiceLimit: number
  voiceRemaining: number
  voiceUsedPct: number
  textRemaining: number
  textUsedPct: number
  isLocked: boolean
}

type Invoice = {
  id: string
  tenant_slug: string
  file_url: string
  file_name: string
  amount: number | null
  currency: string
  billing_period: string | null
  is_paid: boolean
  paid_at: string | null
  created_at: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function UsageBar({ pct, warn }: { pct: number; warn: boolean }) {
  const color = pct >= 100 ? 'bg-red-500' : warn ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="w-full bg-dark-600 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

function daysUntilReset(cycleStart: string) {
  const next = new Date(cycleStart)
  next.setMonth(next.getMonth() + 1)
  return Math.max(0, Math.ceil((next.getTime() - Date.now()) / 86_400_000))
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Admin view (read-only) ────────────────────────────────────────────────────

function AdminBillingView({ tenantSlug }: { tenantSlug: string }) {
  const [usage,    setUsage]    = useState<TenantUsage | null>(null)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch(`${API_URL}/api/admin/billing/usage/${tenantSlug}`).then(r => r.json()),
      fetch(`${API_URL}/api/admin/billing/invoices/${tenantSlug}`).then(r => r.json()),
    ]).then(([u, inv]) => {
      setUsage(u.data ?? null)
      setInvoices(inv.data ?? [])
    }).finally(() => setLoading(false))
  }, [tenantSlug])

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
    </div>
  )

  if (!usage) return (
    <div className="text-center py-20 text-gray-600 text-sm">No billing data found.</div>
  )

  const days      = daysUntilReset(usage.plan.billing_cycle_start)
  const voiceWarn = usage.voiceUsedPct >= 80
  const textWarn  = usage.textUsedPct  >= 80
  const lastInv   = invoices[0]

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Status card */}
      <div className={`bg-dark-800 border rounded-xl p-5 space-y-4 ${
        usage.isLocked ? 'border-red-500/40' : voiceWarn || textWarn ? 'border-yellow-500/30' : 'border-dark-600'
      }`}>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-white">Current Usage</h2>
          {usage.isLocked ? (
            <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
              <Lock className="w-3 h-3" /> Locked — contact admin
            </span>
          ) : (voiceWarn || textWarn) ? (
            <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> Approaching Limit
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
              <CheckCircle className="w-3 h-3" /> Active
            </span>
          )}
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Resets in {days} day{days !== 1 ? 's' : ''}
          </span>
          {usage.plan.carried_forward_minutes > 0 && (
            <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
              +{usage.plan.carried_forward_minutes} min carried forward
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1.5"><Mic className="w-3 h-3" /> Voice Minutes</span>
              <span className={voiceWarn ? 'text-yellow-400' : 'text-gray-400'}>
                {usage.voiceMinutes} / {usage.effectiveVoiceLimit} min
              </span>
            </div>
            <UsageBar pct={usage.voiceUsedPct} warn={voiceWarn} />
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400 flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> Text Conversations</span>
              <span className={textWarn ? 'text-yellow-400' : 'text-gray-400'}>
                {usage.textCount} / {usage.plan.text_conversations_limit}
              </span>
            </div>
            <UsageBar pct={usage.textUsedPct} warn={textWarn} />
          </div>
        </div>

        <div className="pt-1 border-t border-dark-600 text-xs text-gray-500">
          Billing cycle started: {fmt(usage.plan.billing_cycle_start)}
        </div>
      </div>

      {/* Invoices */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-white mb-3">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="text-xs text-gray-600">No invoices yet.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2.5">
                <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{inv.file_name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {inv.billing_period && <span className="mr-2">{inv.billing_period}</span>}
                    {inv.amount && <span className="mr-2">{inv.currency} {inv.amount.toLocaleString()}</span>}
                    {fmt(inv.created_at)}
                  </p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border shrink-0 ${
                  inv.is_paid
                    ? 'text-green-400 bg-green-500/10 border-green-500/20'
                    : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
                }`}>
                  {inv.is_paid ? 'Paid' : 'Unpaid'}
                </span>
                <a href={inv.file_url} target="_blank" rel="noopener noreferrer"
                  className="text-gray-500 hover:text-white transition-colors shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Super admin view (full control) ──────────────────────────────────────────

function SuperAdminBillingView() {
  const [tenants,       setTenants]       = useState<TenantUsage[]>([])
  const [selectedSlug,  setSelectedSlug]  = useState<string>('')
  const [usage,         setUsage]         = useState<TenantUsage | null>(null)
  const [invoices,      setInvoices]      = useState<Invoice[]>([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState<string | null>(null)
  const [showHistory,   setShowHistory]   = useState(false)
  const [topupOpen,     setTopupOpen]     = useState(false)
  const [topupMins,     setTopupMins]     = useState(60)
  const [topupNote,     setTopupNote]     = useState('')
  const [editVoice,     setEditVoice]     = useState(0)
  const [editText,      setEditText]      = useState(0)
  const [invoiceFile,   setInvoiceFile]   = useState<File | null>(null)
  const [invPeriod,     setInvPeriod]     = useState('')
  const [invAmount,     setInvAmount]     = useState('')
  const [invCurrency,   setInvCurrency]   = useState('PKR')
  const [invPaid,       setInvPaid]       = useState(false)
  const [uploadOpen,    setUploadOpen]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API_URL}/api/admin/billing/plans`)
      const json = await res.json()
      const data: TenantUsage[] = (json.data ?? []).filter(Boolean)
      setTenants(data)
      if (!selectedSlug && data.length > 0) setSelectedSlug(data[0].plan.tenant_slug)
    } finally {
      setLoading(false)
    }
  }, [selectedSlug])

  const fetchTenant = useCallback(async (slug: string) => {
    if (!slug) return
    const [u, inv] = await Promise.all([
      fetch(`${API_URL}/api/admin/billing/usage/${slug}`).then(r => r.json()),
      fetch(`${API_URL}/api/admin/billing/invoices/${slug}`).then(r => r.json()),
    ])
    const d = u.data as TenantUsage | null
    setUsage(d)
    setInvoices(inv.data ?? [])
    if (d) { setEditVoice(d.plan.voice_minutes_limit); setEditText(d.plan.text_conversations_limit) }
  }, [])

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (selectedSlug) fetchTenant(selectedSlug) }, [selectedSlug, fetchTenant])

  const saveLimits = async () => {
    setSaving('limits')
    try {
      await fetch(`${API_URL}/api/admin/billing/plans/${selectedSlug}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voiceMinutesLimit: editVoice, textConversationsLimit: editText }),
      })
      await fetchTenant(selectedSlug)
    } finally { setSaving(null) }
  }

  const doTopup = async () => {
    setSaving('topup')
    try {
      await fetch(`${API_URL}/api/admin/billing/topup/${selectedSlug}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutesToAdd: topupMins, note: topupNote || null }),
      })
      setTopupOpen(false); setTopupNote(''); setTopupMins(60)
      await fetchTenant(selectedSlug)
    } finally { setSaving(null) }
  }

  const toggleLock = async (lock: boolean) => {
    setSaving('lock')
    try {
      await fetch(`${API_URL}/api/admin/billing/lock/${selectedSlug}`, { method: lock ? 'POST' : 'DELETE' })
      await fetchTenant(selectedSlug)
    } finally { setSaving(null) }
  }

  const uploadInvoice = async () => {
    if (!invoiceFile) return
    setSaving('invoice')
    try {
      const fd = new FormData()
      fd.append('invoice', invoiceFile, invoiceFile.name)
      fd.append('billingPeriod', invPeriod)
      fd.append('amount', invAmount)
      fd.append('currency', invCurrency)
      fd.append('isPaid', String(invPaid))
      await fetch(`${API_URL}/api/admin/billing/invoices/${selectedSlug}`, { method: 'POST', body: fd })
      setUploadOpen(false); setInvoiceFile(null); setInvPeriod(''); setInvAmount(''); setInvPaid(false)
      await fetchTenant(selectedSlug)
    } finally { setSaving(null) }
  }

  const toggleInvoicePaid = async (id: string, paid: boolean) => {
    await fetch(`${API_URL}/api/admin/billing/invoices/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid: paid }),
    })
    await fetchTenant(selectedSlug)
  }

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 text-gray-600 animate-spin" /></div>

  const days      = usage ? daysUntilReset(usage.plan.billing_cycle_start) : 0
  const voiceWarn = (usage?.voiceUsedPct ?? 0) >= 80
  const textWarn  = (usage?.textUsedPct  ?? 0) >= 80

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Tenant selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="text-xs text-gray-500">Tenant</label>
        <select
          value={selectedSlug}
          onChange={(e) => setSelectedSlug(e.target.value)}
          className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          {tenants.map((t) => (
            <option key={t.plan.tenant_slug} value={t.plan.tenant_slug}>
              {t.plan.tenant_slug}
            </option>
          ))}
        </select>
        <button onClick={() => { fetchAll(); if (selectedSlug) fetchTenant(selectedSlug) }}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-dark-600 bg-dark-800 rounded-lg px-3 py-1.5 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {usage && (
        <>
          {/* Usage + plan edit */}
          <div className={`bg-dark-800 border rounded-xl p-5 space-y-4 ${
            usage.isLocked ? 'border-red-500/40' : voiceWarn || textWarn ? 'border-yellow-500/30' : 'border-dark-600'
          }`}>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-white capitalize">{selectedSlug}</span>
                {usage.isLocked ? (
                  <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
                    <Lock className="w-3 h-3" /> Locked
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                )}
                <span className="text-xs text-gray-500">Resets in {days} day{days !== 1 ? 's' : ''}</span>
                {usage.plan.carried_forward_minutes > 0 && (
                  <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                    +{usage.plan.carried_forward_minutes} min carried forward
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTopupOpen(true)}
                  className="flex items-center gap-1.5 text-xs text-green-400 border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 rounded-lg px-3 py-1.5 transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Top Up
                </button>
                <button onClick={() => toggleLock(!usage.isLocked)} disabled={saving === 'lock'}
                  className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 ${
                    usage.isLocked
                      ? 'text-green-400 border-green-500/30 bg-green-500/10 hover:bg-green-500/20'
                      : 'text-red-400 border-red-500/30 bg-red-500/10 hover:bg-red-500/20'
                  }`}>
                  {saving === 'lock' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                    usage.isLocked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>}
                </button>
              </div>
            </div>

            {/* Usage bars */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1.5"><Mic className="w-3 h-3" /> Voice Minutes</span>
                  <span className={voiceWarn ? 'text-yellow-400' : 'text-gray-400'}>
                    {usage.voiceMinutes} / {usage.effectiveVoiceLimit} min
                  </span>
                </div>
                <UsageBar pct={usage.voiceUsedPct} warn={voiceWarn} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1.5"><MessageSquare className="w-3 h-3" /> Text Conversations</span>
                  <span className={textWarn ? 'text-yellow-400' : 'text-gray-400'}>
                    {usage.textCount} / {usage.plan.text_conversations_limit}
                  </span>
                </div>
                <UsageBar pct={usage.textUsedPct} warn={textWarn} />
              </div>
            </div>

            {/* Editable limits */}
            <div className="pt-2 border-t border-dark-600 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Voice limit (min)</label>
                <input type="number" min={1} value={editVoice} onChange={(e) => setEditVoice(+e.target.value)}
                  className="w-20 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Text limit</label>
                <input type="number" min={1} value={editText} onChange={(e) => setEditText(+e.target.value)}
                  className="w-24 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <button onClick={saveLimits} disabled={saving === 'limits'}
                className="text-xs text-indigo-400 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {saving === 'limits' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save Limits'}
              </button>
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-white">Invoices</h2>
              <button onClick={() => setUploadOpen(true)}
                className="flex items-center gap-1.5 text-xs text-indigo-400 border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg px-3 py-1.5 transition-colors">
                <Upload className="w-3.5 h-3.5" /> Upload Invoice
              </button>
            </div>

            {invoices.length === 0 ? (
              <p className="text-xs text-gray-600">No invoices yet.</p>
            ) : (
              <div className="space-y-2">
                {(showHistory ? invoices : invoices.slice(0, 5)).map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 bg-dark-700 rounded-lg px-3 py-2.5">
                    <FileText className="w-4 h-4 text-gray-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{inv.file_name}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {inv.billing_period && <span className="mr-2">{inv.billing_period}</span>}
                        {inv.amount && <span className="mr-2">{inv.currency} {inv.amount.toLocaleString()}</span>}
                        {fmt(inv.created_at)}
                      </p>
                    </div>
                    {/* Paid toggle */}
                    <button onClick={() => toggleInvoicePaid(inv.id, !inv.is_paid)}
                      className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
                        inv.is_paid
                          ? 'text-green-400 bg-green-500/10 border-green-500/20 hover:bg-green-500/20'
                          : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20 hover:bg-yellow-500/20'
                      }`}>
                      {inv.is_paid ? '✓ Paid' : 'Unpaid'}
                    </button>
                    <a href={inv.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-gray-500 hover:text-white transition-colors shrink-0">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
                {invoices.length > 5 && (
                  <button onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-white mt-1 transition-colors">
                    {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {showHistory ? 'Show less' : `Show all ${invoices.length} invoices`}
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Top-up modal */}
      {topupOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-sm font-semibold text-white">Top Up — <span className="text-indigo-400 capitalize">{selectedSlug}</span></h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Minutes to add</label>
                <input type="number" min={1} value={topupMins} onChange={(e) => setTopupMins(+e.target.value)}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Note (optional)</label>
                <input type="text" value={topupNote} onChange={(e) => setTopupNote(e.target.value)}
                  placeholder="e.g. Monthly renewal"
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setTopupOpen(false)}
                className="flex-1 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-xl py-2 transition-colors">Cancel</button>
              <button onClick={doTopup} disabled={saving === 'topup' || topupMins < 1}
                className="flex-1 text-sm text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl py-2 transition-colors flex items-center justify-center gap-2">
                {saving === 'topup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add {topupMins} min
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload invoice modal */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-sm font-semibold text-white">Upload Invoice — <span className="text-indigo-400 capitalize">{selectedSlug}</span></h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Invoice file (PDF/image)</label>
                <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) setInvoiceFile(f); e.target.value = '' }} />
                <button onClick={() => fileRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 border border-dashed border-dark-500 hover:border-indigo-500 rounded-xl py-3 text-xs text-gray-400 hover:text-indigo-400 transition-colors">
                  <Upload className="w-4 h-4" />
                  {invoiceFile ? invoiceFile.name : 'Choose file'}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Billing period</label>
                  <input type="text" value={invPeriod} onChange={(e) => setInvPeriod(e.target.value)}
                    placeholder="April 2026"
                    className="w-full bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Amount</label>
                  <div className="flex gap-1">
                    <select value={invCurrency} onChange={(e) => setInvCurrency(e.target.value)}
                      className="bg-dark-700 border border-dark-500 rounded-lg px-1.5 py-1.5 text-xs text-white focus:outline-none">
                      <option>PKR</option><option>USD</option><option>GBP</option>
                    </select>
                    <input type="number" value={invAmount} onChange={(e) => setInvAmount(e.target.value)}
                      placeholder="0"
                      className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500" />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={invPaid} onChange={(e) => setInvPaid(e.target.checked)}
                  className="w-3.5 h-3.5 accent-green-500" />
                <span className="text-xs text-gray-400">Mark as paid</span>
              </label>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setUploadOpen(false); setInvoiceFile(null) }}
                className="flex-1 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-xl py-2 transition-colors">Cancel</button>
              <button onClick={uploadInvoice} disabled={!invoiceFile || saving === 'invoice'}
                className="flex-1 text-sm text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl py-2 transition-colors flex items-center justify-center gap-2">
                {saving === 'invoice' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const user = useUser()

  if (!user) return null

  return (
    <div className="flex-1 overflow-y-auto bg-dark-900 p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-gray-400" /> Usage & Billing
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {user.role === 'super_admin'
            ? 'Manage plans, limits, top-ups and invoices for each tenant'
            : 'View your usage and billing information'}
        </p>
      </div>

      {user.role === 'super_admin'
        ? <SuperAdminBillingView />
        : <AdminBillingView tenantSlug="discret" />}
    </div>
  )
}
