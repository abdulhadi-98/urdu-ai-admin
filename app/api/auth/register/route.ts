/**
 * User management API — requires authentication (middleware enforces this).
 *
 * GET  /api/auth/register        — list all users
 * POST /api/auth/register        — create user (enforces role limits)
 * PUT  /api/auth/register        — update user (name, role, is_active, password)
 * DELETE /api/auth/register?id=  — remove user
 *
 * Limits: max 2 admins, max 3 members (super_admin unlimited)
 * Only super_admin and admin can manage users.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { ROLE_LIMITS, type Role } from '@/lib/roles'

export const dynamic = 'force-dynamic'

const MIN_PASSWORD_LENGTH = 8
const BCRYPT_ROUNDS = 12

function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

function callerRole(req: NextRequest): Role {
  return (req.headers.get('x-admin-role') ?? 'member') as Role
}

// ── GET — list all users ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const caller = callerRole(req)
  if (caller !== 'super_admin' && caller !== 'admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }
  const supabase = db()
  let query = supabase
    .from('admin_users')
    .select('id, email, name, role, is_active, failed_attempts, locked_until, last_login_at, created_at')
    .order('created_at', { ascending: true })
  // admins cannot see super_admin accounts
  if (caller === 'admin') query = query.neq('role', 'super_admin')
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

// ── POST — create user ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const caller = callerRole(req)
  if (caller !== 'super_admin' && caller !== 'admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  let body: Record<string, string> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const email    = (body.email    ?? '').trim().toLowerCase()
  const name     = (body.name     ?? '').trim()
  const password = (body.password ?? '')
  const role     = (['super_admin', 'admin', 'member'].includes(body.role) ? body.role : 'member') as Role

  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, name, and password are required' }, { status: 400 })
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }
  // Only super_admin can create another super_admin
  if (role === 'super_admin' && caller !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can create super admin accounts' }, { status: 403 })
  }

  // Enforce role limits
  const limit = ROLE_LIMITS[role]
  if (limit !== undefined) {
    const supabase = db()
    const { count } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', role)
    if ((count ?? 0) >= limit) {
      return NextResponse.json(
        { error: `Maximum of ${limit} ${role}${limit !== 1 ? 's' : ''} allowed` },
        { status: 409 }
      )
    }
  }

  const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  const supabase = db()

  const { data, error } = await supabase
    .from('admin_users')
    .insert({ email, name, password_hash, role })
    .select('id, email, name, role, is_active, created_at')
    .single()

  if (error) {
    const msg = error.code === '23505' ? 'Email is already registered' : error.message
    return NextResponse.json({ error: msg }, { status: error.code === '23505' ? 409 : 500 })
  }

  return NextResponse.json({ success: true, user: data }, { status: 201 })
}

// ── PUT — update user ─────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  const caller   = callerRole(req)
  const callerId = req.headers.get('x-admin-id') ?? ''

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { id, name, role, is_active, password } = body as {
    id: string; name?: string; role?: string; is_active?: boolean; password?: string
  }

  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

  const isSelf = id === callerId

  if (caller === 'member') {
    // Members can only change their own password
    if (!isSelf) return NextResponse.json({ error: 'You can only update your own account' }, { status: 403 })
    if (name !== undefined || role !== undefined || is_active !== undefined) {
      return NextResponse.json({ error: 'Only admins can change roles or account status' }, { status: 403 })
    }
  } else if (caller === 'admin') {
    // Admins cannot touch super_admin accounts
    const supabase = db()
    const { data: target } = await supabase.from('admin_users').select('role').eq('id', id).single()
    if (target?.role === 'super_admin') {
      return NextResponse.json({ error: 'Admins cannot modify super admin accounts' }, { status: 403 })
    }
    // Admins cannot assign super_admin role
    if (role === 'super_admin') {
      return NextResponse.json({ error: 'Only super admins can assign the super admin role' }, { status: 403 })
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name      !== undefined) update.name      = String(name).trim()
  if (role      !== undefined) update.role      = ['super_admin', 'admin', 'member'].includes(role) ? role : 'member'
  if (is_active !== undefined) update.is_active = Boolean(is_active)
  if (password) {
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }, { status: 400 })
    }
    update.password_hash   = await bcrypt.hash(String(password), BCRYPT_ROUNDS)
    update.failed_attempts = 0
    update.locked_until    = null
  }

  const supabase = db()
  const { data, error } = await supabase
    .from('admin_users')
    .update(update)
    .eq('id', id)
    .select('id, email, name, role, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, user: data })
}

// ── DELETE — remove user ──────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const caller = callerRole(req)
  if (caller !== 'super_admin' && caller !== 'admin') {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

  const supabase = db()

  const { data: target } = await supabase.from('admin_users').select('role').eq('id', id).single()

  // Admins cannot delete super_admin accounts
  if (target?.role === 'super_admin') {
    if (caller !== 'super_admin') {
      return NextResponse.json({ error: 'Admins cannot delete super admin accounts' }, { status: 403 })
    }
    // Prevent deleting the last super_admin
    const { count } = await supabase
      .from('admin_users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'super_admin')
    if ((count ?? 0) <= 1) {
      return NextResponse.json({ error: 'Cannot delete the last super admin' }, { status: 409 })
    }
  }

  const { error } = await supabase.from('admin_users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
