'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import {
  Bot, Globe, Shield, Eye, EyeOff, Loader2, AlertCircle,
  RefreshCw, Database, Wifi, MessageSquare, Brain, BookOpen,
  Server, Users, UserPlus, KeyRound, ShieldCheck, ShieldOff, Trash2,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { TENANT } from '@/lib/auth'
import { useUser } from '@/lib/user-context'
import { roleLabel, roleColor, type Role } from '@/lib/roles'
import { cn } from '@/lib/utils'

const BACKEND = '/api/backend'

// ── Types ─────────────────────────────────────────────────────────────────────

type ServiceStatus = 'online' | 'offline' | 'disabled' | 'loading'
interface ServiceItem { name: string; label: string; status: ServiceStatus; detail?: string }

interface AdminUser {
  id: string; email: string; name: string; role: Role
  is_active: boolean; failed_attempts: number; locked_until: string | null
  last_login_at: string | null; created_at: string
}

const ROLE_ACCESS: Record<Role, string> = {
  super_admin: 'Full access — all dashboard pages',
  admin:       'All pages except Prompts and Knowledge Base',
  member:      'Conversations and Web Leads only',
}

const ROLE_LIMITS: Record<string, number> = { admin: 2, member: 3 }

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

function StatusDot({ status }: { status: ServiceStatus }) {
  if (status === 'loading')  return <span className="w-2.5 h-2.5 rounded-full bg-gray-600 animate-pulse" />
  if (status === 'online')   return (
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
  const currentUser = useUser()
  const canManage   = currentUser?.role === 'super_admin' || currentUser?.role === 'admin'

  // ── System status ──────────────────────────────────────────────────────────
  const [services, setServices]           = useState<ServiceItem[]>(PLACEHOLDER_SERVICES)
  const [statusLoading, setStatusLoading] = useState(false)
  const [statusTime, setStatusTime]       = useState<string | null>(null)
  const [statusError, setStatusError]     = useState<string | null>(null)

  // ── Users ──────────────────────────────────────────────────────────────────
  const [users, setUsers]             = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [addRole, setAddRole]         = useState<Role>('member')
  const [addEmail, setAddEmail]       = useState('')
  const [addName, setAddName]         = useState('')
  const [addPw, setAddPw]             = useState('')
  const [showAddPw, setShowAddPw]     = useState(false)
  const [addError, setAddError]       = useState('')
  const [addSaving, setAddSaving]     = useState(false)

  // ── Reset password (other users) ───────────────────────────────────────────
  const [resetId, setResetId]         = useState<string | null>(null)
  const [resetPw, setResetPw]         = useState('')
  const [showResetPw, setShowResetPw] = useState(false)
  const [resetSaving, setResetSaving] = useState(false)
  const [resetError, setResetError]   = useState('')

  // ── My Account — change own password ───────────────────────────────────────
  const [myPw, setMyPw]             = useState('')
  const [showMyPw, setShowMyPw]     = useState(false)
  const [myPwSaving, setMyPwSaving] = useState(false)
  const [myPwError, setMyPwError]   = useState('')
  const [myPwDone, setMyPwDone]     = useState(false)

  const cfg: Record<string, string> =
    typeof window !== 'undefined' ? (window as any).__APP_CONFIG__ ?? {} : {}
  const apiUrl: string = cfg.apiUrl || ''

  // ── Fetch status ───────────────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true); setStatusError(null)
    try {
      const res  = await fetch(`${BACKEND}/api/admin/status`)
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

  // ── Fetch users ────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true)
    try {
      const res  = await fetch('/api/auth/register')
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setUsers(data.users ?? [])
    } finally { setUsersLoading(false) }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // ── Add user ───────────────────────────────────────────────────────────────

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault(); setAddError('')
    if (!addEmail || !addName || !addPw) { setAddError('All fields are required'); return }
    setAddSaving(true)
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: addEmail, name: addName, password: addPw, role: addRole }),
      })
      const data = await res.json()
      if (!res.ok) { setAddError(data.error || 'Failed to create user'); return }
      setShowAdd(false); setAddEmail(''); setAddName(''); setAddPw('')
      fetchUsers()
    } catch { setAddError('Network error') }
    finally { setAddSaving(false) }
  }

  // ── Toggle active ──────────────────────────────────────────────────────────

  const toggleActive = async (user: AdminUser) => {
    await fetch('/api/auth/register', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, is_active: !user.is_active }),
    })
    fetchUsers()
  }

  // ── Delete user ────────────────────────────────────────────────────────────

  const deleteUser = async (id: string) => {
    if (!confirm('Remove this user? They will lose dashboard access immediately.')) return
    const res  = await fetch(`/api/auth/register?id=${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) { alert(data.error); return }
    fetchUsers()
  }

  // ── Reset password ─────────────────────────────────────────────────────────

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault(); setResetError('')
    if (!resetPw || resetPw.length < 8) { setResetError('Min 8 characters'); return }
    setResetSaving(true)
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: resetId, password: resetPw }),
      })
      if (!res.ok) { const d = await res.json(); setResetError(d.error); return }
      setResetId(null); setResetPw('')
    } catch { setResetError('Network error') }
    finally { setResetSaving(false) }
  }

  // ── Change own password ────────────────────────────────────────────────────

  const handleMyPwChange = async (e: React.FormEvent) => {
    e.preventDefault(); setMyPwError(''); setMyPwDone(false)
    if (!myPw || myPw.length < 8) { setMyPwError('Min 8 characters'); return }
    setMyPwSaving(true)
    try {
      const res  = await fetch('/api/auth/register', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentUser?.id, password: myPw }),
      })
      if (!res.ok) { const d = await res.json(); setMyPwError(d.error || 'Failed'); return }
      setMyPw(''); setMyPwDone(true)
      setTimeout(() => setMyPwDone(false), 4000)
    } catch { setMyPwError('Network error') }
    finally { setMyPwSaving(false) }
  }

  // ── Group users by role (super_admin hidden from list) ─────────────────────

  const byRole = (role: Role) => users.filter(u => u.role === role)
  const offlineCount = services.filter(s => s.status === 'offline').length
  const allGreen     = offlineCount === 0 && services.every(s => s.status !== 'loading')

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* ── My Account ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-indigo-400" /> My Account
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Change your own password</p>
          </div>
          <form onSubmit={handleMyPwChange} className="px-5 py-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                <span className="text-indigo-400 text-sm font-semibold">
                  {currentUser?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{currentUser?.name}</p>
                <p className="text-xs text-gray-500">{currentUser?.email}</p>
              </div>
              <span className={cn('ml-auto text-xs rounded-full px-2.5 py-0.5 border', roleColor((currentUser?.role ?? 'member') as Role))}>
                {roleLabel((currentUser?.role ?? 'member') as Role)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  value={myPw}
                  onChange={e => { setMyPw(e.target.value); setMyPwDone(false) }}
                  type={showMyPw ? 'text' : 'password'}
                  placeholder="New password (min 8 characters)"
                  className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 pr-9 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button type="button" onClick={() => setShowMyPw(!showMyPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showMyPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
              <button type="submit" disabled={myPwSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors shrink-0">
                {myPwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Update'}
              </button>
            </div>
            {myPwError && <p className="text-xs text-red-400">{myPwError}</p>}
            {myPwDone  && <p className="text-xs text-green-400">Password updated successfully.</p>}
          </form>
        </div>

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
                  allGreen ? 'bg-green-500/15 text-green-400 border-green-500/20'
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

        {/* ── Users ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-400" /> Users
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                1 Super Admin · max 2 Admins · max 3 Members
              </p>
            </div>
            {canManage && (
              <button onClick={() => { setShowAdd(!showAdd); setAddError('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium rounded-lg transition-colors">
                <UserPlus className="w-3.5 h-3.5" /> Add User
              </button>
            )}
          </div>

          {/* Add user form */}
          {showAdd && canManage && (
            <form onSubmit={handleAdd} className="px-5 py-4 border-b border-dark-600 bg-dark-700/40 space-y-3">
              <p className="text-xs font-medium text-gray-300">New User</p>
              <div className="grid grid-cols-2 gap-3">
                <input value={addName} onChange={e => setAddName(e.target.value)} placeholder="Full name"
                  className="bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                <input value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="Email" type="email"
                  className="bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                <div className="relative">
                  <input value={addPw} onChange={e => setAddPw(e.target.value)}
                    placeholder="Password (min 8 chars)" type={showAddPw ? 'text' : 'password'}
                    className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 pr-9 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                  <button type="button" onClick={() => setShowAddPw(!showAddPw)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                    {showAddPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <select value={addRole} onChange={e => setAddRole(e.target.value as Role)}
                  className="bg-dark-700 border border-dark-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500">
                  {currentUser?.role === 'super_admin' && <option value="super_admin">Super Admin</option>}
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </div>
              {/* Access preview */}
              <p className="text-xs text-gray-500 italic">{ROLE_ACCESS[addRole]}</p>
              {addError && <p className="text-xs text-red-400">{addError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={addSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-medium rounded-lg transition-colors">
                  {addSaving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</> : 'Create User'}
                </button>
                <button type="button" onClick={() => setShowAdd(false)}
                  className="px-4 py-2 bg-dark-700 border border-dark-600 hover:border-gray-500 text-gray-400 text-xs rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {usersLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            </div>
          ) : (
            <div>
              {(['admin', 'member'] as Role[]).map((role) => {
                const roleUsers = byRole(role)
                const limit     = ROLE_LIMITS[role]
                return (
                  <div key={role}>
                    {/* Role header */}
                    <div className="px-5 py-2.5 bg-dark-700/30 border-b border-dark-600 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-xs font-medium rounded-full px-2.5 py-0.5 border', roleColor(role))}>
                          {roleLabel(role)}
                        </span>
                        <span className="text-xs text-gray-500">{ROLE_ACCESS[role]}</span>
                      </div>
                      {limit !== undefined && (
                        <span className="text-xs text-gray-600">{roleUsers.length}/{limit}</span>
                      )}
                    </div>

                    {roleUsers.length === 0 ? (
                      <div className="px-5 py-3 text-xs text-gray-600 italic border-b border-dark-600">
                        No {roleLabel(role).toLowerCase()}s yet
                      </div>
                    ) : roleUsers.map((user) => (
                      <div key={user.id}>
                        <div className="px-5 py-3.5 flex items-center gap-3 border-b border-dark-600">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/15 flex items-center justify-center shrink-0">
                            <span className="text-indigo-400 text-sm font-semibold">
                              {user.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium text-white">{user.name}</p>
                              {!user.is_active && (
                                <span className="text-xs bg-red-500/15 text-red-400 border border-red-500/20 rounded-full px-2 py-0.5">Inactive</span>
                              )}
                              {user.locked_until && new Date(user.locked_until) > new Date() && (
                                <span className="text-xs bg-orange-500/15 text-orange-400 border border-orange-500/20 rounded-full px-2 py-0.5">Locked</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                            {user.last_login_at && (
                              <p className="text-xs text-gray-600 mt-0.5">Last login: {new Date(user.last_login_at).toLocaleDateString()}</p>
                            )}
                          </div>
                          {canManage && user.id !== currentUser?.id && (
                            <div className="flex items-center gap-1 shrink-0">
                              <button onClick={() => { setResetId(user.id); setResetPw(''); setResetError('') }}
                                title="Reset password"
                                className="p-1.5 text-gray-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors">
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => toggleActive(user)}
                                title={user.is_active ? 'Deactivate' : 'Activate'}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  user.is_active
                                    ? 'text-green-400 hover:bg-red-500/10 hover:text-red-400'
                                    : 'text-red-400 hover:bg-green-500/10 hover:text-green-400'
                                }`}>
                                {user.is_active ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                              </button>
                              {user.role !== 'super_admin' && (
                                <button onClick={() => deleteUser(user.id)}
                                  title="Remove user"
                                  className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Inline reset password */}
                        {resetId === user.id && (
                          <form onSubmit={handleReset}
                            className="px-5 py-3 bg-dark-700/40 border-b border-dark-600 flex items-center gap-3">
                            <div className="relative flex-1">
                              <input value={resetPw} onChange={e => setResetPw(e.target.value)}
                                type={showResetPw ? 'text' : 'password'} placeholder="New password (min 8)"
                                className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg px-3 pr-9 py-2 text-sm focus:outline-none focus:border-indigo-500" />
                              <button type="button" onClick={() => setShowResetPw(!showResetPw)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                                {showResetPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <button type="submit" disabled={resetSaving}
                              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-xs font-medium rounded-lg">
                              {resetSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Set'}
                            </button>
                            <button type="button" onClick={() => setResetId(null)}
                              className="px-3 py-2 bg-dark-700 border border-dark-600 text-gray-400 text-xs rounded-lg hover:border-gray-500">
                              Cancel
                            </button>
                            {resetError && <p className="text-xs text-red-400">{resetError}</p>}
                          </form>
                        )}
                      </div>
                    ))}
                  </div>
                )
              })}
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

        {/* ── Auth Info ── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-400" /> Authentication
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {[
              ['Session storage',   'httpOnly JWT cookie — not readable by JavaScript'],
              ['Password storage',  'bcrypt hashed (12 rounds) — never stored in plaintext'],
              ['Session duration',  '8 hours — verified every 2 minutes'],
              ['Brute force',       'Account locked for 15 min after 5 failed attempts'],
              ['Route protection',  'Server-side middleware validates every request'],
              ['Role enforcement',  'Server-side — cannot be bypassed client-side'],
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
