/**
 * POST /api/auth/login
 *
 * Verifies email + bcrypt password against admin_users table.
 * Issues a signed JWT in an httpOnly cookie on success.
 * Enforces brute-force lockout: 5 failures → 15-min lock.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { signToken, COOKIE_NAME, COOKIE_MAX_AGE } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

// Dummy hash — used for timing-safe comparison when user not found
const DUMMY_HASH = '$2b$12$dummy.dummy.dummy.dummy.dummy.dummy.dummy.dummy.dummyu'
const MAX_FAILURES = 5
const LOCKOUT_MINUTES = 15

function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function POST(req: NextRequest) {
  let email = '', password = ''
  try {
    const body = await req.json()
    email    = (body.email    ?? '').trim().toLowerCase()
    password = (body.password ?? '')
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!email || !password) {
    return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
  }

  const supabase = db()

  // Fetch user — always do bcrypt compare to prevent timing attacks
  const { data: user } = await supabase
    .from('admin_users')
    .select('id, email, name, role, password_hash, is_active, failed_attempts, locked_until')
    .eq('email', email)
    .single()

  const hashToCheck = user?.password_hash ?? DUMMY_HASH

  // bcryptjs supports both $2a$ (pgcrypto) and $2b$ (bcryptjs native) hashes
  const match = await bcrypt.compare(password, hashToCheck)

  // Check lockout before revealing anything
  if (user?.locked_until && new Date(user.locked_until) > new Date()) {
    const minutesLeft = Math.ceil(
      (new Date(user.locked_until).getTime() - Date.now()) / 60_000
    )
    return NextResponse.json(
      { error: `Account locked. Try again in ${minutesLeft} min.` },
      { status: 403 }
    )
  }

  if (!user || !match) {
    // Increment failure counter — and lock if threshold reached
    if (user) {
      const attempts = (user.failed_attempts ?? 0) + 1
      const update: Record<string, unknown> = { failed_attempts: attempts, updated_at: new Date().toISOString() }
      if (attempts >= MAX_FAILURES) {
        update.locked_until = new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
      }
      await supabase.from('admin_users').update(update).eq('id', user.id)
    }
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
  }

  if (!user.is_active) {
    return NextResponse.json({ error: 'Account is disabled. Contact your administrator.' }, { status: 403 })
  }

  // ── Success ──────────────────────────────────────────────────────────────
  await supabase
    .from('admin_users')
    .update({ failed_attempts: 0, locked_until: null, last_login_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', user.id)

  const token = await signToken({ sub: user.id, email: user.email, name: user.name, role: user.role })

  const res = NextResponse.json({ success: true, name: user.name, role: user.role })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly:  true,
    secure:    process.env.NODE_ENV === 'production',
    sameSite:  'lax',
    maxAge:    COOKIE_MAX_AGE,
    path:      '/',
  })
  return res
}
