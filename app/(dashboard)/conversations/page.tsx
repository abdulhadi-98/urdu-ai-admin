'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import {
  Send,
  Mic,
  MicOff,
  Search,
  MessageSquare,
  AlertTriangle,
  Loader2,
  X,
  Globe,
  Phone,
  Link2,
  CheckCircle,
  Wifi,
  WifiOff,
  UserCheck,
  Bot,
  HandMetal,
} from 'lucide-react'
import { supabaseAdmin, type Conversation } from '@/lib/supabase'
import AudioPlayer from '@/components/AudioPlayer'
import Header from '@/components/layout/Header'
import { getInitials, getAvatarColor, formatPhone } from '@/lib/utils'

const API_URL = '/api/backend'

// ── Helpers ───────────────────────────────────────────────────────────────────

type SourceFilter = 'all' | 'whatsapp' | 'website'

/** Returns true if this conversation row came from the website widget */
function isWebSource(c: Conversation) {
  return (
    c.source === 'website' ||
    c.phone?.startsWith('visitor_') ||
    c.phone?.startsWith('widget_')
  )
}

/** Returns true if a website visitor has submitted their real contact info */
function isLinkedLead(c: Conversation) {
  return (
    isWebSource(c) &&
    !!c.name &&
    !!c.phone &&
    !c.phone.startsWith('visitor_') &&
    !c.phone.startsWith('widget_')
  )
}

/** Short display name for a website visitor */
function visitorLabel(c: Conversation) {
  if (c.name) return c.name
  const id = c.visitor_id ?? c.phone ?? ''
  return `Visitor ${id.slice(-6).toUpperCase()}`
}

type ContactThread = {
  phone: string
  name: string | null
  source: 'whatsapp' | 'website'
  visitorId: string | null
  pageUrl: string | null
  isLinkedLead: boolean
  latestMessage: string
  latestTime: string
  hasEscalation: boolean
}

function formatMsgTime(iso: string): string {
  try {
    const date = parseISO(iso)
    if (isToday(date)) return format(date, 'h:mm a')
    if (isYesterday(date)) return 'Yesterday'
    return format(date, 'MMM d')
  } catch {
    return ''
  }
}

function groupByDate(convs: Conversation[]) {
  const map: Record<string, Conversation[]> = {}
  convs.forEach((c) => {
    try {
      const d = parseISO(c.created_at)
      const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMMM d, yyyy')
      ;(map[key] ??= []).push(c)
    } catch {}
  })
  return Object.keys(map)
    .sort((a, b) => (map[a][0]?.created_at ?? '') < (map[b][0]?.created_at ?? '') ? -1 : 1)
    .map((label) => ({ label, messages: map[label] }))
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ConversationsPage() {
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [contacts, setContacts]                 = useState<ContactThread[]>([])
  const [selectedPhone, setSelectedPhone]       = useState<string | null>(null)
  const [thread, setThread]                     = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery]           = useState('')
  const [sourceFilter, setSourceFilter]         = useState<SourceFilter>('all')
  const [replyText, setReplyText]               = useState('')
  const [sending, setSending]                   = useState(false)
  const [sendError, setSendError]               = useState('')
  const [loading, setLoading]                   = useState(true)
  const [recording, setRecording]               = useState(false)
  const [refreshing, setRefreshing]             = useState(false)
  const [sseStatus, setSseStatus]               = useState<'connecting' | 'live' | 'polling'>('connecting')

  // Lead linking
  const [linkingOpen, setLinkingOpen]   = useState(false)
  const [linkPhone, setLinkPhone]       = useState('')
  const [linkName, setLinkName]         = useState('')
  const [linking, setLinking]           = useState(false)
  const [linkSuccess, setLinkSuccess]   = useState(false)

  // Human takeover
  const [pausedPhones, setPausedPhones]     = useState<Set<string>>(new Set())
  const [takeoverLoading, setTakeoverLoading] = useState(false)
  const [takeoverExpiries, setTakeoverExpiries] = useState<Map<string, number>>(new Map())
  const [countdown, setCountdown]           = useState('')
  const takeoverTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const TAKEOVER_INACTIVITY_MS = 5 * 60 * 1000 // 5 minutes

  const chatEndRef       = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef        = useRef<Blob[]>([])

  // ── Build contact list ──────────────────────────────────────────────────────
  const buildContacts = useCallback((convs: Conversation[]): ContactThread[] => {
    const map: Record<string, Conversation[]> = {}
    convs.forEach((c) => {
      // Group website conversations by visitor_id so all messages appear in one thread
      const key = c.visitor_id ?? c.phone
      ;(map[key] ??= []).push(c)
    })

    return Object.entries(map)
      .map(([key, msgs]) => {
        const sorted  = [...msgs].sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
        const latest  = sorted[0]
        const isWeb   = isWebSource(latest)
        return {
          phone:        latest.phone,
          name:         latest.name,
          source:       isWeb ? 'website' : 'whatsapp',
          visitorId:    latest.visitor_id ?? null,
          pageUrl:      latest.page_url ?? null,
          isLinkedLead: isLinkedLead(latest),
          latestMessage: latest.user_message ?? (latest.is_voice ? '🎤 Voice message' : latest.ai_response ?? ''),
          latestTime:   latest.created_at,
          hasEscalation: msgs.some((m) => m.needs_human),
        } as ContactThread
      })
      .sort((a, b) => (b.latestTime > a.latestTime ? 1 : -1))
  }, [])

  // ── Fetch paused phones (human takeover state) ─────────────────────────────
  const fetchPausedPhones = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/conversations/paused`)
      if (res.ok) {
        const data = await res.json()
        setPausedPhones(new Set(data.phones ?? []))
      }
    } catch {}
  }, [])

  // ── Inactivity auto-resume timer ──────────────────────────────────────────
  const startInactivityTimer = useCallback((phone: string) => {
    // Clear any existing timer for this phone
    const existing = takeoverTimersRef.current.get(phone)
    if (existing) clearTimeout(existing)

    const expiry = Date.now() + TAKEOVER_INACTIVITY_MS
    setTakeoverExpiries((prev) => new Map(prev).set(phone, expiry))

    const timer = setTimeout(async () => {
      // Auto-resume AI — capture phone in closure, not from state
      try {
        await fetch(`${API_URL}/api/admin/conversations/${encodeURIComponent(phone)}/pause`, { method: 'DELETE' })
      } catch {}
      setPausedPhones((prev) => { const n = new Set(prev); n.delete(phone); return n })
      setTakeoverExpiries((prev) => { const n = new Map(prev); n.delete(phone); return n })
      takeoverTimersRef.current.delete(phone)
    }, TAKEOVER_INACTIVITY_MS)

    takeoverTimersRef.current.set(phone, timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Human takeover handlers ─────────────────────────────────────────────────
  const handleTakeover = async () => {
    if (!selectedPhone) return
    setTakeoverLoading(true)
    try {
      const res = await fetch(
        `${API_URL}/api/admin/conversations/${encodeURIComponent(selectedPhone)}/pause`,
        { method: 'POST' }
      )
      if (res.ok) {
        setPausedPhones((prev) => new Set(Array.from(prev).concat(selectedPhone)))
        startInactivityTimer(selectedPhone)
      }
    } catch {
      setSendError('Failed to activate takeover.')
    } finally {
      setTakeoverLoading(false)
    }
  }

  const handleResumeAI = async () => {
    if (!selectedPhone) return
    setTakeoverLoading(true)
    try {
      const res = await fetch(
        `${API_URL}/api/admin/conversations/${encodeURIComponent(selectedPhone)}/pause`,
        { method: 'DELETE' }
      )
      if (res.ok) {
        // Clear inactivity timer
        const t = takeoverTimersRef.current.get(selectedPhone)
        if (t) clearTimeout(t)
        takeoverTimersRef.current.delete(selectedPhone)
        setTakeoverExpiries((prev) => { const n = new Map(prev); n.delete(selectedPhone); return n })
        setPausedPhones((prev) => {
          const next = new Set(prev)
          next.delete(selectedPhone)
          return next
        })
      }
    } catch {
      setSendError('Failed to resume AI.')
    } finally {
      setTakeoverLoading(false)
    }
  }

  // ── Fetch all conversations ─────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('conversations')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      const convs = data ?? []
      setAllConversations(convs)
      setContacts(buildContacts(convs))
    } catch (err) {
      console.error('fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [buildContacts])

  // ── Initial load + polling fallback ────────────────────────────────────────
  useEffect(() => {
    fetchConversations()
    fetchPausedPhones()
    const interval = setInterval(() => { fetchConversations(); fetchPausedPhones() }, 8_000)
    return () => clearInterval(interval)
  }, [fetchConversations, fetchPausedPhones])

  // ── SSE realtime ───────────────────────────────────────────────────────────
  useEffect(() => {
    let es: EventSource | null = null

    const connect = () => {
      try {
        es = new EventSource('/api/conversations/stream')

        es.onopen = () => setSseStatus('connecting')

        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data)

            if (data._type === 'connected') {
              setSseStatus('live')
              return
            }
            if (data._type === 'error') {
              setSseStatus('polling')
              es?.close()
              return
            }

            // New conversation row arrived — merge it in without a full re-fetch
            const newConv = data as Conversation
            setAllConversations((prev) => {
              if (prev.some((c) => c.id === newConv.id)) return prev
              const next = [...prev, newConv]
              setContacts(buildContacts(next))
              return next
            })
          } catch {}
        }

        es.onerror = () => {
          setSseStatus('polling')
          es?.close()
        }
      } catch {
        setSseStatus('polling')
      }
    }

    connect()
    return () => es?.close()
  }, [buildContacts])

  // ── Build thread when selected phone changes ────────────────────────────────
  useEffect(() => {
    if (!selectedPhone) return
    const contact = contacts.find((c) => c.phone === selectedPhone)
    const msgs = allConversations
      .filter((c) =>
        contact?.visitorId
          ? (c.visitor_id === contact.visitorId || c.phone === selectedPhone)
          : c.phone === selectedPhone
      )
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    setThread(msgs)
  }, [selectedPhone, allConversations, contacts])

  // ── Auto-scroll ─────────────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  // ── Countdown ticker for takeover inactivity ────────────────────────────────
  useEffect(() => {
    if (!selectedPhone) { setCountdown(''); return }
    const expiry = takeoverExpiries.get(selectedPhone)
    if (!expiry) { setCountdown(''); return }
    const update = () => {
      const ms = expiry - Date.now()
      if (ms <= 0) { setCountdown(''); return }
      const mins = Math.floor(ms / 60000)
      const secs = Math.floor((ms % 60000) / 1000)
      setCountdown(`${mins}:${secs.toString().padStart(2, '0')}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [selectedPhone, takeoverExpiries])

  // ── Filter contacts ─────────────────────────────────────────────────────────
  const filteredContacts = contacts.filter((c) => {
    const matchesSource =
      sourceFilter === 'all' ||
      (sourceFilter === 'website' && c.source === 'website') ||
      (sourceFilter === 'whatsapp' && c.source === 'whatsapp')

    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      c.phone.toLowerCase().includes(q) ||
      (c.name ?? '').toLowerCase().includes(q) ||
      (c.pageUrl ?? '').toLowerCase().includes(q) ||
      c.latestMessage.toLowerCase().includes(q)

    return matchesSource && matchesSearch
  })

  const whatsappCount = contacts.filter((c) => c.source === 'whatsapp').length
  const websiteCount  = contacts.filter((c) => c.source === 'website').length

  // ── Send / record ───────────────────────────────────────────────────────────
  const sendTextMessage = async () => {
    if (!replyText.trim() || !selectedPhone) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`${API_URL}/api/admin/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedPhone, text: replyText.trim() }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setReplyText('')
      // Reset inactivity timer on each admin message sent
      if (selectedPhone && pausedPhones.has(selectedPhone)) startInactivityTimer(selectedPhone)
      setTimeout(fetchConversations, 800)
    } catch {
      setSendError('Failed to send message. Check API connection.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendTextMessage()
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())
        await sendVoiceNote(blob)
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      setSendError('Microphone access denied')
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setRecording(false)
  }

  const sendVoiceNote = async (blob: Blob) => {
    if (!selectedPhone) return
    setSending(true)
    setSendError('')
    try {
      const fd = new FormData()
      fd.append('audio', blob, 'voice.webm')
      fd.append('phone', selectedPhone)
      const res = await fetch(`${API_URL}/api/admin/send-voice`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      // Reset inactivity timer on each admin voice note sent
      if (selectedPhone && pausedPhones.has(selectedPhone)) startInactivityTimer(selectedPhone)
      setTimeout(fetchConversations, 1_000)
    } catch {
      setSendError('Failed to send voice note.')
    } finally {
      setSending(false)
    }
  }

  // ── Lead linking ────────────────────────────────────────────────────────────
  const handleLinkVisitor = async () => {
    if (!linkPhone.trim() || !selectedContact) return
    setLinking(true)
    try {
      const visitorKey = selectedContact.visitorId ?? selectedContact.phone
      // Update all rows for this visitor to carry the real phone + name
      const updatePayload: Record<string, string> = { phone: linkPhone.trim() }
      if (linkName.trim()) updatePayload.name = linkName.trim()

      const { error } = await supabaseAdmin
        .from('conversations')
        .update(updatePayload)
        .or(
          `visitor_id.eq.${visitorKey},phone.eq.${selectedContact.phone}`
        )

      if (error) throw error

      setLinkSuccess(true)
      setTimeout(() => {
        setLinkSuccess(false)
        setLinkingOpen(false)
        setLinkPhone('')
        setLinkName('')
        fetchConversations()
      }, 1_500)
    } catch {
      setSendError('Failed to link visitor. Check Supabase permissions.')
    } finally {
      setLinking(false)
    }
  }

  const handleRefresh = () => { setRefreshing(true); fetchConversations() }

  const selectedContact = contacts.find((c) => c.phone === selectedPhone)
  const selectedIsWeb   = selectedContact?.source === 'website'
  const isAIPaused      = selectedPhone ? pausedPhones.has(selectedPhone) : false
  const grouped         = groupByDate(thread)

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header onRefresh={handleRefresh} refreshing={refreshing} />

      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: contact list ───────────────────────────────────────────── */}
        <div className="w-80 shrink-0 border-r border-dark-600 flex flex-col bg-dark-800">

          {/* Search */}
          <div className="p-3 pb-0 border-b border-dark-600">
            <div className="relative mb-2.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search contacts…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* Source filter tabs */}
            <div className="flex">
              {([
                { id: 'all',       label: `All (${contacts.length})` },
                { id: 'whatsapp',  label: `WhatsApp (${whatsappCount})` },
                { id: 'website',   label: `Website (${websiteCount})` },
              ] as const).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setSourceFilter(id)}
                  className={`flex-1 py-2 text-xs font-medium border-b-2 transition-colors ${
                    sourceFilter === id
                      ? 'border-indigo-500 text-white'
                      : 'border-transparent text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* SSE status */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] ${
            sseStatus === 'live'     ? 'bg-green-500/10 text-green-400' :
            sseStatus === 'polling' ? 'bg-gray-500/10 text-gray-500' :
                                      'bg-indigo-500/10 text-indigo-400'
          }`}>
            {sseStatus === 'live' ? (
              <><Wifi className="w-3 h-3" /> Live updates active</>
            ) : sseStatus === 'polling' ? (
              <><WifiOff className="w-3 h-3" /> Polling every 8 s</>
            ) : (
              <><Loader2 className="w-3 h-3 animate-spin" /> Connecting to realtime…</>
            )}
          </div>

          {/* Contacts */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm gap-2">
                <MessageSquare className="w-8 h-8 opacity-30" />
                <p>No conversations</p>
              </div>
            ) : (
              filteredContacts.map((contact) => {
                const isWeb = contact.source === 'website'
                const displayName = isWeb
                  ? (contact.name ?? `Visitor ${(contact.visitorId ?? contact.phone).slice(-6).toUpperCase()}`)
                  : (contact.name ?? formatPhone(contact.phone))

                return (
                  <button
                    key={contact.phone}
                    onClick={() => setSelectedPhone(contact.phone)}
                    className={`w-full flex items-center gap-3 px-3 py-3 border-b border-dark-600/50 hover:bg-dark-700/60 transition-colors text-left ${
                      selectedPhone === contact.phone
                        ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                        : ''
                    }`}
                  >
                    {/* Avatar */}
                    {isWeb ? (
                      <div className="w-10 h-10 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                        <Globe className="w-4 h-4 text-blue-400" />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 rounded-full ${getAvatarColor(contact.phone)} flex items-center justify-center shrink-0`}>
                        <span className="text-xs font-bold text-white">
                          {getInitials(contact.name, contact.phone)}
                        </span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{displayName}</p>
                          {isWeb && (
                            <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${
                              contact.isLinkedLead
                                ? 'bg-green-500/15 text-green-400 border-green-500/20'
                                : 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                            }`}>
                              {contact.isLinkedLead ? 'Lead' : 'Web'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 shrink-0">
                          {formatMsgTime(contact.latestTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        {contact.hasEscalation && (
                          <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                        )}
                        <p className="text-xs text-gray-500 truncate">
                          {isWeb && contact.pageUrl
                            ? contact.pageUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
                            : contact.latestMessage}
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Right: chat panel ────────────────────────────────────────────── */}
        {!selectedPhone ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-dark-900 text-gray-600">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs mt-1">Choose a contact from the left panel</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-dark-900">

            {/* Chat header */}
            <div className="bg-dark-800 border-b border-dark-600 shrink-0">
              <div className="flex items-center gap-3 px-5 py-3">
                {selectedIsWeb ? (
                  <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-blue-400" />
                  </div>
                ) : (
                  <div className={`w-9 h-9 rounded-full ${getAvatarColor(selectedPhone)} flex items-center justify-center shrink-0`}>
                    <span className="text-xs font-bold text-white">
                      {getInitials(selectedContact?.name ?? null, selectedPhone)}
                    </span>
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-white">
                      {selectedIsWeb
                        ? (selectedContact?.name ?? `Visitor ${(selectedContact?.visitorId ?? selectedPhone).slice(-6).toUpperCase()}`)
                        : (selectedContact?.name ?? formatPhone(selectedPhone))}
                    </p>

                    {selectedIsWeb && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${
                        selectedContact?.isLinkedLead
                          ? 'bg-green-500/15 text-green-400 border-green-500/20'
                          : 'bg-blue-500/15 text-blue-400 border-blue-500/20'
                      }`}>
                        {selectedContact?.isLinkedLead ? 'Linked Lead' : 'Website Visitor'}
                      </span>
                    )}

                    {selectedContact?.hasEscalation && (
                      <span className="flex items-center gap-1 text-[10px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2 py-0.5">
                        <AlertTriangle className="w-3 h-3" />
                        Escalated
                      </span>
                    )}

                    {/* Human takeover status badge */}
                    {isAIPaused && (
                      <span className="flex items-center gap-1 text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                        <UserCheck className="w-3 h-3" />
                        Human handling
                        {countdown && <span className="ml-1 font-mono">{countdown}</span>}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-0.5">
                    {selectedIsWeb ? (
                      <>
                        {selectedContact?.visitorId && (
                          <span className="text-xs text-gray-500 font-mono">
                            ID: {selectedContact.visitorId.slice(-12)}
                          </span>
                        )}
                        {selectedContact?.pageUrl && (
                          <a
                            href={selectedContact.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition-colors"
                          >
                            <Globe className="w-3 h-3" />
                            {selectedContact.pageUrl.replace(/^https?:\/\//, '').slice(0, 50)}
                          </a>
                        )}
                        {selectedContact?.isLinkedLead && selectedContact.phone && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {formatPhone(selectedContact.phone)}
                          </span>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-gray-500">{formatPhone(selectedPhone)}</p>
                    )}
                  </div>
                </div>

                {/* Link visitor button — shown for anonymous website visitors only */}
                {selectedIsWeb && !selectedContact?.isLinkedLead && (
                  <button
                    onClick={() => { setLinkingOpen(!linkingOpen); setLinkSuccess(false) }}
                    className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/10 rounded-lg px-3 py-1.5 transition-colors shrink-0"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Link to Lead
                  </button>
                )}

                {/* Human takeover button — all conversations */}
                {isAIPaused ? (
                  <button
                    onClick={handleResumeAI}
                    disabled={takeoverLoading}
                    title="Resume AI — hand the conversation back to the bot"
                    className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 border border-green-500/30 hover:border-green-500/60 bg-green-500/10 rounded-lg px-3 py-1.5 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {takeoverLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
                    Resume AI
                  </button>
                ) : (
                  <button
                    onClick={handleTakeover}
                    disabled={takeoverLoading}
                    title="Take Over — pause AI and handle this conversation manually"
                    className="flex items-center gap-1.5 text-xs text-yellow-400 hover:text-yellow-300 border border-yellow-500/30 hover:border-yellow-500/60 bg-yellow-500/10 rounded-lg px-3 py-1.5 transition-colors shrink-0 disabled:opacity-50"
                  >
                    {takeoverLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <HandMetal className="w-3.5 h-3.5" />}
                    Take Over
                  </button>
                )}
              </div>

              {/* Link visitor panel */}
              {linkingOpen && selectedIsWeb && !selectedContact?.isLinkedLead && (
                <div className="px-5 pb-4 border-t border-dark-600/50 pt-3">
                  <p className="text-xs text-gray-500 mb-2">
                    Link this visitor to a lead — updates all their conversation records.
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Real name (optional)"
                      value={linkName}
                      onChange={(e) => setLinkName(e.target.value)}
                      className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60"
                    />
                    <input
                      type="text"
                      placeholder="Phone number"
                      value={linkPhone}
                      onChange={(e) => setLinkPhone(e.target.value)}
                      className="flex-1 bg-dark-700 border border-dark-500 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500/60"
                    />
                    <button
                      onClick={handleLinkVisitor}
                      disabled={!linkPhone.trim() || linking}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm rounded-lg transition-colors shrink-0"
                    >
                      {linkSuccess ? (
                        <><CheckCircle className="w-3.5 h-3.5" /> Linked!</>
                      ) : linking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <><Link2 className="w-3.5 h-3.5" /> Link</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {grouped.map(({ label, messages }) => (
                <div key={label}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-dark-600" />
                    <span className="text-xs text-gray-500 bg-dark-800 px-2 py-0.5 rounded-full border border-dark-600">
                      {label}
                    </span>
                    <div className="flex-1 h-px bg-dark-600" />
                  </div>

                  <div className="space-y-3">
                    {messages.map((msg) => (
                      <div key={msg.id} className="space-y-2">

                        {/* ── User / visitor message — left ── */}
                        {(msg.user_message || (msg.is_voice && !msg.is_admin)) && !msg.is_admin && (
                          <div className="flex items-end gap-2 justify-start">
                            {isWebSource(msg) ? (
                              <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
                                <Globe className="w-3.5 h-3.5 text-blue-400" />
                              </div>
                            ) : (
                              <div className={`w-7 h-7 rounded-full ${getAvatarColor(msg.phone)} flex items-center justify-center shrink-0`}>
                                <span className="text-xs font-bold text-white">
                                  {getInitials(msg.name, msg.phone)}
                                </span>
                              </div>
                            )}
                            <div className="max-w-[65%]">
                              {msg.is_voice && msg.voice_note_url ? (
                                <AudioPlayer src={msg.voice_note_url} text={msg.user_message ?? undefined} transcription={msg.user_message ?? undefined} className="min-w-[250px]" />
                              ) : msg.is_voice ? (
                                <AudioPlayer text={msg.user_message ?? 'Voice message'} transcription={msg.user_message ?? undefined} className="min-w-[250px]" />
                              ) : (
                                <div className="bg-dark-700 border border-dark-500 rounded-2xl rounded-bl-sm px-4 py-2.5">
                                  <p className="text-sm text-white leading-relaxed" dir="auto">{msg.user_message}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-2 mt-1 ml-1">
                                {isWebSource(msg) && msg.page_url && (
                                  <span className="text-[10px] text-blue-400/70 truncate max-w-[180px]">
                                    {msg.page_url.replace(/^https?:\/\//, '')}
                                  </span>
                                )}
                                <p className="text-xs text-gray-600">{format(parseISO(msg.created_at), 'h:mm a')}</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── Admin / human agent message — right (indigo) ── */}
                        {msg.is_admin && (msg.ai_response || msg.ai_voice_note_url) && (
                          <div className="flex items-end gap-2 justify-end">
                            <div className="max-w-[65%]">
                              {msg.ai_voice_note_url ? (
                                <AudioPlayer src={msg.ai_voice_note_url} text={msg.ai_response ?? 'Voice note'} transcription={msg.ai_response ?? undefined} className="min-w-[250px]" />
                              ) : (
                                <div className="bg-indigo-500/15 border border-indigo-500/30 rounded-2xl rounded-br-sm px-4 py-2.5">
                                  <p className="text-sm text-indigo-100 leading-relaxed" dir="auto">{msg.ai_response}</p>
                                </div>
                              )}
                              <div className="flex items-center justify-end gap-1.5 mt-1 mr-1">
                                <span className="text-xs text-indigo-500/70">Human Agent</span>
                                <p className="text-xs text-gray-600">{format(parseISO(msg.created_at), 'h:mm a')}</p>
                              </div>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
                            </div>
                          </div>
                        )}

                        {/* ── AI response — right (green) ── */}
                        {!msg.is_admin && (msg.ai_response || msg.ai_voice_note_url) && (
                          <div className="flex items-end gap-2 justify-end">
                            <div className="max-w-[65%]">
                              {msg.ai_voice_note_url ? (
                                <AudioPlayer src={msg.ai_voice_note_url} text={msg.ai_response ?? 'Voice response'} transcription={msg.ai_response ?? undefined} className="min-w-[250px]" />
                              ) : (
                                <div className="bg-[#1a2a1a] border border-green-800/40 rounded-2xl rounded-br-sm px-4 py-2.5">
                                  <p className="text-sm text-green-100 leading-relaxed" dir="auto">{msg.ai_response}</p>
                                </div>
                              )}
                              <div className="flex items-center justify-end gap-1.5 mt-1 mr-1">
                                {msg.model && <span className="text-xs text-gray-600">{msg.model}</span>}
                                {msg.response_time_ms && (
                                  <span className="text-xs text-gray-600">{(msg.response_time_ms / 1000).toFixed(1)}s</span>
                                )}
                                <p className="text-xs text-gray-600">{format(parseISO(msg.created_at), 'h:mm a')}</p>
                              </div>
                            </div>
                            <div className="w-7 h-7 rounded-full bg-green-800/40 border border-green-700/30 flex items-center justify-center shrink-0">
                              <span className="text-xs">🤖</span>
                            </div>
                          </div>
                        )}

                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Reply bar */}
            <div className="border-t border-dark-600 bg-dark-800 px-4 py-3 shrink-0">
              {sendError && (
                <div className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-2">
                  <p className="text-xs text-red-400">{sendError}</p>
                  <button onClick={() => setSendError('')}>
                    <X className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              )}

              {/* Takeover status banners */}
              {isAIPaused ? (
                <div className="flex items-center gap-1.5 mb-2 text-xs text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-3 py-2">
                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="flex-1">
                    You are in control — AI is paused. Click <strong>Resume AI</strong> when done.
                  </span>
                  {countdown && (
                    <span className="shrink-0 font-mono text-orange-300 text-[11px]">
                      AI resumes in {countdown}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-2 text-xs text-gray-500 bg-dark-700/60 border border-dark-600 rounded-lg px-3 py-2">
                  <Bot className="w-3.5 h-3.5 shrink-0 text-gray-600" />
                  <span>AI is handling this conversation. Press <strong className="text-gray-400">Take Over</strong> to reply manually.</span>
                </div>
              )}

              <div className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isAIPaused ? 'Type a message… (Enter to send)' : 'Take over to type…'}
                  disabled={!isAIPaused}
                  rows={1}
                  className={`flex-1 border rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none max-h-32 transition-colors ${
                    isAIPaused
                      ? 'bg-dark-700 border-dark-600 text-white placeholder-gray-600 focus:border-indigo-500'
                      : 'bg-dark-800 border-dark-700 text-gray-700 placeholder-gray-700 cursor-not-allowed'
                  }`}
                  style={{ minHeight: '42px' }}
                />
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={sending || !isAIPaused}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                    recording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : isAIPaused
                        ? 'bg-dark-700 hover:bg-dark-600 border border-dark-500'
                        : 'bg-dark-800 border border-dark-700 cursor-not-allowed opacity-40'
                  }`}
                  title={!isAIPaused ? 'Take over to record' : recording ? 'Stop recording' : 'Record voice note'}
                >
                  {recording ? <MicOff className="w-4 h-4 text-white" /> : <Mic className="w-4 h-4 text-gray-400" />}
                </button>
                <button
                  onClick={sendTextMessage}
                  disabled={sending || !replyText.trim() || !isAIPaused}
                  className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
                >
                  {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
