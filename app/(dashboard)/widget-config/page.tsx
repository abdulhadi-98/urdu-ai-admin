'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  Save,
  Palette,
  MessageSquare,
  Layout,
  Mic,
  Timer,
  Clock,
  Code,
  Copy,
  Check,
  FlaskConical,
  QrCode,
  Monitor,
  Globe,
  Users,
  TrendingUp,
  Calendar,
  Zap,
  CheckCircle,
  Info,
  Bot,
  Sun,
  Moon,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { format, subDays, parseISO, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import Header from '@/components/layout/Header'
import StatCard from '@/components/StatCard'
import { supabaseAdmin, type Conversation, type AnalyticsEvent } from '@/lib/supabase'
import { TENANT } from '@/lib/auth'

// ── Types ─────────────────────────────────────────────────────────────────────

interface WidgetConfig {
  brandColor: string
  agentName: string
  welcomeMessageEn: string
  welcomeMessageUr: string
  bubblePosition: 'left' | 'right'
  theme: 'dark' | 'light'
  voiceEnabled: boolean
  autoOpenSeconds: number
  businessHoursStart: string
  businessHoursEnd: string
  offlineMessage: string
  maxVoiceSessions: number
  testMode: boolean
}

const DEFAULT_CONFIG: WidgetConfig = {
  brandColor: '#6366f1',
  agentName: TENANT.agentName,
  welcomeMessageEn: 'Hi! How can I help you today?',
  welcomeMessageUr: 'السلام علیکم! میں آپ کی کس طرح مدد کر سکتا ہوں؟',
  bubblePosition: 'right',
  theme: 'dark',
  voiceEnabled: true,
  autoOpenSeconds: 0,
  businessHoursStart: '09:00',
  businessHoursEnd: '18:00',
  offlineMessage: "We're currently offline. Leave a message and we'll get back to you soon.",
  maxVoiceSessions: 10,
  testMode: false,
}

const TABS = ['Appearance', 'Behavior', 'Installation', 'Analytics']

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toggle({
  value,
  onChange,
  color,
}: {
  value: boolean
  onChange: (v: boolean) => void
  color: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0"
      style={{ backgroundColor: value ? color : '#374151' }}
    >
      <span
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: value ? 'translateX(1.375rem)' : 'translateX(0.25rem)' }}
      />
    </button>
  )
}

function WidgetPreview({
  config,
  avatarPreview,
  open,
}: {
  config: WidgetConfig
  avatarPreview: string | null
  open: boolean
}) {
  const isLight = config.theme === 'light'
  const bg = isLight ? '#ffffff' : '#1a1a2e'
  const headerBg = config.brandColor
  const msgBg = isLight ? '#f3f4f6' : '#2a2a3e'
  const textColor = isLight ? '#111827' : '#f9fafb'
  const subText = isLight ? '#6b7280' : '#9ca3af'
  const isRight = config.bubblePosition === 'right'

  return (
    <div className="relative h-80 rounded-xl overflow-hidden border border-dark-600 bg-dark-700">
      {/* Fake website bg */}
      <div className="absolute inset-0 p-4 space-y-2 opacity-30">
        <div className="h-3 bg-dark-500 rounded w-2/3" />
        <div className="h-3 bg-dark-500 rounded w-full" />
        <div className="h-3 bg-dark-500 rounded w-5/6" />
        <div className="h-3 bg-dark-500 rounded w-3/4 mt-4" />
        <div className="h-3 bg-dark-500 rounded w-full" />
        <div className="h-3 bg-dark-500 rounded w-4/5" />
      </div>

      {/* Chat window */}
      {open && (
        <div
          className="absolute bottom-16 w-56 rounded-xl shadow-2xl overflow-hidden border border-white/10"
          style={{
            [isRight ? 'right' : 'left']: '0.75rem',
            backgroundColor: bg,
          }}
        >
          {/* Header */}
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: headerBg }}>
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center overflow-hidden shrink-0">
              {avatarPreview ? (
                <img src={avatarPreview} className="w-full h-full object-cover" alt="" />
              ) : (
                <Bot className="w-3.5 h-3.5 text-white" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-white leading-tight">{config.agentName}</p>
              <p className="text-[9px] text-white/70">Online</p>
            </div>
          </div>
          {/* Messages */}
          <div className="p-2.5 space-y-2">
            <div className="flex gap-1.5">
              <div
                className="rounded-lg rounded-tl-none px-2.5 py-1.5 text-[10px] leading-snug max-w-[85%]"
                style={{ backgroundColor: msgBg, color: textColor }}
              >
                {config.welcomeMessageEn}
              </div>
            </div>
            <div className="flex justify-end">
              <div
                className="rounded-lg rounded-tr-none px-2.5 py-1.5 text-[10px] leading-snug text-white"
                style={{ backgroundColor: headerBg }}
              >
                Hi, I want to know about properties.
              </div>
            </div>
          </div>
          {/* Input bar */}
          <div
            className="px-2.5 py-2 border-t flex items-center gap-1.5"
            style={{ borderColor: isLight ? '#e5e7eb' : '#2a2a3e' }}
          >
            <div
              className="flex-1 rounded-full px-3 py-1 text-[9px]"
              style={{ backgroundColor: isLight ? '#f9fafb' : '#111827', color: subText }}
            >
              Type a message…
            </div>
            {config.voiceEnabled && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: headerBg }}
              >
                <Mic className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bubble */}
      <div
        className="absolute bottom-3 w-10 h-10 rounded-full flex items-center justify-center shadow-lg cursor-pointer"
        style={{
          [isRight ? 'right' : 'left']: '0.75rem',
          backgroundColor: headerBg,
        }}
      >
        {avatarPreview ? (
          <img src={avatarPreview} className="w-full h-full rounded-full object-cover" alt="" />
        ) : (
          <MessageSquare className="w-5 h-5 text-white" />
        )}
      </div>
    </div>
  )
}

function MockWebsitePreview({
  config,
  avatarPreview,
}: {
  config: WidgetConfig
  avatarPreview: string | null
}) {
  const [widgetOpen, setWidgetOpen] = useState(false)
  const isRight = config.bubblePosition === 'right'
  const isLight = config.theme === 'light'
  const bg = isLight ? '#f9fafb' : '#0f0f1a'
  const cardBg = isLight ? '#ffffff' : '#1a1a2e'
  const msgBg = isLight ? '#f3f4f6' : '#2a2a3e'
  const textColor = isLight ? '#111827' : '#f9fafb'
  const subText = isLight ? '#6b7280' : '#6b7280'

  return (
    <div
      className="relative rounded-xl overflow-hidden border border-dark-500"
      style={{ backgroundColor: bg, height: 380 }}
    >
      {/* Mock browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b bg-dark-700 border-dark-500">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
        <div className="flex-1 bg-dark-600 rounded-md mx-3 px-3 py-0.5 text-[9px] text-gray-500 font-mono">
          https://yourwebsite.com
        </div>
      </div>

      {/* Website content */}
      <div className="p-4 space-y-3">
        <div className="rounded-lg p-3" style={{ backgroundColor: cardBg }}>
          <div className="h-2 rounded w-1/2 mb-2 bg-gray-400/20" />
          <div className="h-2 rounded w-full bg-gray-400/10" />
          <div className="h-2 rounded w-3/4 mt-1 bg-gray-400/10" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-3" style={{ backgroundColor: cardBg }}>
            <div className="h-8 rounded bg-gray-400/10 mb-2" />
            <div className="h-2 rounded w-3/4 bg-gray-400/15" />
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: cardBg }}>
            <div className="h-8 rounded bg-gray-400/10 mb-2" />
            <div className="h-2 rounded w-2/3 bg-gray-400/15" />
          </div>
        </div>
      </div>

      {/* Chat window */}
      {widgetOpen && (
        <div
          className="absolute bottom-14 w-52 rounded-xl shadow-2xl overflow-hidden border border-white/10"
          style={{
            [isRight ? 'right' : 'left']: '0.75rem',
            backgroundColor: isLight ? '#ffffff' : '#1a1a2e',
          }}
        >
          <div className="px-3 py-2.5 flex items-center justify-between" style={{ backgroundColor: config.brandColor }}>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} className="w-full h-full object-cover" alt="" />
                ) : (
                  <Bot className="w-3 h-3 text-white" />
                )}
              </div>
              <p className="text-[10px] font-semibold text-white">{config.agentName}</p>
            </div>
            <button onClick={() => setWidgetOpen(false)} className="text-white/70 text-xs leading-none">✕</button>
          </div>
          <div className="p-2.5 space-y-2">
            <div>
              <div
                className="rounded-lg rounded-tl-none px-2.5 py-1.5 text-[9px] leading-snug inline-block max-w-[85%]"
                style={{ backgroundColor: msgBg, color: textColor }}
              >
                {config.welcomeMessageEn}
              </div>
            </div>
          </div>
          <div
            className="px-2.5 py-1.5 border-t flex items-center gap-1"
            style={{ borderColor: isLight ? '#e5e7eb' : '#2a2a3e' }}
          >
            <div
              className="flex-1 rounded-full px-2 py-1 text-[8px]"
              style={{ backgroundColor: isLight ? '#f3f4f6' : '#111827', color: subText }}
            >
              Type a message…
            </div>
            {config.voiceEnabled && (
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center"
                style={{ backgroundColor: config.brandColor }}
              >
                <Mic className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat bubble */}
      <button
        onClick={() => setWidgetOpen(!widgetOpen)}
        className="absolute bottom-3 w-10 h-10 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-105"
        style={{
          [isRight ? 'right' : 'left']: '0.75rem',
          backgroundColor: config.brandColor,
        }}
      >
        {avatarPreview ? (
          <img src={avatarPreview} className="w-full h-full rounded-full object-cover" alt="" />
        ) : (
          <MessageSquare className="w-5 h-5 text-white" />
        )}
      </button>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WidgetConfigPage() {
  const [activeTab, setActiveTab] = useState(0)
  const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Analytics state
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([])
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  // Load persisted config
  useEffect(() => {
    try {
      const stored = localStorage.getItem('widget_config')
      if (stored) setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(stored) })
    } catch {}
  }, [])

  // Fetch analytics when tab is active
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    try {
      const [convRes, evtRes] = await Promise.all([
        supabaseAdmin.from('conversations').select('*').order('created_at', { ascending: false }),
        supabaseAdmin.from('analytics_events').select('*').order('created_at', { ascending: false }),
      ])
      if (!convRes.error) setConversations(convRes.data ?? [])
      if (!evtRes.error) setAnalyticsEvents((evtRes.data ?? []) as AnalyticsEvent[])
    } catch {}
    setAnalyticsLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 3) fetchAnalytics()
  }, [activeTab, fetchAnalytics])

  const update = <K extends keyof WidgetConfig>(key: K, value: WidgetConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    localStorage.setItem('widget_config', JSON.stringify(config))
    // POST to backend when the endpoint is ready:
    // await fetch('/api/backend/widget-config', { method: 'POST', body: JSON.stringify(config) })
    await new Promise((r) => setTimeout(r, 500))
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const embedCode = `<script src="https://agent.discretdigital.com/widget/${TENANT.slug}.js"${config.testMode ? ' data-test="true"' : ''}></script>`
  const widgetUrl = `https://agent.discretdigital.com/widget/${TENANT.slug}.js`

  // ── Analytics computations ──────────────────────────────────────────────────
  const now = new Date()

  const sessionsToday = useMemo(() => {
    const tod = startOfDay(now)
    const s = new Set<string>()
    conversations.forEach((c) => {
      try { if (parseISO(c.created_at) >= tod) s.add(c.phone) } catch {}
    })
    return s.size
  }, [conversations])

  const sessionsWeek = useMemo(() => {
    const wk = startOfWeek(now)
    const s = new Set<string>()
    conversations.forEach((c) => {
      try { if (parseISO(c.created_at) >= wk) s.add(c.phone) } catch {}
    })
    return s.size
  }, [conversations])

  const sessionsMonth = useMemo(() => {
    const mo = startOfMonth(now)
    const s = new Set<string>()
    conversations.forEach((c) => {
      try { if (parseISO(c.created_at) >= mo) s.add(c.phone) } catch {}
    })
    return s.size
  }, [conversations])

  const voiceBreakdown = useMemo(() => {
    const voice = conversations.filter((c) => c.is_voice).length
    const text = conversations.length - voice
    return [
      { name: 'Text', value: text, color: '#6366f1' },
      { name: 'Voice', value: voice, color: '#22c55e' },
    ]
  }, [conversations])

  const avgConvLength = useMemo(() => {
    const map: Record<string, number> = {}
    conversations.forEach((c) => { map[c.phone] = (map[c.phone] ?? 0) + 1 })
    const vals = Object.values(map)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  }, [conversations])

  const voiceMinutes = useMemo(
    () => conversations.filter((c) => c.is_voice).length * 2,
    [conversations]
  )

  const conversionRate = useMemo(() => {
    if (!conversations.length) return 0
    const converted = conversations.filter((c) => c.needs_human || c.property_interest).length
    return Math.round((converted / conversations.length) * 100)
  }, [conversations])

  const topPages = useMemo(() => {
    const map: Record<string, number> = {}
    analyticsEvents.forEach((e) => {
      const ref = (e.metadata as Record<string, unknown>)?.referrer as string | undefined
        || (e.metadata as Record<string, unknown>)?.page as string | undefined
      if (ref) map[ref] = (map[ref] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [analyticsEvents])

  const dailySessions = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i)
      const dayStr = format(date, 'yyyy-MM-dd')
      const s = new Set<string>()
      conversations.forEach((c) => {
        try { if (format(parseISO(c.created_at), 'yyyy-MM-dd') === dayStr) s.add(c.phone) } catch {}
      })
      return { date: format(date, 'MMM d'), sessions: s.size }
    }), [conversations])

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto">
        {/* Tab bar */}
        <div className="sticky top-0 z-10 bg-dark-900 border-b border-dark-600 px-6 flex gap-0">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              onClick={() => setActiveTab(i)}
              className={`px-5 py-3.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="p-6 space-y-5">

          {/* ── APPEARANCE ──────────────────────────────────────────────────── */}
          {activeTab === 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left — controls */}
              <div className="space-y-5">

                {/* Brand & Identity */}
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-dark-600">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Palette className="w-4 h-4 text-indigo-400" />
                      Brand & Identity
                    </h3>
                  </div>
                  <div className="p-5 space-y-5">
                    {/* Color picker */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Brand Color</label>
                      <div className="flex items-center gap-3 flex-wrap">
                        <input
                          type="color"
                          value={config.brandColor}
                          onChange={(e) => update('brandColor', e.target.value)}
                          className="w-10 h-10 rounded-lg border border-dark-500 bg-transparent cursor-pointer p-0.5"
                        />
                        <code className="text-sm text-white">{config.brandColor}</code>
                        <div className="flex gap-1.5 ml-1">
                          {['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map((c) => (
                            <button
                              key={c}
                              onClick={() => update('brandColor', c)}
                              className="w-5 h-5 rounded-full border-2 transition-all hover:scale-110"
                              style={{
                                backgroundColor: c,
                                borderColor: config.brandColor === c ? 'white' : 'transparent',
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Agent name */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Agent Name</label>
                      <input
                        type="text"
                        value={config.agentName}
                        onChange={(e) => update('agentName', e.target.value)}
                        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
                        placeholder="e.g. Urdu AI Agent"
                      />
                    </div>

                    {/* Avatar */}
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Agent Avatar</label>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-14 h-14 rounded-full border-2 flex items-center justify-center overflow-hidden transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: config.brandColor + '22',
                            borderColor: config.brandColor + '80',
                          }}
                        >
                          {avatarPreview ? (
                            <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" />
                          ) : (
                            <Bot className="w-6 h-6" style={{ color: config.brandColor }} />
                          )}
                        </button>
                        <div>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                          >
                            Upload image
                          </button>
                          <p className="text-xs text-gray-600 mt-0.5">PNG, JPG · max 2 MB</p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarChange}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Welcome messages */}
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-dark-600">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-blue-400" />
                      Welcome Messages
                    </h3>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">English</label>
                      <input
                        type="text"
                        value={config.welcomeMessageEn}
                        onChange={(e) => update('welcomeMessageEn', e.target.value)}
                        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">اردو</label>
                      <input
                        type="text"
                        value={config.welcomeMessageUr}
                        onChange={(e) => update('welcomeMessageUr', e.target.value)}
                        dir="rtl"
                        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                {/* Layout & theme */}
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-dark-600">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Layout className="w-4 h-4 text-purple-400" />
                      Layout & Theme
                    </h3>
                  </div>
                  <div className="p-5 space-y-5">
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Chat Bubble Position</label>
                      <div className="flex rounded-lg overflow-hidden border border-dark-500">
                        {(['left', 'right'] as const).map((pos) => (
                          <button
                            key={pos}
                            onClick={() => update('bubblePosition', pos)}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                              config.bubblePosition === pos
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-dark-700 text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {pos === 'left' ? '← Left' : 'Right →'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Widget Theme</label>
                      <div className="flex rounded-lg overflow-hidden border border-dark-500">
                        {(['dark', 'light'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => update('theme', t)}
                            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                              config.theme === t
                                ? 'bg-indigo-500/20 text-indigo-300'
                                : 'bg-dark-700 text-gray-400 hover:text-gray-200'
                            }`}
                          >
                            {t === 'dark' ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                            {t === 'dark' ? 'Dark' : 'Light'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right — preview */}
              <div>
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden sticky top-20">
                  <div className="px-5 py-4 border-b border-dark-600 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Live Preview</h3>
                    <button
                      onClick={() => setPreviewOpen(!previewOpen)}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {previewOpen ? 'Close widget' : 'Open widget'}
                    </button>
                  </div>
                  <div className="p-4">
                    <WidgetPreview config={config} avatarPreview={avatarPreview} open={previewOpen} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── BEHAVIOR ────────────────────────────────────────────────────── */}
          {activeTab === 1 && (
            <div className="max-w-2xl space-y-5">

              {/* Voice */}
              <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-dark-600">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Mic className="w-4 h-4 text-green-400" />
                    Voice Settings
                  </h3>
                </div>
                <div className="p-5 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white font-medium">Enable Voice Mode</p>
                      <p className="text-xs text-gray-500 mt-0.5">Allow users to send and receive voice messages</p>
                    </div>
                    <Toggle value={config.voiceEnabled} onChange={(v) => update('voiceEnabled', v)} color={config.brandColor} />
                  </div>

                  {config.voiceEnabled && (
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">
                        Max Concurrent Voice Sessions
                        <span className="ml-2 font-semibold text-white">{config.maxVoiceSessions}</span>
                      </label>
                      <input
                        type="range"
                        min={1}
                        max={50}
                        value={config.maxVoiceSessions}
                        onChange={(e) => update('maxVoiceSessions', Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-xs text-gray-600 mt-1">
                        <span>1</span>
                        <span>50</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-open */}
              <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-dark-600">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Timer className="w-4 h-4 text-blue-400" />
                    Auto-Open Delay
                  </h3>
                </div>
                <div className="p-5">
                  <label className="block text-xs text-gray-500 mb-2">
                    Open widget after
                    <span className="ml-2 font-semibold text-white">
                      {config.autoOpenSeconds === 0 ? 'Disabled' : `${config.autoOpenSeconds}s`}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={60}
                    step={5}
                    value={config.autoOpenSeconds}
                    onChange={(e) => update('autoOpenSeconds', Number(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-xs text-gray-600 mt-1">
                    <span>Off</span>
                    <span>60s</span>
                  </div>
                  <p className="text-xs text-gray-600 mt-2.5">
                    0 = disabled. When set, the widget chat window opens automatically after the specified delay on each page load.
                  </p>
                </div>
              </div>

              {/* Business hours */}
              <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-dark-600">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-400" />
                    Business Hours
                  </h3>
                </div>
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Opening Time</label>
                      <input
                        type="time"
                        value={config.businessHoursStart}
                        onChange={(e) => update('businessHoursStart', e.target.value)}
                        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 [color-scheme:dark]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-2">Closing Time</label>
                      <input
                        type="time"
                        value={config.businessHoursEnd}
                        onChange={(e) => update('businessHoursEnd', e.target.value)}
                        className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500/60 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-2">Offline Message</label>
                    <textarea
                      value={config.offlineMessage}
                      onChange={(e) => update('offlineMessage', e.target.value)}
                      rows={3}
                      className="w-full bg-dark-700 border border-dark-500 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60 resize-none transition-colors"
                    />
                    <p className="text-xs text-gray-600 mt-1">Shown to visitors outside business hours</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── INSTALLATION ────────────────────────────────────────────────── */}
          {activeTab === 2 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Left */}
              <div className="space-y-5">

                {/* Embed code */}
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-dark-600 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Code className="w-4 h-4 text-indigo-400" />
                      Embed Code
                    </h3>
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-gray-500 mb-3">
                      Paste before the closing{' '}
                      <code className="bg-dark-700 px-1 rounded text-gray-300">&lt;/body&gt;</code> tag:
                    </p>
                    <pre className="bg-dark-700 border border-dark-600 rounded-lg p-4 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{embedCode}
                    </pre>
                  </div>
                </div>

                {/* Test mode */}
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-dark-600">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <FlaskConical className="w-4 h-4 text-yellow-400" />
                      Test Mode
                    </h3>
                  </div>
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-white font-medium">Enable Test Mode</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Conversations won't count against usage limits or analytics
                        </p>
                      </div>
                      <Toggle
                        value={config.testMode}
                        onChange={(v) => update('testMode', v)}
                        color={config.brandColor}
                      />
                    </div>
                    {config.testMode && (
                      <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2.5">
                        <Info className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-yellow-400/90">
                          Test mode active. The embed snippet includes{' '}
                          <code className="bg-dark-700 px-1 rounded">data-test=&quot;true&quot;</code>.
                          Save and re-copy the snippet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* QR code */}
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-dark-600">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-green-400" />
                      QR Code
                    </h3>
                  </div>
                  <div className="p-5 flex flex-col items-center gap-4">
                    <p className="text-xs text-gray-500 self-start">
                      Scan on mobile to open the widget URL
                    </p>
                    <div className="bg-white rounded-xl p-3 shadow-lg">
                      <QRCodeSVG
                        value={widgetUrl}
                        size={148}
                        bgColor="#ffffff"
                        fgColor="#111827"
                        level="M"
                      />
                    </div>
                    <p className="text-[10px] text-gray-600 font-mono text-center break-all">{widgetUrl}</p>
                  </div>
                </div>
              </div>

              {/* Right — mock website */}
              <div>
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden sticky top-20">
                  <div className="px-5 py-4 border-b border-dark-600">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                      <Monitor className="w-4 h-4 text-blue-400" />
                      Live Preview — Mock Website
                    </h3>
                    <p className="text-xs text-gray-500 mt-0.5">Click the bubble to open/close the chat window</p>
                  </div>
                  <div className="p-4">
                    <MockWebsitePreview config={config} avatarPreview={avatarPreview} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ANALYTICS ───────────────────────────────────────────────────── */}
          {activeTab === 3 && (
            analyticsLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-sm text-gray-500">Loading analytics…</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  <StatCard title="Sessions Today" value={sessionsToday} icon={Users} color="indigo" subtitle="Unique visitors" />
                  <StatCard title="Sessions This Week" value={sessionsWeek} icon={TrendingUp} color="blue" subtitle="Unique visitors" />
                  <StatCard title="Sessions This Month" value={sessionsMonth} icon={Calendar} color="purple" subtitle="Unique visitors" />
                  <StatCard
                    title="Avg Conv. Length"
                    value={avgConvLength ? `${avgConvLength} msgs` : 'N/A'}
                    icon={MessageSquare}
                    color="green"
                    subtitle="Messages per session"
                  />
                  <StatCard
                    title="Lead Conversion Rate"
                    value={`${conversionRate}%`}
                    icon={Zap}
                    color="yellow"
                    subtitle="Visitor → engaged"
                  />
                  <StatCard
                    title="Voice Minutes Used"
                    value={`${voiceMinutes} min`}
                    icon={Mic}
                    color="red"
                    subtitle="Est. total (2 min/msg)"
                  />
                </div>

                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Daily sessions bar chart */}
                  <div className="lg:col-span-2 bg-dark-800 border border-dark-600 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Widget Sessions (Last 7 Days)</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailySessions} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#22222e" />
                        <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: '#1a1a2e',
                            border: '1px solid #2a2a3e',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                        />
                        <Bar dataKey="sessions" name="Sessions" fill={config.brandColor} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Text vs Voice donut */}
                  <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-white mb-4">Text vs Voice</h3>
                    {conversations.length > 0 ? (
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={voiceBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={52}
                            outerRadius={76}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {voiceBreakdown.map((entry, i) => (
                              <Cell key={i} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              background: '#1a1a2e',
                              border: '1px solid #2a2a3e',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11, color: '#9ca3af' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-[200px] flex items-center justify-center text-gray-600 text-sm">
                        No data yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Top pages */}
                <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
                  <div className="px-5 py-4 border-b border-dark-600 flex items-center gap-2">
                    <Globe className="w-4 h-4 text-blue-400" />
                    <h3 className="text-sm font-semibold text-white">Top Pages — Referrer Tracking</h3>
                  </div>
                  {topPages.length === 0 ? (
                    <div className="px-5 py-10 text-center">
                      <p className="text-sm text-gray-500">No referrer data yet.</p>
                      <p className="text-xs text-gray-600 mt-1.5 max-w-sm mx-auto">
                        Pass{' '}
                        <code className="bg-dark-700 px-1 rounded text-gray-400">referrer</code> or{' '}
                        <code className="bg-dark-700 px-1 rounded text-gray-400">page</code> inside the{' '}
                        <code className="bg-dark-700 px-1 rounded text-gray-400">metadata</code> field when
                        logging analytics events from the widget.
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-600">
                          <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Page / Referrer</th>
                          <th className="px-5 py-3 text-right text-xs text-gray-500 font-medium">Sessions</th>
                          <th className="px-5 py-3 text-right text-xs text-gray-500 font-medium">Share</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-600">
                        {topPages.map((row) => {
                          const total = topPages.reduce((a, r) => a + r.count, 0)
                          const share = total ? Math.round((row.count / total) * 100) : 0
                          return (
                            <tr key={row.page} className="hover:bg-dark-700/40 transition-colors">
                              <td className="px-5 py-3 text-white font-mono text-xs truncate max-w-xs">{row.page}</td>
                              <td className="px-5 py-3 text-right text-white font-medium">{row.count}</td>
                              <td className="px-5 py-3 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <div className="w-16 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-indigo-500"
                                      style={{ width: `${share}%` }}
                                    />
                                  </div>
                                  <span className="text-gray-400 text-xs w-8 text-right">{share}%</span>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )
          )}

          {/* Save button — not shown on Analytics tab */}
          {activeTab !== 3 && (
            <div className="flex items-center justify-end gap-3 pt-2 pb-2">
              {saved && (
                <span className="text-sm text-green-400 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  Saved successfully
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {saving ? (
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving…' : 'Save Configuration'}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
