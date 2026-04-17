/**
 * POST /api/branding/logo — upload logo to Supabase Storage
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

export async function POST(req: NextRequest) {
  const role = req.headers.get('x-admin-role') ?? 'member'
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Only super admins can upload logo' }, { status: 403 })
  }

  let formData: FormData
  try { formData = await req.formData() } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('logo') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Max file size is 2MB' }, { status: 400 })

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const filename = `logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const supabase = db()

  // Ensure bucket exists
  await supabase.storage.createBucket('branding', { public: true }).catch(() => {})

  const { error } = await supabase.storage
    .from('branding')
    .upload(filename, buffer, { contentType: file.type, upsert: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Return proxied URL through /api/sb to avoid mixed content
  const proxyUrl = `/api/sb/storage/v1/object/public/branding/${filename}?t=${Date.now()}`
  return NextResponse.json({ success: true, url: proxyUrl })
}
