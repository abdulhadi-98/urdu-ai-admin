import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

// Browser: proxy through /api/sb (HTTPS, avoids mixed content)
// Server/build: direct HTTP URL
const getUrl = () =>
  typeof window === 'undefined'
    ? process.env.SUPABASE_URL || 'http://localhost:54321'
    : window.location.origin + '/api/sb'

// Lazy singletons — keys are read at call time from window.__APP_CONFIG__
let _admin: SupabaseClient | null = null
let _public: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    _admin = createClient(getUrl(), config.supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: { params: { eventsPerSecond: -1 } },
    })
  }
  return _admin
}

export function getSupabase(): SupabaseClient {
  if (!_public) {
    _public = createClient(getUrl(), config.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _public
}

// Keep named exports for backwards compat — these resolve lazily
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabaseAdmin() as any)[prop]
  },
})

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return (getSupabase() as any)[prop]
  },
})

export type Conversation = {
  id: string
  phone: string
  name: string | null
  user_message: string | null
  ai_response: string | null
  model: string | null
  tokens_used: number | null
  is_voice: boolean | null
  is_admin: boolean | null
  voice_note_url: string | null
  ai_voice_note_url: string | null
  sentiment: string | null
  needs_human: boolean | null
  escalation_reason: string | null
  property_interest: string | null
  budget_range: string | null
  preferred_location: string | null
  response_time_ms: number | null
  created_at: string
}

export type Notification = {
  id: string
  phone: string
  name: string | null
  type: string
  message: string
  status: string
  escalation_reason: string | null
  priority: string | null
  is_read: boolean | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type KnowledgeBase = {
  id: string
  title: string
  source: string
  content: string
  is_active: boolean
  created_at: string
}

export type AnalyticsEvent = {
  id: string
  event_type: string
  phone: string | null
  response_time_ms: number | null
  model_used: string | null
  tokens_used: number | null
  lead_source: string | null
  property_type: string | null
  budget_range: string | null
  preferred_location: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}
