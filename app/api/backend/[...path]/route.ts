/**
 * Backend API proxy — forwards requests to the urdu-ai-agent backend.
 *
 * Resolves the target URL from (in priority order):
 *   1. API_URL          — server-only env var (set this in Dokploy / production)
 *   2. NEXT_PUBLIC_API_URL — also readable server-side; used in local .env.local
 *   3. http://localhost:3000 — last-resort fallback for local dev
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3000'

// Strip hop-by-hop headers and Origin — this is a server-to-server proxy call,
// forwarding the browser's Origin causes the backend CORS middleware to block it.
const SKIP = new Set(['host', 'connection', 'transfer-encoding', 'content-length', 'origin', 'referer'])

async function proxy(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = (params.path ?? []).join('/')
  const search = req.nextUrl.search
  const target = `${API_URL}/${path}${search}`

  const headers: Record<string, string> = {}
  req.headers.forEach((value, key) => {
    if (!SKIP.has(key.toLowerCase())) headers[key] = value
  })

  const hasBody = !['GET', 'HEAD'].includes(req.method)
  const body = hasBody ? await req.arrayBuffer() : undefined

  try {
    const upstream = await fetch(target, { method: req.method, headers, body })

    const resHeaders = new Headers()
    upstream.headers.forEach((value, key) => {
      if (!SKIP.has(key.toLowerCase())) resHeaders.set(key, value)
    })

    return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[proxy] ${req.method} ${target} → ${message}`)
    return NextResponse.json(
      { success: false, error: `Backend unreachable: ${message}. Check API_URL env var (currently: ${API_URL})` },
      { status: 502 }
    )
  }
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE }
