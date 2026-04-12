import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY || 'placeholder-service-key'

// Public client for general use
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})

// Service role client for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
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
