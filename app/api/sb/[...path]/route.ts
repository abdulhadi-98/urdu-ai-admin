/**
 * Supabase HTTP proxy — forwards browser requests to the internal Supabase
 * instance over HTTP (server-side), avoiding mixed-content errors when the
 * admin dashboard is served over HTTPS.
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321'

const SKIP = new Set(['host', 'connection', 'transfer-encoding', 'content-length'])

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = (params.path ?? []).join('/')
  const search = req.nextUrl.search
  const target = `${SUPABASE_URL}/${path}${search}`

  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    if (!SKIP.has(key.toLowerCase())) headers[key] = value
  })

  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const body = hasBody ? await req.arrayBuffer() : undefined

  const upstream = await fetch(target, { method: req.method, headers, body })

  const resHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!SKIP.has(key.toLowerCase())) resHeaders.set(key, value)
  })

  return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders })
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE }

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization,apikey,Prefer,Range',
    },
  })
}
