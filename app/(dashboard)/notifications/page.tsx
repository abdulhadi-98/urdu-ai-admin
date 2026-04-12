'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { format, parseISO } from 'date-fns'
import {
  Bell,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Phone,
  RefreshCw,
  Loader2,
  Filter,
  BellOff,
} from 'lucide-react'
import { supabaseAdmin, type Notification } from '@/lib/supabase'
import Header from '@/components/layout/Header'
import { formatPhone } from '@/lib/utils'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  high: { label: 'High', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20' },
  normal: { label: 'Normal', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  low: { label: 'Low', color: 'bg-gray-500/15 text-gray-400 border-gray-500/20' },
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'text-yellow-400' },
  acknowledged: { label: 'Acknowledged', color: 'text-blue-400' },
  resolved: { label: 'Resolved', color: 'text-green-400' },
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread' | 'pending'>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setNotifications(data ?? [])
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Poll every 8 seconds (realtime WebSocket unavailable — Supabase is HTTP-only)
    const interval = setInterval(fetchNotifications, 8000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  const handleAcknowledge = async (id: string) => {
    setActionLoading(id + '-ack')
    try {
      const res = await fetch(`${API_URL}/api/admin/notifications/${id}/acknowledge`, {
        method: 'PATCH',
      })
      if (!res.ok) throw new Error()
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'acknowledged', is_read: true } : n))
      )
    } catch {
      // Fallback: update directly in Supabase
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'acknowledged', is_read: true })
        .eq('id', id)
      fetchNotifications()
    } finally {
      setActionLoading(null)
    }
  }

  const handleResolve = async (id: string) => {
    setActionLoading(id + '-resolve')
    try {
      const res = await fetch(`${API_URL}/api/admin/notifications/${id}/resolve`, {
        method: 'PATCH',
      })
      if (!res.ok) throw new Error()
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'resolved', is_read: true } : n))
      )
    } catch {
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'resolved', is_read: true })
        .eq('id', id)
      fetchNotifications()
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    setActionLoading(id + '-delete')
    try {
      await supabaseAdmin.from('notifications').delete().eq('id', id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      console.error('Delete failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleMarkAllRead = async () => {
    const unread = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (!unread.length) return
    await supabaseAdmin.from('notifications').update({ is_read: true }).in('id', unread)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
  }

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'pending') return n.status === 'pending'
    return true
  })

  const unreadCount = notifications.filter((n) => !n.is_read).length
  const pendingCount = notifications.filter((n) => n.status === 'pending').length

  const handleRefresh = () => {
    setRefreshing(true)
    fetchNotifications()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header onRefresh={handleRefresh} refreshing={refreshing} />

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters bar */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-gray-400 hover:text-white border border-transparent hover:border-dark-500'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                  : 'text-gray-400 hover:text-white border border-transparent hover:border-dark-500'
              }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === 'pending'
                  ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/20'
                  : 'text-gray-400 hover:text-white border border-transparent hover:border-dark-500'
              }`}
            >
              Pending ({pendingCount})
            </button>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600">
            <BellOff className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No notifications</p>
            <p className="text-xs mt-1">
              {filter !== 'all' ? `No ${filter} notifications` : 'You are all caught up!'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((notif) => {
              const priorityCfg = PRIORITY_CONFIG[notif.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.normal
              const statusCfg = STATUS_CONFIG[notif.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending

              return (
                <div
                  key={notif.id}
                  className={`bg-dark-800 border rounded-xl p-4 transition-colors ${
                    !notif.is_read
                      ? 'border-indigo-500/30 shadow-indigo-500/5 shadow-sm'
                      : 'border-dark-600'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Icon */}
                    <div
                      className={`mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        notif.priority === 'urgent'
                          ? 'bg-red-500/15 border border-red-500/20'
                          : notif.priority === 'high'
                          ? 'bg-orange-500/15 border border-orange-500/20'
                          : 'bg-blue-500/15 border border-blue-500/20'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-4 h-4 ${
                          notif.priority === 'urgent'
                            ? 'text-red-400'
                            : notif.priority === 'high'
                            ? 'text-orange-400'
                            : 'text-blue-400'
                        }`}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${priorityCfg.color}`}>
                          {priorityCfg.label}
                        </span>
                        <span className={`text-xs font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        {!notif.is_read && (
                          <span className="w-2 h-2 rounded-full bg-indigo-400" title="Unread" />
                        )}
                        <span className="text-xs text-gray-600 ml-auto">
                          {format(parseISO(notif.created_at), 'MMM d, h:mm a')}
                        </span>
                      </div>

                      <p className="text-sm font-medium text-white mb-1">{notif.message}</p>

                      {notif.escalation_reason && (
                        <p className="text-xs text-gray-400 mb-1">
                          Reason: {notif.escalation_reason}
                        </p>
                      )}

                      {notif.phone && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="w-3 h-3" />
                          <span>{formatPhone(notif.phone)}</span>
                          {notif.name && <span>· {notif.name}</span>}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {notif.status === 'pending' && (
                        <button
                          onClick={() => handleAcknowledge(notif.id)}
                          disabled={actionLoading === notif.id + '-ack'}
                          className="px-2.5 py-1.5 text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 rounded-lg hover:bg-blue-500/25 transition-colors disabled:opacity-50"
                          title="Acknowledge"
                        >
                          {actionLoading === notif.id + '-ack' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            'Ack'
                          )}
                        </button>
                      )}
                      {notif.status !== 'resolved' && (
                        <button
                          onClick={() => handleResolve(notif.id)}
                          disabled={actionLoading === notif.id + '-resolve'}
                          className="px-2.5 py-1.5 text-xs bg-green-500/15 text-green-400 border border-green-500/20 rounded-lg hover:bg-green-500/25 transition-colors disabled:opacity-50"
                          title="Resolve"
                        >
                          {actionLoading === notif.id + '-resolve' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <CheckCircle className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(notif.id)}
                        disabled={actionLoading === notif.id + '-delete'}
                        className="px-2.5 py-1.5 text-xs bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg hover:bg-red-500/20 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        {actionLoading === notif.id + '-delete' ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
