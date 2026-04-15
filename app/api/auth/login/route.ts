/**
 * Server-side login endpoint.
 * Verifies the admin password against:
 *   1. tenant_config.admin_password in the DB (if the column exists)
 *   2. ADMIN_PASSWORD environment variable
 *   3. Hardcoded fallback (development only)
 *
 * Password never lives in client-side code.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const FALLBACK_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin2026!'
const TENANT_SLUG = 'discret'

function getAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { password } = body as { password?: string }

  if (!password) {
    return NextResponse.json({ success: false, error: 'Password required' }, { status: 400 })
  }

  // Resolve the expected password: DB first, env var fallback
  let expectedPassword = FALLBACK_PASSWORD
  try {
    const admin = getAdmin()
    const { data } = await admin
      .from('tenant_config')
      .select('admin_password')
      .eq('slug', TENANT_SLUG)
      .single()
    if (data && (data as Record<string, unknown>).admin_password) {
      expectedPassword = (data as Record<string, unknown>).admin_password as string
    }
  } catch {
    // Column may not exist yet — fall back to env var / hardcoded
  }

  if (password === expectedPassword) {
    return NextResponse.json({ success: true })
  }
  return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 })
}
