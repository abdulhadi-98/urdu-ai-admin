'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import {
  Bot, Globe, Shield, CheckCircle, Eye, EyeOff, Lock, Loader2,
  AlertCircle, RefreshCw, Database, Wifi, MessageSquare, Brain,
  BookOpen, Server, Users, UserPlus, Trash2, ShieldCheck, ShieldOff,
  KeyRound,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { TENANT } from '@/lib/auth'

const BACKEND = '/api/backend'

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceStatus = 'online' | 'offline' | 'disabled' | 'loading'
interface ServiceItem { name: string; label: string; status: ServiceStatus; detail?: string }

interface AdminUser {
  id: string; email: string; name: string; role: string
  is_active: boolean; failed_attempts: number; locked_until: string | null
  last_login_at: string | null; created_at: string
}

// ── Service icons ─────────────────────────────────────────────────────────────

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  agent:     <Server        className="w-4 h-4" />,
  database:  <Database      className="w-4 h-4" />,
  openai:    <Brain         className="w-4 h-4" />,
  whatsapp:  <MessageSquare className="w-4 h-4" />,
  widget:    <Wifi          className="w-4 h-4" />,
  knowledge: <BookOpen      className="w-4 h-4" />,
}

const PLACEHOLDER_SERVICES: ServiceItem[] = [
  { name: 'agent',     label: 'AI Agent Server',     status: 'loading' },
  { name: 'database',  label: 'Database (Supabase)',  status: 'loading' },
  { name: 'openai',    label: 'OpenAI API',           status: 'loading' },
  { name: 'whatsapp',  label: 'WhatsApp (Meta)',      status: 'loading' },
  { name: 'widget',    label: 'Widget',               status: 'loading' },
  { name: 'knowledge', label: 'Knowledge Base (RAG)', status: 'loading' },
]

// ── Status components ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus }) {
  if (status === 'loading') return <span className="w-2.5 h-2.5 rounded-full bg-gray-600 animate-pulse" />
  if (status === 'online')  return (
    <span className="relative flex w-2.5 h-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
      <span className="relative inline-flex rounded-full w-2.5 h-2.5 bg-green-400" />
    </span>
  )
  if (status === 'disabled') return <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
  return <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  if (status === 'loading')  return <span className="text-xs text-gray-500">Checking…</span>
  if (status === 'online')   return <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/20 rounded-full px-2.5 py-0.5">Connected</span>
  if (status === 'disabled') return <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 rounded-full px-2.5 py-0.5">Disabled</span>
  return <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-2.5 py-0.5">Disconnected</span>
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SettingsPage() {

  // ── System status ──────────────────────────────────────────────────────────
  const [services, setServices]       = useState<ServiceItem[]>(PLACEHOLDER_SERVICES)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusTime, setStatusTime]   = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)

  // ── Change password ────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw]     = useState('')
  const [newPw, setNewPw]             = useState('')
  const [confirmPw, setConfirmPw]     = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [pwSaving, setPwSaving]       = useState(false)
  const [pwSaved, setPwSaved]         = useState(false)
  const [pwError, setPwError]         = useState('')

  // ── Admin users ────────────────────────────────────────────────────────────
  const [adminUsers, setAdminUsers]   = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [newEmail, setNewEmail]       = useState('')
  const [newName, setNewName]         = useState('')
  const [newUserPw, setNewUserPw]     = useState('')
  const [newRole, setNewRole]         = useState<'admin' | 'super_admin'>('admin')
  const [addError, setAddError]       = useState('')
  const [addSaving, setAddSaving]     = useState(false)

  // ── Reset password for a user ──────────────────────────────────────────────
  const [resetUserId, setResetUserId]   = useState<string | null>(null)
  const [resetPw, setResetPw]           = useState('')
  const [resetSaving, setResetSaving]   = useState(false)
  const [resetError, setResetError]     = useState('')

  const cfg: Record<string, string> =
    typeof window !== 'undefined' ? (window as any).__APP_CONFIG__ ?? {} : {}
  const apiUrl: string = cfg.apiUrl || ''

  // ── Fetch status ───────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true); setStatusError(null)
    try {
      const res = await fetch(`${BACKEND}/api/admin/status`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const data = await res.json()
      setServices(data.services ?? PLACEHOLDER_SERVICES)
      setStatusTime(data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : null)
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Failed to fetch status')
      setServices(PLACEHOLDER_SERVICES.map(s => ({ ...s, status: 'offline' as ServiceStatus })))
    } finally { setStatusLoading(false) }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // ── Fetch admin users ──────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res = await fetch('/api/auth/register')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setAdminUsers(data.users ?? [])
    } catch { /* ignore — may not have permission */ }
    finally { setUsersLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── Change own password ────────────────────────────────────────────────────

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault(); setPwError('')
    if (!currentPw || !newPw || !confirmPw) { setPwError('All fields are required'); return }
    if (newPw !== confirmPw)                { setPwError('Passwords do not match'); return }
    if (newPw.length < 8)                  { setPwError('Password must be at least 8 characters'); return }

    setPwSaving(true)
    try {
      // Verify current password via login endpoint
      const verifyRes = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '', password: currentPw }),  // email ignored for own-pw check
      })
      // We need the logged-in user's email — get from /me
      const meRes  = await fetch('/api/auth/me')
      const me     = await meRes.json()
      const verify = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: me.email, password: currentPw }),
      })
      if (!verify.ok) { setPwError('Current password is incorrect'); return }

      const saveRes = await fetch('/api/auth/register', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: me.id, password: newPw }),
      })
      if (!saveRes.ok) {
        const err = await saveRes.json().catch(() => ({}))
        throw new Error((err as any).error || `Server error ${saveRes.status}`)
      }
      setPwSaved(true); setCurrentPw(''); setNewPw(''); setConfirmPw('')
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err: unknown) {
      setPwError(err instanceof Error ? err.message : 'Failed to update password')
    } finally { setPwSaving(false) }
  }

  // ── Add new admin user ─────────────────────────────────────────────────────

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault(); setAddError('')
    if (!newEmail || !newName || !newUserPw) { setAddError('All fields are required'); return }

    setAddSaving(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail, name: newName, password: newUserPw, role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Failed to create user'); return }
      setShowAddUser(false); setNewEmail(''); setNewName(''); setNewUserPw('')
      fetchUsers()
    } catch { setAddError('Network error') }
    finally { setAddSaving(false) }
  }

  // ── Toggle user active/inactive ───────────────────────────────────────────

  const toggleUserActive = async (user: AdminUser) => {
    await fetch('/api/auth/register', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
    })
    fetchUsers()
  }

  // ── Reset another user's password ─────────────────────────────────────────

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setResetError('')
    if (!resetPw || resetPw.length < 8) { setResetError('Password must be at least 8 characters'); return }
    setResetSaving(true)
    try {
      const res = await fetch('/api/auth/register', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resetUserId, password: resetPw }),
      })
      if (!res.ok) { const d = await res.json(); setResetError(d.error); return }
      setResetUserId(null); setResetPw('')
    } catch { setResetError('Network error') }
    finally { setResetSaving(false) }
  }

  const onlineCount  = services.filter(s => s.status === 'online').length
  const offlineCount = services.filter(s => s.status === 'offline').length
  const allGreen     = offlineCount === 0 && services.every(s => s.status !== 'loading')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── System Status ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-400" /> System Status
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {statusTime ? `Last checked at ${statusTime}` : 'Live connectivity check for all services'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!statusLoading && !statusError && (
                <span className={`text-xs font-medium rounded-full px-3 py-1 border ${
                  allGreen
                    ? 'bg-green-500/15 text-green-400 border-green-500/20'
                    : 'bg-red-500/15 text-red-400 border-red-500/20'
                }`}>
                  {allGreen ? 'All systems operational' : `${offlineCount} service${offlineCount !== 1 ? 's' : ''} down`}
                </span>
              )}
              <button onClick={fetchStatus} disabled={statusLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-dark-600 hover:border-indigo-500 text-gray-400 hover:text-white text-xs rounded-lg transition-colors disabled:opacity-50">
                <RefreshCw className={`w-3.5 h-3.5 ${statusLoading ? 'animate-spin' : ''}`} /> Refresh
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
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  svc.status === 'online'   ? 'bg-green-500/10 text-green-400' :
                  svc.status === 'disabled' ? 'bg-yellow-500/10 text-yellow-400' :
                  svc.status === 'loading'  ? 'bg-dark-700 text-gray-600' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {SERVICE_ICONS[svc.name] ?? <Globe className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{svc.label}</p>
                  {svc.detail && <p className="text-xs text-gray-500 mt-0.5 truncate">{svc.detail}</p>}
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <StatusDot status={svc.status} />
                  <StatusBadge status={svc.status} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Admin Users ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Admin Users
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                All admins authenticated via email + bcrypt password stored in database
              </p>
            </div>
            <button onClick={() => { setShowAddUser(!showAddUser); setAddError('') }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Add Admin
            </button>
          </div>

          {/* Add user form */}
          {showAddUser && (
            <form onSubmit={handleAddUser} className="px-5 py-4 border-b border-dark-600 bg-dark-700/40 space-y-3">
              <p className="text-xs font-medium text-gray-300">New Admin Account</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Full name"
                  className="bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Email address" type="email"
                  className="bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                <input value={newUserPw} onChange={e => setNewUserPw(e.target.value)} placeholder="Password (min 8 chars)" type="password"
                  className="bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                <select value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'super_admin')}
                  className="bg-dark-700 border border-dark-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              {addError && <p className="text-xs text-red-400">{addError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={addSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors">
                  {addSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : 'Create Admin'}
                </button>
                <button type="button" onClick={() => setShowAddUser(false)}
                  className="px-4 py-2 bg-dark-700 border border-dark-600 hover:border-gray-500 text-gray-400 text-xs rounded-lg transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Users list */}
          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            </div>
          ) : adminUsers.length === 0 ? (
            <div className="px-5 py-6 text-center text-sm text-gray-500">
              No admin users found. Run the setup script to create the first admin.
            </div>
          ) : (
            <div className="divide-y divide-dark-600">
              {adminUsers.map((user) => (
                <div key={user.id}>
                  <div className="px-5 py-3.5 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                      <span className="text-indigo-400 text-sm font-semibold">
                        {user.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">{user.name}</p>
                        <span className={`text-xs rounded-full px-2 py-0.5 border ${
                          user.role === 'super_admin'
                            ? 'bg-purple-500/15 text-purple-400 border-purple-500/20'
                            : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20'
                        }`}>{user.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span>
                        {user.locked_until && new Date(user.locked_until) > new Date() && (
                          <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5">Locked</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                      {user.last_login_at && (
                        <p className="text-xs text-gray-600 mt-0.5">
                          Last login: {new Date(user.last_login_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Reset password */}
                      <button onClick={() => { setResetUserId(user.id); setResetPw(''); setResetError('') }}
                        title="Reset password"
                        className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                      {/* Toggle active */}
                      <button onClick={() => toggleUserActive(user)}
                        title={user.is_active ? 'Deactivate' : 'Activate'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          user.is_active
                            ? 'text-green-400 hover:bg-red-500/10 hover:text-red-400'
                            : 'text-red-400 hover:bg-green-500/10 hover:text-green-400'
                        }`}>
                        {user.is_active ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Inline reset password form */}
                  {resetUserId === user.id && (
                    <form onSubmit={handleResetPassword}
                      className="px-5 py-3 bg-dark-700/40 border-t border-dark-600 flex items-center gap-3">
                      <input value={resetPw} onChange={e => setResetPw(e.target.value)}
                        type="password" placeholder="New password (min 8 chars)"
                        className="flex-1 bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                      <button type="submit" disabled={resetSaving}
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors">
                        {resetSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set'}
                      </button>
                      <button type="button" onClick={() => setResetUserId(null)}
                        className="px-3 py-2 bg-dark-700 border border-dark-600 text-gray-400 text-xs rounded-lg transition-colors hover:border-gray-500">
                        Cancel
                      </button>
                      {resetError && <p className="text-xs text-red-400">{resetError}</p>}
                    </form>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Tenant Info ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-400" /> Tenant Information
            </h3>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Organization Name</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white">{TENANT.name}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Slug</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono">{TENANT.slug}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Agent Name</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white">{TENANT.agentName}</div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">API URL</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono truncate">{apiUrl || 'Not configured'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Change Own Password ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" /> Change My Password
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Hashed with bcrypt and stored in the database.</p>
          </div>
          <form onSubmit={handlePasswordChange} className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Current Password</label>
              <div className="relative">
                <input type={showCurrent ? 'text' : 'password'} value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password"
                  className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">New Password</label>
              <div className="relative">
                <input type={showNew ? 'text' : 'password'} value={newPw}
                  onChange={e => setNewPw(e.target.value)} placeholder="Min. 8 characters"
                  className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-4 pr-10 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500" />
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
                  <CheckCircle className="w-4 h-4" /> Password updated
                </span>
              )}
              <button type="submit" disabled={pwSaving}
                className="ml-auto flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors">
                {pwSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

        {/* ── Auth Info ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" /> Authentication
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {[
              ['Session storage', 'httpOnly JWT cookie — not readable by JavaScript'],
              ['Password storage', 'bcrypt hashed (12 rounds) — never stored in plaintext'],
              ['Session duration', '8 hours — auto-expires, re-check every 2 minutes'],
              ['Brute force', 'Account locked for 15 min after 5 failed attempts'],
              ['Route protection', 'Server-side middleware validates every request'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <p className="text-xs text-gray-500 shrink-0 w-36">{label}</p>
                <p className="text-xs text-gray-300 text-right">{value}</p>
              </div>
            ))}
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
              <p className="text-xs text-gray-500 mt-0.5">v0.1.0 · Next.js 14 · Discret Digital</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
