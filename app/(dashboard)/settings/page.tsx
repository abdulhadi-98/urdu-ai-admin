'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import {
  Bot,
  Globe,
  Shield,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
  Loader2,
  AlertCircle,
  RefreshCw,
  Database,
  Wifi,
  MessageSquare,
  Brain,
  BookOpen,
  Server,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { TENANT } from '@/lib/auth'

const BACKEND = '/api/backend'

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceStatus = 'online' | 'offline' | 'disabled' | 'loading'

interface ServiceItem {
  name: string
  label: string
  status: ServiceStatus
  detail?: string
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  agent:     <Server     className="w-4 h-4" />,
  database:  <Database   className="w-4 h-4" />,
  openai:    <Brain      className="w-4 h-4" />,
  whatsapp:  <MessageSquare className="w-4 h-4" />,
  widget:    <Wifi       className="w-4 h-4" />,
  knowledge: <BookOpen   className="w-4 h-4" />,
}

const PLACEHOLDER_SERVICES: ServiceItem[] = [
  { name: 'agent',     label: 'AI Agent Server',      status: 'loading' },
  { name: 'database',  label: 'Database (Supabase)',   status: 'loading' },
  { name: 'openai',    label: 'OpenAI API',            status: 'loading' },
  { name: 'whatsapp',  label: 'WhatsApp (Meta)',       status: 'loading' },
  { name: 'widget',    label: 'Widget',                status: 'loading' },
  { name: 'knowledge', label: 'Knowledge Base (RAG)',  status: 'loading' },
]

// ── StatusDot ─────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus }) {
  if (status === 'loading') {
    return <span className="w-2.5 h-2.5 rounded-full bg-gray-600 animate-pulse" />
  }
  if (status === 'online') {
    return <span className="relative flex w-2.5 h-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
      <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-green-400" />
    </span>
  }
  if (status === 'disabled') {
    return <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
  }
  // offline
  return <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'loading') return (
    <span className="text-xs text-gray-500">Checking…</span>
  )
  if (status === 'online') return (
    <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/20 rounded-full px-2.5 py-0.5">Connected</span>
  )
  if (status === 'disabled') return (
    <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 rounded-full px-2.5 py-0.5">Disabled</span>
  )
  return (
    <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-2.5 py-0.5">Disconnected</span>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // Password change state
  const [currentPassword, setCurrentPassword]   = useState('')
  const [newPassword, setNewPassword]           = useState('')
  const [confirmPassword, setConfirmPassword]   = useState('')
  const [showCurrent, setShowCurrent]           = useState(false)
  const [showNew, setShowNew]                   = useState(false)
  const [pwSaving, setPwSaving]                 = useState(false)
  const [pwSaved, setPwSaved]                   = useState(false)
  const [pwError, setPwError]                   = useState('')

  // System status
  const [services, setServices]     = useState<ServiceItem[]>(PLACEHOLDER_SERVICES)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusTime, setStatusTime] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  const cfg: Record<string, string> =
    typeof window !== 'undefined' ? (window as any).__APP_CONFIG__ ?? {} : {}
  const apiUrl: string = cfg.apiUrl || ''

  // ── Fetch status ────────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true)
    setStatusError(null)
    try {
      const res = await fetch(`${BACKEND}/api/admin/status`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      setServices(data.services ?? PLACEHOLDER_SERVICES)
      setStatusTime(data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : null)
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Failed to fetch status')
      // Mark everything offline so the user sees red
      setServices(PLACEHOLDER_SERVICES.map(s => ({ ...s, status: 'offline' as ServiceStatus })))
    } finally {
      setStatusLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // ── Password change ─────────────────────────────────────────────────────────

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwError('')
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwError('All fields are required')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match')
      return
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters')
      return
    }

    setPwSaving(true)
    try {
      const verifyRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPassword }),
      })
      if (!verifyRes.ok) {
        setPwError('Current password is incorrect')
        return
      }

      const saveRes = await fetch(`${BACKEND}/api/admin/tenant/${TENANT.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: newPassword }),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        throw new Error((err as any).error || `Server error ${saveRes.status}`)
      }

      setPwSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setPwSaving(false)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const onlineCount  = services.filter(s => s.status === 'online').length
  const offlineCount = services.filter(s => s.status === 'offline').length
  const allGreen     = offlineCount === 0 && services.every(s => s.status !== 'loading')

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── System Status ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" />
                System Status
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {statusTime ? `Last checked at ${statusTime}` : 'Live connectivity check for all services'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Overall badge */}
              {!statusLoading && !statusError && (
                <span className={`text-xs font-medium rounded-full px-3 py-1 border ${
                  allGreen
                    ? 'bg-green-500/15 text-green-400 border-green-500/20'
                    : 'bg-red-500/15 text-red-400 border-red-500/20'
                }`}>
                  {allGreen ? `All systems operational` : `${offlineCount} service${offlineCount !== 1 ? 's' : ''} down`}
                </span>
              )}
              <button
                onClick={fetchStatus}
                disabled={statusLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-dark-600 hover:border-indigo-500 text-gray-400 hover:text-white text-xs rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {statusError && (
            <div className="mx-5 mt-4 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{statusError}</p>
            </div>
          )}

          <div className="divide-y divide-dark-600">
            {services.map((svc) => (
              <div key={svc.name} className="px-5 py-3.5 flex items-center gap-4">
                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  svc.status === 'online'   ? 'bg-green-500/10 text-green-400' :
                  svc.status === 'disabled' ? 'bg-yellow-500/10 text-yellow-400' :
                  svc.status === 'loading'  ? 'bg-dark-700 text-gray-600' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {SERVICE_ICONS[svc.name] ?? <Globe className="w-4 h-4" />}
                </div>

                {/* Label + detail */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{svc.label}</p>
                  {svc.detail && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{svc.detail}</p>
                  )}
                </div>

                {/* Status dot + badge */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <StatusDot status={svc.status} />
                  <StatusBadge status={svc.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tenant Info ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" />
              Tenant Information
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Organization Name</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white">
                  {TENANT.name}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Slug</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono">
                  {TENANT.slug}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Agent Name</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white">
                  {TENANT.agentName}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">API URL</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono truncate">
                  {apiUrl || 'Not configured'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Change Admin Password ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              Change Admin Password
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Stored securely in the database — takes effect immediately on next login.
            </p>
          </div>
          <form onSubmit={handlePasswordChange} className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {pwError && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{pwError}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              {pwSaved && (
                <span className="flex items-center gap-1.5 text-green-400 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Password updated
                </span>
              )}
              <button
                type="submit"
                disabled={pwSaving}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {pwSaving
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                  : 'Update Password'
                }
              </button>
            </div>
          </form>
        </div>

        {/* ── Auth Settings ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" />
              Authentication
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Password Auth</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Credentials verified server-side against DB; session stored in sessionStorage
                </p>
              </div>
              <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/20 rounded-full px-2.5 py-1">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* ── About ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Bot className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Urdu AI Admin Dashboard</p>
              <p className="text-xs text-gray-500 mt-0.5">v0.1.0 &middot; Next.js 14 &middot; Discret Digital</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
