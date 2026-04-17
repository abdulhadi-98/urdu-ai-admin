/**
 * GET  /api/branding  — fetch current branding config
 * PUT  /api/branding  — update branding (super_admin only)
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

function db() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('Supabase not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export async function GET() {
  try {
    const supabase = db()
    const { data, error } = await supabase
      .from('branding')
      .select('*')
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ branding: data ?? null })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const role = req.headers.get('x-admin-role') ?? 'member'
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can update branding' }, { status: 403 })
  }

  let body: Record<string, string> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const row = {
    org_name:      (body.orgName      ?? '').trim(),
    slug:          (body.slug         ?? '').trim().toLowerCase().replace(/\s+/g, '-'),
    agent_name:    (body.agentName    ?? '').trim(),
    logo_url:      body.logoUrl ?? null,
    primary_color: body.primaryColor ?? '#6366f1',
    updated_at:    new Date().toISOString(),
  }

  if (!row.org_name || !row.slug || !row.agent_name) {
    return NextResponse.json({ error: 'org name, slug, and agent name are required' }, { status: 400 })
  }

  const supabase = db()
  const { data: existing } = await supabase.from('branding').select('id').limit(1).single()

  const result = existing?.id
    ? await supabase.from('branding').update(row).eq('id', existing.id).select().single()
    : await supabase.from('branding').insert(row).select().single()

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 })
  return NextResponse.json({ success: true, branding: result.data })
}
