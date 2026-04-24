'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Mic, MessageSquare, Lock, Unlock, Plus, RefreshCw,
  TrendingUp, AlertTriangle, CheckCircle, Loader2, ChevronDown, ChevronUp,
} from 'lucide-react'
import { useUser } from '@/lib/user-context'
import { useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? ''

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

type Topup = {
  id: string
  voice_minutes_added: number
  added_by: string
  note: string | null
  created_at: string
}

function UsageBar({ pct, warn }: { pct: number; warn: boolean }) {
  const color = pct >= 100 ? 'bg-red-500' : warn ? 'bg-yellow-500' : 'bg-green-500'
  return (
    <div className="w-full bg-dark-600 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  )
}

function daysUntilReset(cycleStart: string) {
  const start = new Date(cycleStart)
  const next  = new Date(start)
  next.setMonth(next.getMonth() + 1)
  const days = Math.ceil((next.getTime() - Date.now()) / 86_400_000)
  return Math.max(0, days)
}

export default function BillingPage() {
  const user   = useUser()
  const router = useRouter()

  const [tenants,      setTenants]      = useState<TenantUsage[]>([])
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState<string | null>(null)
  const [error,        setError]        = useState('')
  const [expanded,     setExpanded]     = useState<string | null>(null)
  const [topupSlug,    setTopupSlug]    = useState<string | null>(null)
  const [topupMins,    setTopupMins]    = useState(60)
  const [topupNote,    setTopupNote]    = useState('')
  const [topupHistory, setTopupHistory] = useState<Topup[]>([])
  const [editPlan,     setEditPlan]     = useState<Record<string, { voiceLimit: number; textLimit: number }>>({})

  useEffect(() => {
    if (user && user.role !== 'super_admin') router.replace('/dashboard')
  }, [user, router])

  const fetchPlans = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/admin/billing/plans`, {
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const data: TenantUsage[] = json.data ?? []
      setTenants(data)
      const initEdit: Record<string, { voiceLimit: number; textLimit: number }> = {}
      data.forEach((t) => {
        initEdit[t.plan.tenant_slug] = {
          voiceLimit: t.plan.voice_minutes_limit,
          textLimit:  t.plan.text_conversations_limit,
        }
      })
      setEditPlan(initEdit)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans])

  const saveLimits = async (slug: string) => {
    const p = editPlan[slug]
    if (!p) return
    setSaving(slug)
    try {
      await fetch(`${API_URL}/api/admin/billing/plans/${slug}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ voiceMinutesLimit: p.voiceLimit, textConversationsLimit: p.textLimit }),
      })
      await fetchPlans()
    } finally {
      setSaving(null)
    }
  }

  const doTopup = async () => {
    if (!topupSlug) return
    setSaving('topup')
    try {
      await fetch(`${API_URL}/api/admin/billing/topup/${topupSlug}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ minutesToAdd: topupMins, note: topupNote || null }),
      })
      setTopupSlug(null)
      setTopupNote('')
      setTopupMins(60)
      await fetchPlans()
    } finally {
      setSaving(null)
    }
  }

  const toggleLock = async (slug: string, lock: boolean) => {
    setSaving(slug + '_lock')
    try {
      await fetch(
        `${API_URL}/api/admin/billing/lock/${slug}`,
        { method: lock ? 'POST' : 'DELETE' }
      )
      await fetchPlans()
    } finally {
      setSaving(null)
    }
  }

  const openTopupHistory = async (slug: string) => {
    const res = await fetch(`${API_URL}/api/admin/billing/topups/${slug}`)
    const json = await res.json()
    setTopupHistory(json.data ?? [])
    setExpanded(expanded === slug ? null : slug)
  }

  if (!user || user.role !== 'super_admin') return null

  return (
    <div className="flex-1 overflow-y-auto bg-dark-900 p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white">Usage & Billing</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage plans, limits, and top-ups for each tenant</p>
          </div>
          <button
            onClick={fetchPlans}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-dark-600 hover:border-dark-500 bg-dark-800 rounded-lg px-3 py-2 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
          </div>
        ) : tenants.length === 0 ? (
          <div className="text-center py-20 text-gray-600 text-sm">
            No tenant plans found. Run the billing migration SQL first.
          </div>
        ) : (
          <div className="space-y-4">
            {tenants.map((t) => {
              const slug       = t.plan.tenant_slug
              const days       = daysUntilReset(t.plan.billing_cycle_start)
              const voiceWarn  = t.voiceUsedPct >= 80
              const textWarn   = t.textUsedPct  >= 80
              const ep         = editPlan[slug] ?? { voiceLimit: t.plan.voice_minutes_limit, textLimit: t.plan.text_conversations_limit }

              return (
                <div key={slug} className={`bg-dark-800 border rounded-xl overflow-hidden transition-colors ${
                  t.isLocked ? 'border-red-500/40' : voiceWarn || textWarn ? 'border-yellow-500/30' : 'border-dark-600'
                }`}>
                  {/* Row */}
                  <div className="px-5 py-4 grid grid-cols-[1fr_auto] gap-4 items-start">
                    <div className="space-y-4">
                      {/* Title + status */}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-semibold text-white capitalize">{slug}</span>
                        {t.isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        ) : (voiceWarn || textWarn) ? (
                          <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
                            <AlertTriangle className="w-3 h-3" /> Near Limit
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        )}
                        <span className="text-[10px] text-gray-600">Resets in {days} day{days !== 1 ? 's' : ''}</span>
                        {t.plan.carried_forward_minutes > 0 && (
                          <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                            +{t.plan.carried_forward_minutes} min carried forward
                          </span>
                        )}
                      </div>

                      {/* Voice usage */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 flex items-center gap-1.5">
                            <Mic className="w-3 h-3" /> Voice Minutes
                          </span>
                          <span className={voiceWarn ? 'text-yellow-400' : 'text-gray-400'}>
                            {t.voiceMinutes} / {t.effectiveVoiceLimit} min
                          </span>
                        </div>
                        <UsageBar pct={t.voiceUsedPct} warn={voiceWarn} />
                      </div>

                      {/* Text usage */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 flex items-center gap-1.5">
                            <MessageSquare className="w-3 h-3" /> Text Conversations
                          </span>
                          <span className={textWarn ? 'text-yellow-400' : 'text-gray-400'}>
                            {t.textCount} / {t.plan.text_conversations_limit}
                          </span>
                        </div>
                        <UsageBar pct={t.textUsedPct} warn={textWarn} />
                      </div>

                      {/* Editable limits */}
                      <div className="flex items-center gap-4 flex-wrap pt-1">
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Voice limit (min)</label>
                          <input
                            type="number" min={1}
                            value={ep.voiceLimit}
                            onChange={(e) => setEditPlan((prev) => ({ ...prev, [slug]: { ...ep, voiceLimit: +e.target.value } }))}
                            className="w-20 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-gray-500">Text limit</label>
                          <input
                            type="number" min={1}
                            value={ep.textLimit}
                            onChange={(e) => setEditPlan((prev) => ({ ...prev, [slug]: { ...ep, textLimit: +e.target.value } }))}
                            className="w-24 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button
                          onClick={() => saveLimits(slug)}
                          disabled={saving === slug}
                          className="text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/10 rounded-lg px-3 py-1 transition-colors disabled:opacity-50"
                        >
                          {saving === slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Save'}
                        </button>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2 shrink-0">
                      <button
                        onClick={() => { setTopupSlug(slug); setTopupMins(60); setTopupNote('') }}
                        className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/60 bg-green-500/10 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Top Up
                      </button>
                      <button
                        onClick={() => toggleLock(slug, !t.isLocked)}
                        disabled={saving === slug + '_lock'}
                        className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-50 ${
                          t.isLocked
                            ? 'text-green-400 hover:text-green-300 border-green-500/30 bg-green-500/10'
                            : 'text-red-400 hover:text-red-300 border-red-500/30 bg-red-500/10'
                        }`}
                      >
                        {saving === slug + '_lock'
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : t.isLocked ? <><Unlock className="w-3.5 h-3.5" /> Unlock</> : <><Lock className="w-3.5 h-3.5" /> Lock</>
                        }
                      </button>
                      <button
                        onClick={() => openTopupHistory(slug)}
                        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white border border-dark-600 hover:border-dark-500 bg-dark-700 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        History
                        {expanded === slug ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>

                  {/* Top-up history drawer */}
                  {expanded === slug && (
                    <div className="border-t border-dark-600 px-5 py-3">
                      <p className="text-xs font-medium text-gray-400 mb-2">Top-up History</p>
                      {topupHistory.length === 0 ? (
                        <p className="text-xs text-gray-600">No top-ups recorded yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {topupHistory.map((h) => (
                            <div key={h.id} className="flex items-center gap-3 text-xs">
                              <span className="text-green-400 font-mono shrink-0">+{h.voice_minutes_added} min</span>
                              <span className="text-gray-500 shrink-0">{new Date(h.created_at).toLocaleDateString()}</span>
                              <span className="text-gray-600 truncate">{h.note ?? '—'}</span>
                              <span className="text-gray-700 shrink-0">by {h.added_by}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Top-up modal */}
      {topupSlug && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-sm font-semibold text-white">Top Up — <span className="text-indigo-400 capitalize">{topupSlug}</span></h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Minutes to add</label>
                <input
                  type="number" min={1}
                  value={topupMins}
                  onChange={(e) => setTopupMins(+e.target.value)}
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Note (optional)</label>
                <input
                  type="text"
                  value={topupNote}
                  onChange={(e) => setTopupNote(e.target.value)}
                  placeholder="e.g. Monthly package renewal"
                  className="w-full bg-dark-700 border border-dark-500 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setTopupSlug(null)}
                className="flex-1 text-sm text-gray-400 hover:text-white border border-dark-600 rounded-xl py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={doTopup}
                disabled={saving === 'topup' || topupMins < 1}
                className="flex-1 text-sm text-white bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl py-2 transition-colors flex items-center justify-center gap-2"
              >
                {saving === 'topup' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add {topupMins} min
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
