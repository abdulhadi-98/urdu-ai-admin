'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Line,
  PieChart,
  Pie,
} from 'recharts'
import { format, subDays, parseISO, subMonths, startOfMonth, startOfDay, startOfWeek } from 'date-fns'
import Link from 'next/link'
import {
  MessageSquare,
  Mic,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  Zap,
  BarChart2,
  Calendar,
  Flame,
  Globe,
  Monitor,
  Phone,
  ExternalLink,
} from 'lucide-react'
import { supabaseAdmin, type Conversation, type AnalyticsEvent } from '@/lib/supabase'
import StatCard from '@/components/StatCard'
import Header from '@/components/layout/Header'
import { getInitials, getAvatarColor, formatPhone } from '@/lib/utils'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) =>
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
)

const CHANNEL_COLORS: Record<string, string> = {
  facebook: '#1877f2',
  google: '#34a853',
  instagram: '#e1306c',
  referral: '#f59e0b',
  olx: '#6366f1',
  zameen: '#10b981',
  whatsapp: '#25d366',
  other: '#6b7280',
  unknown: '#374151',
}

function channelColor(src: string) {
  const key = src.toLowerCase()
  return CHANNEL_COLORS[key] ?? CHANNEL_COLORS.other
}

export default function DashboardPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const [convRes, evtRes] = await Promise.all([
        supabaseAdmin
          .from('conversations')
          .select('*')
          .order('created_at', { ascending: false }),
        supabaseAdmin
          .from('analytics_events')
          .select('id,event_type,lead_source,created_at,phone,metadata')
          .order('created_at', { ascending: false }),
      ])
      if (!convRes.error) setConversations(convRes.data ?? [])
      if (!evtRes.error) setAnalyticsEvents((evtRes.data ?? []) as AnalyticsEvent[])
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleRefresh = () => { setRefreshing(true); fetchData() }

  // ── Core stats ───────────────────────────────────────────────────────────────
  const totalMessages = conversations.length
  const voiceMessages = conversations.filter((c) => c.is_voice).length
  const escalations = conversations.filter((c) => c.needs_human).length
  const avgResponseTime = conversations.filter((c) => c.response_time_ms).length
    ? Math.round(
        conversations.filter((c) => c.response_time_ms).reduce((a, c) => a + (c.response_time_ms ?? 0), 0) /
          conversations.filter((c) => c.response_time_ms).length
      )
    : 0
  const uniquePhones = new Set(conversations.map((c) => c.phone)).size

  // ── 7-day chart ──────────────────────────────────────────────────────────────
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i)
    const dayStr = format(date, 'yyyy-MM-dd')
    const dayConvs = conversations.filter((c) => {
      try { return format(parseISO(c.created_at), 'yyyy-MM-dd') === dayStr } catch { return false }
    })
    return {
      date: format(date, 'MMM d'),
      messages: dayConvs.length,
      voice: dayConvs.filter((c) => c.is_voice).length,
      escalations: dayConvs.filter((c) => c.needs_human).length,
    }
  })

  // ── Property interest ────────────────────────────────────────────────────────
  const propertyMap: Record<string, number> = {}
  conversations.forEach((c) => {
    if (c.property_interest) propertyMap[c.property_interest] = (propertyMap[c.property_interest] ?? 0) + 1
  })
  const propertyData = Object.entries(propertyMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // ── Recent contacts ──────────────────────────────────────────────────────────
  const phoneMap: Record<string, Conversation> = {}
  conversations.forEach((c) => {
    if (!phoneMap[c.phone] || c.created_at > phoneMap[c.phone].created_at) phoneMap[c.phone] = c
  })
  const recentContacts = Object.values(phoneMap)
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 10)

  // ── Escalation queue ─────────────────────────────────────────────────────────
  // Unique contacts that need human intervention, most recent first
  const escalationMap: Record<string, Conversation> = {}
  conversations.forEach((c) => {
    if (c.needs_human) {
      if (!escalationMap[c.phone] || c.created_at > escalationMap[c.phone].created_at) {
        escalationMap[c.phone] = c
      }
    }
  })
  const escalationQueue = Object.values(escalationMap)
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 8)

  // ── Web sessions stats ───────────────────────────────────────────────────────
  const webContactsCount = Object.values(phoneMap).filter(
    (c) => c.source === 'website' || c.phone?.startsWith('visitor_') || c.phone?.startsWith('widget_')
  ).length
  const whatsappContactsCount = Object.values(phoneMap).filter(
    (c) => c.source !== 'website' && !c.phone?.startsWith('visitor_') && !c.phone?.startsWith('widget_')
  ).length

  // ── Heatmap: day × hour ──────────────────────────────────────────────────────
  const heatmapGrid = useMemo(() => {
    const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    conversations.forEach((c) => {
      try {
        const d = parseISO(c.created_at)
        grid[d.getDay()][d.getHours()]++
      } catch {}
    })
    return grid
  }, [conversations])

  const heatmapMax = useMemo(() => Math.max(1, ...heatmapGrid.flat()), [heatmapGrid])

  // ── Seasonal trends: last 12 months ─────────────────────────────────────────
  const seasonalData = useMemo(() => {
    const map: Record<string, { leads: number; escalations: number }> = {}
    for (let i = 11; i >= 0; i--) {
      const key = format(subMonths(startOfMonth(new Date()), i), 'yyyy-MM')
      map[key] = { leads: 0, escalations: 0 }
    }
    conversations.forEach((c) => {
      try {
        const key = format(parseISO(c.created_at), 'yyyy-MM')
        if (map[key]) {
          map[key].leads++
          if (c.needs_human) map[key].escalations++
        }
      } catch {}
    })
    return Object.entries(map).map(([key, { leads, escalations }]) => ({
      month: format(parseISO(key + '-01'), 'MMM yy'),
      leads,
      convRate: leads ? Math.round((escalations / leads) * 100) : 0,
    }))
  }, [conversations])

  // ── ROI / channel tracker ─────────────────────────────────────────────────────
  const channelData = useMemo(() => {
    const map: Record<string, { leads: number; conversions: number }> = {}
    const source = analyticsEvents.length > 0 ? analyticsEvents : []

    if (source.length === 0) {
      // Fallback: try to infer from conversations if no analytics_events
      return []
    }

    source.forEach((e) => {
      const key = (e.lead_source || 'unknown').toLowerCase()
      if (!map[key]) map[key] = { leads: 0, conversions: 0 }
      map[key].leads++
    })

    return Object.entries(map)
      .map(([channel, { leads, conversions }]) => ({ channel, leads, conversions }))
      .sort((a, b) => b.leads - a.leads)
  }, [analyticsEvents])

  // ── Widget / website analytics ───────────────────────────────────────────────
  const widgetConvs = useMemo(
    () => conversations.filter((c) => c.source === 'website' || c.phone?.startsWith('visitor_') || c.phone?.startsWith('widget_')),
    [conversations]
  )

  const now = new Date()

  const widgetSessionsToday = useMemo(() => {
    const tod = startOfDay(now)
    const s = new Set<string>()
    widgetConvs.forEach((c) => { try { if (parseISO(c.created_at) >= tod) s.add(c.phone) } catch {} })
    return s.size
  }, [widgetConvs])

  const widgetSessionsWeek = useMemo(() => {
    const wk = startOfWeek(now)
    const s = new Set<string>()
    widgetConvs.forEach((c) => { try { if (parseISO(c.created_at) >= wk) s.add(c.phone) } catch {} })
    return s.size
  }, [widgetConvs])

  const widgetSessionsMonth = useMemo(() => {
    const mo = startOfMonth(now)
    const s = new Set<string>()
    widgetConvs.forEach((c) => { try { if (parseISO(c.created_at) >= mo) s.add(c.phone) } catch {} })
    return s.size
  }, [widgetConvs])

  const widgetVoiceBreakdown = useMemo(() => {
    const voice = widgetConvs.filter((c) => c.is_voice).length
    const text = widgetConvs.length - voice
    return [
      { name: 'Text', value: text, color: '#6366f1' },
      { name: 'Voice', value: voice, color: '#22c55e' },
    ]
  }, [widgetConvs])

  const widgetConvRate = useMemo(() => {
    if (!widgetConvs.length) return 0
    const converted = widgetConvs.filter((c) => c.needs_human || c.property_interest).length
    return Math.round((converted / widgetConvs.length) * 100)
  }, [widgetConvs])

  const widgetDailySessions = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i)
      const dayStr = format(date, 'yyyy-MM-dd')
      const s = new Set<string>()
      widgetConvs.forEach((c) => {
        try { if (format(parseISO(c.created_at), 'yyyy-MM-dd') === dayStr) s.add(c.phone) } catch {}
      })
      return { date: format(date, 'MMM d'), sessions: s.size }
    }),
    [widgetConvs]
  )

  const topPages = useMemo(() => {
    const map: Record<string, number> = {}
    analyticsEvents.forEach((e) => {
      const meta = e.metadata as Record<string, unknown> | null
      const ref = (meta?.referrer ?? meta?.page) as string | undefined
      if (ref) map[ref] = (map[ref] ?? 0) + 1
    })
    return Object.entries(map)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [analyticsEvents])

  const CustomTooltip = ({ active, payload, label }: Record<string, unknown>) => {
    if (active && payload && Array.isArray(payload) && payload.length) {
      return (
        <div className="bg-dark-700 border border-dark-500 rounded-lg p-3 text-xs shadow-xl">
          <p className="text-gray-400 mb-1">{label as string}</p>
          {(payload as Array<{ name: string; value: number; color: string }>).map((p) => (
            <p key={p.name} style={{ color: p.color }}>
              {p.name}: <span className="font-bold">{p.value}</span>
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-400 text-sm">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header onRefresh={handleRefresh} refreshing={refreshing} />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">

        {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Total Messages" value={totalMessages.toLocaleString()} icon={MessageSquare} color="indigo" subtitle="All time conversations" />
          <StatCard title="Voice Messages" value={voiceMessages.toLocaleString()} icon={Mic} color="green" subtitle={`${totalMessages ? Math.round((voiceMessages / totalMessages) * 100) : 0}% of total`} />
          <StatCard title="Avg Response Time" value={avgResponseTime ? `${(avgResponseTime / 1000).toFixed(1)}s` : 'N/A'} icon={Clock} color="blue" subtitle="AI response latency" />
          <StatCard title="Escalations" value={escalations.toLocaleString()} icon={AlertTriangle} color="yellow" subtitle="Need human review" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Unique Contacts" value={uniquePhones.toLocaleString()} icon={Users} color="purple" subtitle="Active leads" />
          <StatCard title="7-Day Messages" value={last7Days.reduce((a, d) => a + d.messages, 0).toLocaleString()} icon={TrendingUp} color="indigo" subtitle="Last 7 days" />
          <StatCard title="WhatsApp Contacts" value={whatsappContactsCount.toLocaleString()} icon={Phone} color="green" subtitle="WhatsApp leads" />
          <StatCard title="Web Contacts" value={webContactsCount.toLocaleString()} icon={Globe} color="blue" subtitle="Website visitors" />
        </div>

        {/* ── 7-day + property charts ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-dark-800 border border-dark-600 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Message Activity (7 Days)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={last7Days} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradMsg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradVoice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#22222e" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Area type="monotone" dataKey="messages" name="Messages" stroke="#6366f1" fill="url(#gradMsg)" strokeWidth={2} />
                <Area type="monotone" dataKey="voice" name="Voice" stroke="#22c55e" fill="url(#gradVoice)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Property Interests</h3>
            {propertyData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={propertyData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" name="Leads" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">No property data yet</div>
            )}
          </div>
        </div>

        {/* ── Heatmap ─────────────────────────────────────────────────────────── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">Lead Activity Heatmap</h3>
            <span className="text-xs text-gray-500 ml-1">— when are buyers most active?</span>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex mb-1 ml-10">
                {HOURS.map((h, i) => (
                  <div key={i} className="flex-1 text-center text-[9px] text-gray-600">
                    {i % 3 === 0 ? h : ''}
                  </div>
                ))}
              </div>
              {/* Grid rows */}
              {DAYS.map((day, di) => (
                <div key={day} className="flex items-center mb-0.5">
                  <span className="w-10 text-xs text-gray-500 shrink-0">{day}</span>
                  {heatmapGrid[di].map((val, hi) => {
                    const intensity = val / heatmapMax
                    const alpha = intensity === 0 ? 0 : Math.max(0.08, intensity)
                    return (
                      <div
                        key={hi}
                        className="flex-1 h-6 rounded-sm mx-px cursor-default transition-opacity"
                        style={{ backgroundColor: `rgba(99,102,241,${alpha})` }}
                        title={`${day} ${HOURS[hi]}: ${val} lead${val !== 1 ? 's' : ''}`}
                      />
                    )
                  })}
                </div>
              ))}
              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 justify-end">
                <span className="text-xs text-gray-600">Less</span>
                {[0.08, 0.25, 0.45, 0.65, 0.85, 1].map((a, i) => (
                  <div key={i} className="w-4 h-4 rounded-sm" style={{ backgroundColor: `rgba(99,102,241,${a})` }} />
                ))}
                <span className="text-xs text-gray-600">More</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Seasonal Trends ──────────────────────────────────────────────────── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">Seasonal Trends</h3>
            <span className="text-xs text-gray-500 ml-1">— lead volume & escalation rate by month</span>
          </div>
          {seasonalData.some((d) => d.leads > 0) ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={seasonalData} margin={{ top: 5, right: 20, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#22222e" />
                <XAxis dataKey="month" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="left" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => `${v}%`} tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-dark-700 border border-dark-500 rounded-lg p-3 text-xs shadow-xl">
                        <p className="text-gray-400 mb-1">{label}</p>
                        {payload.map((p: any) => (
                          <p key={p.name} style={{ color: p.color }}>
                            {p.name}: <span className="font-bold">{p.value}{p.name === 'Conv. Rate' ? '%' : ''}</span>
                          </p>
                        ))}
                      </div>
                    )
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#6366f1" fillOpacity={0.8} radius={[3, 3, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="convRate" name="Conv. Rate" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b' }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[240px] flex items-center justify-center text-gray-600 text-sm">
              No data yet — will populate as leads come in
            </div>
          )}
        </div>

        {/* ── ROI / Channel Tracker ────────────────────────────────────────────── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-green-400" />
            <h3 className="text-sm font-semibold text-white">Channel / Source Tracker</h3>
            <span className="text-xs text-gray-500 ml-1">— where are leads coming from?</span>
          </div>
          {channelData.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-gray-500">No source data yet.</p>
              <p className="text-xs text-gray-600 mt-1">
                Pass <code className="bg-dark-700 px-1 rounded">lead_source</code> (e.g. <code className="bg-dark-700 px-1 rounded">facebook</code>, <code className="bg-dark-700 px-1 rounded">zameen</code>, <code className="bg-dark-700 px-1 rounded">olx</code>) when logging analytics events.
              </p>
            </div>
          ) : (
            <div>
              {/* Bar chart */}
              <div className="p-5 border-b border-dark-600">
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={channelData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#22222e" />
                    <XAxis dataKey="channel" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="leads" name="Leads" radius={[4, 4, 0, 0]}>
                      {channelData.map((entry, index) => (
                        <Cell key={index} fill={channelColor(entry.channel)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-600">
                    <th className="px-5 py-3 text-left text-xs text-gray-500 font-medium">Channel</th>
                    <th className="px-5 py-3 text-right text-xs text-gray-500 font-medium">Leads</th>
                    <th className="px-5 py-3 text-right text-xs text-gray-500 font-medium">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  {channelData.map((row) => {
                    const total = channelData.reduce((a, r) => a + r.leads, 0)
                    const share = total ? Math.round((row.leads / total) * 100) : 0
                    return (
                      <tr key={row.channel} className="hover:bg-dark-700/40 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: channelColor(row.channel) }} />
                            <span className="text-white capitalize">{row.channel}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-white font-medium">{row.leads.toLocaleString()}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${share}%`, backgroundColor: channelColor(row.channel) }} />
                            </div>
                            <span className="text-gray-400 text-xs w-8 text-right">{share}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Website Widget Analytics ─────────────────────────────────────────── */}
        <div className="border-t border-dark-600 pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Website Widget Analytics</h2>
            <span className="text-xs text-gray-500 ml-1">— visitors from the embedded chat widget</span>
          </div>

          {/* Widget stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <StatCard title="Widget Sessions Today" value={widgetSessionsToday} icon={Users} color="indigo" subtitle="Unique visitors" />
            <StatCard title="Sessions This Week" value={widgetSessionsWeek} icon={TrendingUp} color="blue" subtitle="Unique visitors" />
            <StatCard title="Sessions This Month" value={widgetSessionsMonth} icon={Calendar} color="purple" subtitle="Unique visitors" />
            <StatCard title="Lead Conv. Rate" value={`${widgetConvRate}%`} icon={Zap} color="yellow" subtitle="Visitor → engaged" />
          </div>

          {/* Widget charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            {/* Daily sessions */}
            <div className="lg:col-span-2 bg-dark-800 border border-dark-600 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Widget Sessions (Last 7 Days)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={widgetDailySessions} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#22222e" />
                  <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sessions" name="Sessions" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Text vs Voice donut */}
            <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">Text vs Voice</h3>
              {widgetConvs.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={widgetVoiceBreakdown}
                      cx="50%" cy="50%"
                      innerRadius={52} outerRadius={76}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {widgetVoiceBreakdown.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: 8, fontSize: 12 }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-gray-600 text-sm">No widget sessions yet</div>
              )}
            </div>
          </div>

          {/* Top pages */}
          <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden mb-5">
            <div className="px-5 py-4 border-b border-dark-600 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Top Pages — Referrer Tracking</h3>
            </div>
            {topPages.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-500">No referrer data yet.</p>
                <p className="text-xs text-gray-600 mt-1">
                  Pass <code className="bg-dark-700 px-1 rounded">referrer</code> or{' '}
                  <code className="bg-dark-700 px-1 rounded">page</code> in the{' '}
                  <code className="bg-dark-700 px-1 rounded">metadata</code> field when logging analytics events.
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
                              <div className="h-full rounded-full bg-indigo-500" style={{ width: `${share}%` }} />
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

        {/* ── Escalation Queue ─────────────────────────────────────────────────── */}
        {escalationQueue.length > 0 && (
          <div className="bg-dark-800 border border-yellow-500/20 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-yellow-500/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-white">Escalation Queue</h3>
                <span className="text-xs bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 rounded-full px-2 py-0.5">
                  {escalationQueue.length} pending
                </span>
              </div>
              <Link
                href="/conversations"
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Handle all <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-dark-600">
              {escalationQueue.map((conv) => {
                const isWeb = conv.source === 'website' || conv.phone?.startsWith('visitor_') || conv.phone?.startsWith('widget_')
                return (
                  <div key={conv.phone} className="flex items-center gap-4 px-5 py-3.5 hover:bg-dark-700/50 transition-colors">
                    {isWeb ? (
                      <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-blue-400" />
                      </div>
                    ) : (
                      <div className={`w-9 h-9 rounded-full ${getAvatarColor(conv.phone)} flex items-center justify-center shrink-0`}>
                        <span className="text-xs font-bold text-white">{getInitials(conv.name, conv.phone)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-white truncate">{conv.name ?? formatPhone(conv.phone)}</p>
                        <p className="text-xs text-gray-500 shrink-0">{format(parseISO(conv.created_at), 'MMM d, h:mm a')}</p>
                      </div>
                      <p className="text-xs text-yellow-500/80 truncate mt-0.5">{conv.escalation_reason ?? conv.user_message ?? '—'}</p>
                    </div>
                    <Link
                      href="/conversations"
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 bg-indigo-500/10 rounded-lg px-2.5 py-1.5 transition-colors shrink-0"
                    >
                      View
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Recent Conversations ─────────────────────────────────────────────── */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent Conversations</h3>
            <Link
              href="/conversations"
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              View all <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="divide-y divide-dark-600">
            {recentContacts.length === 0 ? (
              <div className="px-5 py-10 text-center text-gray-600 text-sm">No conversations yet</div>
            ) : (
              recentContacts.map((conv) => {
                const isWeb = conv.source === 'website' || conv.phone?.startsWith('visitor_') || conv.phone?.startsWith('widget_')
                return (
                  <div key={conv.phone} className="flex items-center gap-4 px-5 py-3.5 hover:bg-dark-700/50 transition-colors">
                    {isWeb ? (
                      <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-blue-400" />
                      </div>
                    ) : (
                      <div className={`w-9 h-9 rounded-full ${getAvatarColor(conv.phone)} flex items-center justify-center shrink-0`}>
                        <span className="text-xs font-bold text-white">{getInitials(conv.name, conv.phone)}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-medium text-white truncate">{conv.name ?? formatPhone(conv.phone)}</p>
                        {isWeb && (
                          <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20 font-medium">Web</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{conv.user_message ?? '(voice message)'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <p className="text-xs text-gray-600">{format(parseISO(conv.created_at), 'MMM d, h:mm a')}</p>
                      {conv.is_voice && <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/15 text-green-400 border border-green-500/20">Voice</span>}
                      {conv.needs_human && <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Escalated</span>}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
