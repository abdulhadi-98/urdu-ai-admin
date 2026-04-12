'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import {
  Save,
  Bot,
  Globe,
  Key,
  Shield,
  CheckCircle,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { TENANT } from '@/lib/auth'

export default function SettingsPage() {
  const [saved, setSaved] = useState(false)
  const [showAnonKey, setShowAnonKey] = useState(false)
  const [showServiceKey, setShowServiceKey] = useState(false)

  const cfg = typeof window !== 'undefined' ? (window as any).__APP_CONFIG__ ?? {} : {}
  const apiUrl: string = cfg.apiUrl || ''
  const anonKey: string = cfg.supabaseAnonKey || ''
  const serviceKey: string = cfg.supabaseServiceKey || ''

  const maskKey = (key: string) => {
    if (!key) return 'Not configured'
    return key.slice(0, 20) + '...' + key.slice(-10)
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
                <p className="text-sm text-white font-medium">Local Password Auth</p>
                <p className="text-xs text-gray-500 mt-0.5">Session stored in browser sessionStorage</p>
              </div>
              <span className="text-xs bg-green-500/15 text-green-400 border border-green-500/20 rounded-full px-2.5 py-1">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white font-medium">Supabase Auth</p>
                <p className="text-xs text-gray-500 mt-0.5">Not used (self-hosted limitations)</p>
              </div>
              <span className="text-xs bg-gray-500/15 text-gray-400 border border-gray-500/20 rounded-full px-2.5 py-1">
                Disabled
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
