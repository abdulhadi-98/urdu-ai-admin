'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Upload, X, Save, Loader2, CheckCircle, Bot, Palette,
  Building2, Link2, Sparkles, AlertTriangle, Image as ImageIcon,
} from 'lucide-react'
import Header from '@/components/layout/Header'
import { useBranding, BrandingContext, hexToRgba, DEFAULT_BRANDING, type BrandingConfig } from '@/lib/branding-context'
import { useUser } from '@/lib/user-context'
import { cn } from '@/lib/utils'

const PRESET_COLORS = [
  { name: 'Indigo',  hex: '#6366f1' },
  { name: 'Blue',    hex: '#3b82f6' },
  { name: 'Violet',  hex: '#8b5cf6' },
  { name: 'Purple',  hex: '#a855f7' },
  { name: 'Pink',    hex: '#ec4899' },
  { name: 'Rose',    hex: '#f43f5e' },
  { name: 'Orange',  hex: '#f97316' },
  { name: 'Amber',   hex: '#f59e0b' },
  { name: 'Green',   hex: '#22c55e' },
  { name: 'Teal',    hex: '#14b8a6' },
  { name: 'Cyan',    hex: '#06b6d4' },
  { name: 'Sky',     hex: '#0ea5e9' },
]

export default function BrandingPage() {
  const current   = useBranding()
  const user      = useUser()
  const isSuperAdmin = user?.role === 'super_admin'

  const [orgName,       setOrgName]       = useState(current.orgName)
  const [slug,          setSlug]          = useState(current.slug)
  const [agentName,     setAgentName]     = useState(current.agentName)
  const [logoUrl,       setLogoUrl]       = useState<string | null>(current.logoUrl)
  const [primaryColor,  setPrimaryColor]  = useState(current.primaryColor)
  const [customColor,   setCustomColor]   = useState(current.primaryColor)

  const [saving,        setSaving]        = useState(false)
  const [saved,         setSaved]         = useState(false)
  const [saveError,     setSaveError]     = useState('')
  const [uploading,     setUploading]     = useState(false)
  const [uploadError,   setUploadError]   = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Sync with context when it loads
  useEffect(() => {
    setOrgName(current.orgName)
    setSlug(current.slug)
    setAgentName(current.agentName)
    setLogoUrl(current.logoUrl)
    setPrimaryColor(current.primaryColor)
    setCustomColor(current.primaryColor)
  }, [current])

  const handleLogoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) { setUploadError('Only image files allowed'); return }
    if (file.size > 2 * 1024 * 1024) { setUploadError('Max size is 2MB'); return }

    setUploading(true)
    setUploadError('')
    try {
      const fd = new FormData()
      fd.append('logo', file)
      const res = await fetch('/api/branding/logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLogoUrl(data.url)
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleLogoUpload(file)
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setSaveError('')
    setSaved(false)
    try {
      const res = await fetch('/api/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName, slug, agentName, logoUrl, primaryColor }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Apply color immediately
      document.documentElement.style.setProperty('--primary', primaryColor)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  // Live preview branding object
  const preview: BrandingConfig = { orgName, slug, agentName, logoUrl, primaryColor }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-5xl mx-auto">

          {/* Title */}
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Palette className="w-5 h-5 text-indigo-400" />
              Dashboard Branding
            </h1>
            <p className="text-sm text-gray-500 mt-1">Customise how your dashboard looks and is identified</p>
          </div>

          {!isSuperAdmin && (
            <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 mb-6 text-sm text-yellow-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Only super admins can edit branding settings.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: form ───────────────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Logo */}
              <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 text-gray-400" />
                  Logo
                </h2>

                <div className="flex items-start gap-4">
                  {/* Preview */}
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-dark-500 flex items-center justify-center shrink-0 overflow-hidden bg-dark-700">
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Bot className="w-7 h-7 text-gray-600" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-dark-500 hover:border-indigo-500/50 rounded-xl p-4 cursor-pointer transition-colors text-center"
                    >
                      {uploading ? (
                        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading…
                        </div>
                      ) : (
                        <>
                          <Upload className="w-5 h-5 text-gray-500 mx-auto mb-1" />
                          <p className="text-xs text-gray-400">Click or drag to upload</p>
                          <p className="text-xs text-gray-600 mt-0.5">PNG, JPG, SVG — max 2MB</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={!isSuperAdmin}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f) }}
                    />
                    {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
                    {logoUrl && (
                      <button
                        onClick={() => setLogoUrl(null)}
                        disabled={!isSuperAdmin}
                        className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3 h-3" /> Remove logo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Organisation */}
              <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  Organisation
                </h2>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Organisation Name</label>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      disabled={!isSuperAdmin}
                      placeholder="Discret Digital"
                      className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Slug
                      <span className="text-gray-600 ml-1">— used in widget URLs</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4 text-gray-600 shrink-0" />
                      <input
                        type="text"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))}
                        disabled={!isSuperAdmin}
                        placeholder="discret"
                        className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    {slug !== current.slug && (
                      <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Changing the slug will break existing widget embed codes
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Agent */}
              <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-gray-400" />
                  AI Agent
                </h2>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    disabled={!isSuperAdmin}
                    placeholder="Urdu AI Agent"
                    className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Color */}
              <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-gray-400" />
                  Theme Color
                </h2>

                {/* Presets */}
                <div className="grid grid-cols-6 gap-2 mb-4">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      title={c.name}
                      disabled={!isSuperAdmin}
                      onClick={() => { setPrimaryColor(c.hex); setCustomColor(c.hex) }}
                      className={cn(
                        'h-9 rounded-lg transition-all border-2',
                        primaryColor === c.hex
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>

                {/* Custom */}
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg border border-dark-500 shrink-0"
                    style={{ backgroundColor: customColor }}
                  />
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">Custom hex colour</label>
                    <input
                      type="text"
                      value={customColor}
                      onChange={(e) => {
                        setCustomColor(e.target.value)
                        if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) setPrimaryColor(e.target.value)
                      }}
                      disabled={!isSuperAdmin}
                      placeholder="#6366f1"
                      maxLength={7}
                      className="w-full bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-gray-600 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                    />
                  </div>
                  <input
                    type="color"
                    value={customColor}
                    disabled={!isSuperAdmin}
                    onChange={(e) => { setCustomColor(e.target.value); setPrimaryColor(e.target.value) }}
                    className="w-9 h-9 rounded-lg border border-dark-500 cursor-pointer bg-transparent disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Save */}
              {isSuperAdmin && (
                <div className="flex items-center justify-between">
                  {saveError && (
                    <p className="text-sm text-red-400 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" />{saveError}
                    </p>
                  )}
                  <div className="ml-auto flex items-center gap-3">
                    {saved && (
                      <span className="text-sm text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Saved
                      </span>
                    )}
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Branding
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Right: live preview ────────────────────────────────── */}
            <div className="lg:col-span-1">
              <div className="sticky top-0">
                <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider font-medium">Live Preview</p>
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                  {/* Mini sidebar preview */}
                  <div className="p-4 border-b border-dark-600">
                    <div className="flex items-center gap-2.5">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain bg-dark-700 p-1" />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: hexToRgba(primaryColor, 0.2), border: `1px solid ${hexToRgba(primaryColor, 0.3)}` }}
                        >
                          <Bot className="w-4 h-4" style={{ color: primaryColor }} />
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-semibold text-white">{agentName || 'AI Agent'}</p>
                        <p className="text-[10px] text-gray-500">{orgName || 'Organisation'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Nav items */}
                  <div className="p-2 space-y-0.5">
                    {['Dashboard', 'Conversations', 'Web Leads', 'Settings'].map((item, i) => (
                      <div
                        key={item}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                        style={i === 0 ? {
                          backgroundColor: hexToRgba(primaryColor, 0.15),
                          border: `1px solid ${hexToRgba(primaryColor, 0.2)}`,
                          color: primaryColor,
                        } : { color: '#9ca3af' }}
                      >
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: i === 0 ? primaryColor : '#4b5563' }}
                        />
                        {item}
                      </div>
                    ))}
                  </div>

                  {/* Color chip */}
                  <div className="px-4 py-3 border-t border-dark-600">
                    <p className="text-xs text-gray-500 mb-2">Primary colour</p>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md" style={{ backgroundColor: primaryColor }} />
                      <span className="text-xs font-mono text-white">{primaryColor}</span>
                    </div>
                  </div>
                </div>

                {/* Slug preview */}
                <div className="mt-4 bg-dark-800 border border-dark-600 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-2">Widget embed URL</p>
                  <p className="text-[10px] font-mono text-indigo-300 break-all">
                    /widget/{slug || 'your-slug'}/bundle.js
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
