'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import {
  Bot,
  Globe,
  Key,
  Shield,
  CheckCircle,
  Eye,
  EyeOff,
  Info,
  Lock,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { TENANT } from '@/lib/auth'

const BACKEND = '/api/backend'

export default function SettingsPage() {
  const [showAnonKey, setShowAnonKey] = useState(false)
  const [showServiceKey, setShowServiceKey] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSaved, setPwSaved] = useState(false)
  const [pwError, setPwError] = useState('')

  const cfg = typeof window !== 'undefined' ? (window as any).__APP_CONFIG__ ?? {} : {}
  const apiUrl: string = cfg.apiUrl || ''
  const anonKey: string = cfg.supabaseAnonKey || ''
  const serviceKey: string = cfg.supabaseServiceKey || ''

  const maskKey = (key: string) => {
    if (!key) return 'Not configured'
    return key.slice(0, 20) + '...' + key.slice(-10)
  }

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
      // Verify current password via server-side auth route
      const verifyRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: currentPassword }),
      })
      if (!verifyRes.ok) {
        setPwError('Current password is incorrect')
        return
      }

      // Save new password to DB via backend (persists in tenant_config.admin_password)
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Tenant Info */}
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
                <label className="block text-xs text-gray-500 mb-1.5">Status</label>
                <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm">
                  <span className="inline-flex items-center gap-1.5 text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Change Admin Password */}
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
            {/* Current password */}
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

            {/* New password */}
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

            {/* Confirm new password */}
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

        {/* Environment Config */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              Environment Configuration
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">API URL (Backend)</label>
              <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono">
                {apiUrl || 'Not configured'}
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Supabase URL</label>
              <div className="bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono truncate">
                /api/sb (proxied server-side)
              </div>
            </div>
          </div>
        </div>

        {/* API Keys (read-only display) */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-yellow-400" />
              API Keys
            </h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-3 mb-4">
              <Info className="w-4 h-4 text-yellow-400 mt-0.5 shrink-0" />
              <p className="text-xs text-yellow-400/90">
                These keys are read from environment variables (.env.local). To change them, update
                the .env.local file and restart the development server.
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Supabase Anon Key</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono truncate">
                  {showAnonKey ? anonKey : maskKey(anonKey)}
                </div>
                <button
                  onClick={() => setShowAnonKey(!showAnonKey)}
                  className="p-2.5 bg-dark-700 border border-dark-600 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  {showAnonKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Supabase Service Key</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-dark-700 border border-dark-600 rounded-lg px-4 py-2.5 text-sm text-white font-mono truncate">
                  {showServiceKey ? serviceKey : maskKey(serviceKey)}
                </div>
                <button
                  onClick={() => setShowServiceKey(!showServiceKey)}
                  className="p-2.5 bg-dark-700 border border-dark-600 rounded-lg text-gray-400 hover:text-white transition-colors"
                >
                  {showServiceKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Auth Settings */}
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

        {/* About */}
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
