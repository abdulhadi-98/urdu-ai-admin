'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format, subDays, parseISO, isAfter } from 'date-fns'
import {
  MessageSquare,
  Mic,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  Zap,
  RefreshCw,
} from 'lucide-react'
import { supabaseAdmin, type Conversation } from '@/lib/supabase'
import StatCard from '@/components/StatCard'
import Header from '@/components/layout/Header'
import { getInitials, getAvatarColor, formatPhone } from '@/lib/utils'

const COLORS = {
  messages: '#6366f1',
  voice: '#22c55e',
  escalations: '#f59e0b',
}

export default function DashboardPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setConversations(data ?? [])
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchData()
  }

  // Stats
  const totalMessages = conversations.length
  const voiceMessages = conversations.filter((c) => c.is_voice).length
  const escalations = conversations.filter((c) => c.needs_human).length
  const avgResponseTime = conversations.length
    ? Math.round(
        conversations.filter((c) => c.response_time_ms).reduce((a, c) => a + (c.response_time_ms ?? 0), 0) /
          conversations.filter((c) => c.response_time_ms).length
      )
    : 0

  // 7-day chart data
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i)
    const dayStr = format(date, 'yyyy-MM-dd')
    const dayConvs = conversations.filter((c) => {
      try {
        return format(parseISO(c.created_at), 'yyyy-MM-dd') === dayStr
      } catch {
        return false
      }
    })
    return {
      date: format(date, 'MMM d'),
      messages: dayConvs.length,
      voice: dayConvs.filter((c) => c.is_voice).length,
      escalations: dayConvs.filter((c) => c.needs_human).length,
    }
  })

  // Property interest chart
  const propertyMap: Record<string, number> = {}
  conversations.forEach((c) => {
    if (c.property_interest) {
      propertyMap[c.property_interest] = (propertyMap[c.property_interest] ?? 0) + 1
    }
  })
  const propertyData = Object.entries(propertyMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  // Unique contacts
  const uniquePhones = new Set(conversations.map((c) => c.phone)).size

  // Recent convs (latest per phone)
  const phoneMap: Record<string, Conversation> = {}
  conversations.forEach((c) => {
    if (!phoneMap[c.phone] || c.created_at > phoneMap[c.phone].created_at) {
      phoneMap[c.phone] = c
    }
  })
  const recentContacts = Object.values(phoneMap)
    .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
    .slice(0, 5)

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
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Messages"
            value={totalMessages.toLocaleString()}
            icon={MessageSquare}
            color="indigo"
            subtitle="All time conversations"
          />
          <StatCard
            title="Voice Messages"
            value={voiceMessages.toLocaleString()}
            icon={Mic}
            color="green"
            subtitle={`${totalMessages ? Math.round((voiceMessages / totalMessages) * 100) : 0}% of total`}
          />
          <StatCard
            title="Avg Response Time"
            value={avgResponseTime ? `${(avgResponseTime / 1000).toFixed(1)}s` : 'N/A'}
            icon={Clock}
            color="blue"
            subtitle="AI response latency"
          />
          <StatCard
            title="Escalations"
            value={escalations.toLocaleString()}
            icon={AlertTriangle}
            color="yellow"
            subtitle="Need human review"
          />
        </div>

        {/* Second row stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Unique Contacts"
            value={uniquePhones.toLocaleString()}
            icon={Users}
            color="purple"
            subtitle="Active leads"
          />
          <StatCard
            title="7-Day Messages"
            value={last7Days.reduce((a, d) => a + d.messages, 0).toLocaleString()}
            icon={TrendingUp}
            color="indigo"
            subtitle="Last 7 days"
          />
          <StatCard
            title="Voice Rate"
            value={`${totalMessages ? Math.round((voiceMessages / totalMessages) * 100) : 0}%`}
            icon={Mic}
            color="green"
            subtitle="Voice vs text ratio"
          />
          <StatCard
            title="Escalation Rate"
            value={`${totalMessages ? Math.round((escalations / totalMessages) * 100) : 0}%`}
            icon={Zap}
            color="red"
            subtitle="Needs human"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* 7-day area chart */}
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

          {/* Property interest chart */}
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
              <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">
                No property data yet
              </div>
            )}
          </div>
        </div>

        {/* Recent Conversations */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-dark-600">
            <h3 className="text-sm font-semibold text-white">Recent Conversations</h3>
          </div>
          <div className="divide-y divide-dark-600">
            {recentContacts.length === 0 ? (
              <div className="px-5 py-10 text-center text-gray-600 text-sm">No conversations yet</div>
            ) : (
              recentContacts.map((conv) => (
                <div key={conv.phone} className="flex items-center gap-4 px-5 py-3.5 hover:bg-dark-700/50 transition-colors">
                  <div
                    className={`w-9 h-9 rounded-full ${getAvatarColor(conv.phone)} flex items-center justify-center shrink-0`}
                  >
                    <span className="text-xs font-bold text-white">
                      {getInitials(conv.name, conv.phone)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {conv.name ?? formatPhone(conv.phone)}
                      </p>
                      <p className="text-xs text-gray-500 shrink-0">
                        {format(parseISO(conv.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {conv.user_message ?? '(voice message)'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {conv.is_voice && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-green-500/15 text-green-400 border border-green-500/20">
                        Voice
                      </span>
                    )}
                    {conv.needs_human && (
                      <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
                        Escalated
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
