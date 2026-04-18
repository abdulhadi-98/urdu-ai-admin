'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Globe,
  Phone,
  User,
  Link as LinkIcon,
  RefreshCw,
  Loader2,
  CheckCircle,
  Clock,
  Search,
  MessageSquare,
  Mic,
  Download,
} from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import { useUser } from '@/lib/user-context'

interface WebLead {
  id: string
  phone: string
  name: string | null
  type: string
  message: string
  status: string
  created_at: string
  metadata: {
    visitorId?: string
    pageUrl?: string
    tenantSlug?: string
    source?: string
  } | null
}

interface LeadConversation {
  id: string
  phone: string
  name: string | null
  visitor_id: string | null
  page_url: string | null
  user_message: string
  ai_response: string
  is_voice: boolean | null
  created_at: string
  sentiment: string | null
}

const STATUS_STYLES: Record<string, string> = {
  pending:      'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20',
  acknowledged: 'bg-blue-500/15 text-blue-400 border border-blue-500/20',
  resolved:     'bg-green-500/15 text-green-400 border border-green-500/20',
}

const SENTIMENT_STYLES: Record<string, string> = {
  positive: 'text-green-400',
  negative:  'text-red-400',
  neutral:   'text-gray-400',
}

export default function WebLeadsPage() {
  const user = useUser()
  const canDownload = user?.role === 'admin' || user?.role === 'super_admin'

  const [leads, setLeads] = useState<WebLead[]>([])
  const [conversations, setConversations] = useState<LeadConversation[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'acknowledged' | 'resolved'>('all')
  const [selected, setSelected] = useState<WebLead | null>(null)
  const [convLoading, setConvLoading] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)

  const handleDownloadCSV = () => {
    const rows = leads.filter(l => l.phone || l.name)
    const csv = [
      'Name,Phone',
      ...rows.map(l => `"${(l.name || '').replace(/"/g, '""')}","${(l.phone || '').replace(/"/g, '""')}"`)
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `web-leads-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const fetchLeads = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('type', 'lead')
        .order('created_at', { ascending: false })
        .limit(200)

      if (error) throw error
      setLeads(data || [])
    } catch (err) {
      console.error('Failed to fetch web leads:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchLeads()
  }

  const fetchConversations = async (lead: WebLead) => {
    setSelected(lead)
    setConvLoading(true)
    try {
      const visitorId = lead.metadata?.visitorId
      const phone = lead.phone

      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('id, phone, name, visitor_id, page_url, user_message, ai_response, is_voice, created_at, sentiment')
        .or(`phone.eq.${phone}${visitorId ? `,visitor_id.eq.${visitorId}` : ''}`)
        .eq('source', 'website')
        .order('created_at', { ascending: true })
        .limit(50)

      if (error) throw error
      setConversations(data || [])
    } catch (err) {
      console.error('Failed to fetch conversations:', err)
    } finally {
      setConvLoading(false)
    }
  }

  const handleResolve = async (lead: WebLead) => {
    setResolving(lead.id)
    try {
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'resolved' })
        .eq('id', lead.id)

      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'resolved' } : l))
      if (selected?.id === lead.id) setSelected({ ...lead, status: 'resolved' })
    } finally {
      setResolving(null)
    }
  }

  const handleAcknowledge = async (lead: WebLead) => {
    setResolving(lead.id)
    try {
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'acknowledged' })
        .eq('id', lead.id)

      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: 'acknowledged' } : l))
      if (selected?.id === lead.id) setSelected({ ...lead, status: 'acknowledged' })
    } finally {
      setResolving(null)
    }
  }

  const filtered = leads.filter(l => {
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      l.phone?.toLowerCase().includes(q) ||
      l.name?.toLowerCase().includes(q) ||
      l.metadata?.pageUrl?.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  const counts = {
    all:          leads.length,
    pending:      leads.filter(l => l.status === 'pending').length,
    acknowledged: leads.filter(l => l.status === 'acknowledged').length,
    resolved:     leads.filter(l => l.status === 'resolved').length,
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden">
        {/* ── Left panel: leads list ── */}
        <div className="w-96 shrink-0 border-r border-dark-600 flex flex-col">

          {/* Toolbar */}
          <div className="px-4 py-3 border-b border-dark-600 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Web Leads</h2>
                <p className="text-xs text-gray-500 mt-0.5">{counts.pending} pending callback{counts.pending !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-1">
                {canDownload && (
                  <button
                    onClick={handleDownloadCSV}
                    title="Download CSV"
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, phone, page…"
                className="w-full bg-dark-700 border border-dark-500 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60"
              />
            </div>

            {/* Status filter tabs */}
            <div className="flex gap-1">
              {(['all', 'pending', 'acknowledged', 'resolved'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`flex-1 px-2 py-1 rounded text-xs font-medium transition-colors capitalize ${
                    statusFilter === s
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {s === 'all' ? `All ${counts.all}` : `${s.slice(0,3)} ${counts[s]}`}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <Globe className="w-8 h-8 text-gray-600 mb-3" />
                <p className="text-sm text-gray-500">No web leads yet</p>
                <p className="text-xs text-gray-600 mt-1">Leads appear when visitors submit the callback form on your widget</p>
              </div>
            ) : (
              filtered.map(lead => (
                <button
                  key={lead.id}
                  onClick={() => fetchConversations(lead)}
                  className={`w-full text-left px-4 py-3.5 border-b border-dark-700 hover:bg-dark-700/50 transition-colors ${
                    selected?.id === lead.id ? 'bg-dark-700/70 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                        <Globe className="w-3.5 h-3.5 text-indigo-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {lead.name || 'Anonymous Visitor'}
                        </p>
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1">
                          <Phone className="w-2.5 h-2.5" />
                          {lead.phone}
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${STATUS_STYLES[lead.status] || STATUS_STYLES.pending}`}>
                      {lead.status}
                    </span>
                  </div>
                  {lead.metadata?.pageUrl && (
                    <p className="text-xs text-gray-600 truncate flex items-center gap-1 mt-1 ml-9">
                      <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                      {lead.metadata.pageUrl.replace(/^https?:\/\//, '')}
                    </p>
                  )}
                  <p className="text-xs text-gray-600 mt-1 ml-9">
                    {format(parseISO(lead.created_at), 'MMM d, h:mm a')}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ── Right panel: detail ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Globe className="w-12 h-12 text-gray-700 mb-4" />
              <p className="text-gray-500 text-sm">Select a lead to view details and conversation</p>
            </div>
          ) : (
            <>
              {/* Lead header */}
              <div className="px-6 py-4 border-b border-dark-600 flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-white flex items-center gap-2">
                      {selected.name || 'Anonymous Visitor'}
                      <span className={`text-xs px-2 py-0.5 rounded ${STATUS_STYLES[selected.status] || STATUS_STYLES.pending}`}>
                        {selected.status}
                      </span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {selected.phone}
                      </span>
                      {selected.metadata?.pageUrl && (
                        <a
                          href={selected.metadata.pageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                        >
                          <LinkIcon className="w-3 h-3" />
                          {selected.metadata.pageUrl.replace(/^https?:\/\//, '')}
                        </a>
                      )}
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(parseISO(selected.created_at), 'MMM d yyyy, h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {selected.status === 'pending' && (
                    <button
                      onClick={() => handleAcknowledge(selected)}
                      disabled={resolving === selected.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 text-xs rounded-lg border border-blue-500/20 transition-colors"
                    >
                      {resolving === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <User className="w-3 h-3" />}
                      Acknowledge
                    </button>
                  )}
                  {selected.status !== 'resolved' && (
                    <button
                      onClick={() => handleResolve(selected)}
                      disabled={resolving === selected.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/15 hover:bg-green-500/25 text-green-400 text-xs rounded-lg border border-green-500/20 transition-colors"
                    >
                      {resolving === selected.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                      Resolve
                    </button>
                  )}
                </div>
              </div>

              {/* Conversation history */}
              <div className="flex-1 overflow-y-auto p-6">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Chat History Before Callback Request
                </h4>

                {convLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" />
                  </div>
                ) : conversations.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-sm text-gray-500">No conversation history found for this visitor</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {conversations.map(msg => (
                      <div key={msg.id} className="bg-dark-800 border border-dark-600 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {msg.is_voice
                              ? <Mic className="w-3.5 h-3.5 text-purple-400" />
                              : <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                            }
                            <span className="text-xs text-gray-500">
                              {msg.is_voice ? 'Voice' : 'Text'} · {format(parseISO(msg.created_at), 'MMM d, h:mm a')}
                            </span>
                            {msg.page_url && (
                              <span className="text-xs text-gray-600 truncate max-w-xs">
                                · {msg.page_url.replace(/^https?:\/\//, '')}
                              </span>
                            )}
                          </div>
                          {msg.sentiment && (
                            <span className={`text-xs capitalize ${SENTIMENT_STYLES[msg.sentiment] || 'text-gray-400'}`}>
                              {msg.sentiment}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <span className="text-xs text-gray-600 w-14 shrink-0 pt-0.5">Visitor</span>
                            <p className="text-sm text-gray-300 flex-1">{msg.user_message}</p>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-xs text-indigo-400 w-14 shrink-0 pt-0.5">Agent</span>
                            <p className="text-sm text-gray-400 flex-1">{msg.ai_response}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
