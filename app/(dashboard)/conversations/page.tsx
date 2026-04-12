'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { format, parseISO, isToday, isYesterday } from 'date-fns'
import {
  Send,
  Mic,
  MicOff,
  Search,
  Phone,
  MessageSquare,
  Volume2,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react'
import { supabaseAdmin, type Conversation } from '@/lib/supabase'
import AudioPlayer from '@/components/AudioPlayer'
import Header from '@/components/layout/Header'
import { getInitials, getAvatarColor, formatPhone } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

type ContactThread = {
  phone: string
  name: string | null
  latestMessage: string
  latestTime: string
  unreadCount: number
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

function groupConversationsByDate(convs: Conversation[]) {
  const groups: { label: string; messages: Conversation[] }[] = []
  const map: Record<string, Conversation[]> = {}

  convs.forEach((c) => {
    try {
      const date = parseISO(c.created_at)
      let key: string
      if (isToday(date)) key = 'Today'
      else if (isYesterday(date)) key = 'Yesterday'
      else key = format(date, 'MMMM d, yyyy')

      if (!map[key]) map[key] = []
      map[key].push(c)
    } catch {}
  })

  // Sort groups chronologically
  const orderedKeys = Object.keys(map).sort((a, b) => {
    const first = map[a][0]?.created_at ?? ''
    const last = map[b][0]?.created_at ?? ''
    return first < last ? -1 : 1
  })

  orderedKeys.forEach((key) => {
    groups.push({ label: key, messages: map[key] })
  })

  return groups
}

export default function ConversationsPage() {
  const [allConversations, setAllConversations] = useState<Conversation[]>([])
  const [contacts, setContacts] = useState<ContactThread[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null)
  const [thread, setThread] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [loading, setLoading] = useState(true)
  const [recording, setRecording] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const buildContacts = useCallback((convs: Conversation[]): ContactThread[] => {
    const phoneMap: Record<string, Conversation[]> = {}
    convs.forEach((c) => {
      if (!phoneMap[c.phone]) phoneMap[c.phone] = []
      phoneMap[c.phone].push(c)
    })

    return Object.entries(phoneMap)
      .map(([phone, msgs]) => {
        const sorted = [...msgs].sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
        const latest = sorted[0]
        return {
          phone,
          name: latest.name ?? null,
          latestMessage: latest.user_message ?? (latest.is_voice ? '🎤 Voice message' : latest.ai_response ?? ''),
          latestTime: latest.created_at,
          unreadCount: 0,
          hasEscalation: msgs.some((m) => m.needs_human),
        }
      })
      .sort((a, b) => (b.latestTime > a.latestTime ? 1 : -1))
  }, [])

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

  useEffect(() => {
    fetchConversations()

    // Realtime subscription
    const channel = supabaseAdmin
      .channel('conversations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        fetchConversations()
      })
      .subscribe()

    return () => {
      supabaseAdmin.removeChannel(channel)
    }
  }, [fetchConversations])

  // Build thread when selectedPhone changes
  useEffect(() => {
    if (!selectedPhone) return
    const msgs = allConversations
      .filter((c) => c.phone === selectedPhone)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    setThread(msgs)
  }, [selectedPhone, allConversations])

  // Scroll to bottom when thread updates
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [thread])

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.toLowerCase()
    return (
      c.phone.includes(q) ||
      (c.name ?? '').toLowerCase().includes(q) ||
      c.latestMessage.toLowerCase().includes(q)
    )
  })

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
      // Refresh thread
      setTimeout(() => fetchConversations(), 800)
    } catch (err) {
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
      const formData = new FormData()
      formData.append('audio', blob, 'voice.webm')
      formData.append('phone', selectedPhone)
      const res = await fetch(`${API_URL}/api/admin/send-voice`, {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTimeout(() => fetchConversations(), 1000)
    } catch {
      setSendError('Failed to send voice note.')
    } finally {
      setSending(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchConversations()
  }

  const selectedContact = contacts.find((c) => c.phone === selectedPhone)
  const grouped = groupConversationsByDate(thread)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header onRefresh={handleRefresh} refreshing={refreshing} />

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Contact list */}
        <div className="w-80 shrink-0 border-r border-dark-600 flex flex-col bg-dark-800">
          {/* Search */}
          <div className="p-3 border-b border-dark-600">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Contact list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            ) : filteredContacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-gray-600 text-sm">
                <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
                <p>No conversations yet</p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact.phone}
                  onClick={() => setSelectedPhone(contact.phone)}
                  className={`w-full flex items-center gap-3 px-3 py-3 border-b border-dark-600/50 hover:bg-dark-700/60 transition-colors text-left ${
                    selectedPhone === contact.phone ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full ${getAvatarColor(contact.phone)} flex items-center justify-center shrink-0`}
                  >
                    <span className="text-xs font-bold text-white">
                      {getInitials(contact.name, contact.phone)}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-medium text-white truncate">
                        {contact.name ?? formatPhone(contact.phone)}
                      </p>
                      <p className="text-xs text-gray-500 shrink-0">
                        {formatMsgTime(contact.latestTime)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      {contact.hasEscalation && (
                        <AlertTriangle className="w-3 h-3 text-yellow-400 shrink-0" />
                      )}
                      <p className="text-xs text-gray-500 truncate">{contact.latestMessage}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Chat panel */}
        {!selectedPhone ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-dark-900 text-gray-600">
            <MessageSquare className="w-12 h-12 mb-3 opacity-20" />
            <p className="text-sm font-medium">Select a conversation</p>
            <p className="text-xs mt-1">Choose a contact from the left panel</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-dark-900">
            {/* Chat header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-dark-800 border-b border-dark-600 shrink-0">
              <div
                className={`w-9 h-9 rounded-full ${getAvatarColor(selectedPhone)} flex items-center justify-center`}
              >
                <span className="text-xs font-bold text-white">
                  {getInitials(selectedContact?.name ?? null, selectedPhone)}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {selectedContact?.name ?? formatPhone(selectedPhone)}
                </p>
                <p className="text-xs text-gray-500">{formatPhone(selectedPhone)}</p>
              </div>
              {selectedContact?.hasEscalation && (
                <span className="ml-auto flex items-center gap-1 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-full px-2.5 py-1">
                  <AlertTriangle className="w-3 h-3" />
                  Escalated
                </span>
              )}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {grouped.map(({ label, messages }) => (
                <div key={label}>
                  {/* Date divider */}
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
                        {/* User message - left */}
                        {(msg.user_message || msg.is_voice) && !msg.is_admin && (
                          <div className="flex items-end gap-2 justify-start">
                            <div
                              className={`w-7 h-7 rounded-full ${getAvatarColor(msg.phone)} flex items-center justify-center shrink-0`}
                            >
                              <span className="text-xs font-bold text-white">
                                {getInitials(msg.name, msg.phone)}
                              </span>
                            </div>
                            <div className="max-w-[65%]">
                              {msg.is_voice && msg.voice_note_url ? (
                                <AudioPlayer
                                  src={msg.voice_note_url}
                                  text={msg.user_message ?? undefined}
                                  transcription={msg.user_message}
                                  className="min-w-[250px]"
                                />
                              ) : msg.is_voice ? (
                                <AudioPlayer
                                  text={msg.user_message ?? 'Voice message'}
                                  transcription={msg.user_message}
                                  className="min-w-[250px]"
                                />
                              ) : (
                                <div className="bg-dark-700 border border-dark-500 rounded-2xl rounded-bl-sm px-4 py-2.5">
                                  <p className="text-sm text-white leading-relaxed" dir="auto">
                                    {msg.user_message}
                                  </p>
                                </div>
                              )}
                              <p className="text-xs text-gray-600 mt-1 ml-1">
                                {format(parseISO(msg.created_at), 'h:mm a')}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* AI response - right */}
                        {msg.ai_response && (
                          <div className="flex items-end gap-2 justify-end">
                            <div className="max-w-[65%]">
                              {msg.ai_voice_note_url ? (
                                <AudioPlayer
                                  src={msg.ai_voice_note_url}
                                  text={msg.ai_response}
                                  transcription={msg.ai_response}
                                  className="min-w-[250px]"
                                />
                              ) : (
                                <div className="bg-[#1a2a1a] border border-green-800/40 rounded-2xl rounded-br-sm px-4 py-2.5">
                                  <p className="text-sm text-green-100 leading-relaxed" dir="auto">
                                    {msg.ai_response}
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center justify-end gap-1.5 mt-1 mr-1">
                                {msg.model && (
                                  <span className="text-xs text-gray-600">{msg.model}</span>
                                )}
                                {msg.response_time_ms && (
                                  <span className="text-xs text-gray-600">
                                    {(msg.response_time_ms / 1000).toFixed(1)}s
                                  </span>
                                )}
                                <p className="text-xs text-gray-600">
                                  {format(parseISO(msg.created_at), 'h:mm a')}
                                </p>
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
              <div className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send)"
                  rows={1}
                  className="flex-1 bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:border-indigo-500 max-h-32"
                  style={{ minHeight: '42px' }}
                />
                <button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={sending}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors shrink-0 ${
                    recording
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-dark-700 hover:bg-dark-600 border border-dark-500'
                  }`}
                  title={recording ? 'Stop recording' : 'Record voice note'}
                >
                  {recording ? (
                    <MicOff className="w-4 h-4 text-white" />
                  ) : (
                    <Mic className="w-4 h-4 text-gray-400" />
                  )}
                </button>
                <button
                  onClick={sendTextMessage}
                  disabled={sending || !replyText.trim()}
                  className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
