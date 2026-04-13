/**
 * Server-side API route for prompt management.
 * Reads/writes agent_prompts table directly via Supabase service key.
 * Bypasses the backend proxy — no proxy body-forwarding issues.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function getAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

// GET /api/prompts — return all stored prompts
export async function GET() {
  try {
    const admin = getAdmin()
    const { data, error } = await admin
      .from('agent_prompts')
      .select('agent_type, prompt, updated_at')
      .order('agent_type')

    if (error) throw error
    return NextResponse.json({ success: true, data: data || [] })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

// PUT /api/prompts — upsert one prompt by agent_type
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { agent_type, prompt } = body

    if (!agent_type || !prompt?.trim()) {
      return NextResponse.json(
        { success: false, error: 'agent_type and prompt are required' },
        { status: 400 }
      )
    }

    const admin = getAdmin()
    const { error } = await admin
      .from('agent_prompts')
      .upsert(
        { agent_type, prompt: prompt.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'agent_type' }
      )

    if (error) throw error
    return NextResponse.json({ success: true, message: 'Prompt updated' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
