import { createClient } from '@supabase/supabase-js'

// The inline <script> in layout.tsx sets window.__APP_CONFIG__ before any
// JS bundle loads, so these are safe to read at module initialisation time.
const isBrowser = typeof window !== 'undefined'

// Browser → HTTPS proxy (avoids mixed-content with HTTP Supabase)
// Server → direct HTTP URL (server-side calls are fine over HTTP)
const supabaseUrl = isBrowser
  ? window.location.origin + '/api/sb'
  : process.env.SUPABASE_URL || 'http://localhost:54321'

const cfg = isBrowser ? (window as any).__APP_CONFIG__ ?? {} : {}

const anonKey: string =
  cfg.supabaseAnonKey || process.env.SUPABASE_ANON_KEY || 'placeholder'

const serviceKey: string =
  cfg.supabaseServiceKey || process.env.SUPABASE_SERVICE_KEY || 'placeholder'

// Public client
export const supabase = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Service-role client (realtime disabled — WebSocket can't go through proxy)
export const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: -1 } },
})

// ── Types ─────────────────────────────────────────────────────────────────────

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
