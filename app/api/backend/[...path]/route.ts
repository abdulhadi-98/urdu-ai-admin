/**
 * Backend API proxy — forwards requests to the urdu-ai-agent backend.
 * Avoids needing NEXT_PUBLIC_API_URL baked at build time.
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const API_URL = process.env.API_URL || 'http://localhost:3000'

const SKIP = new Set(['host', 'connection', 'transfer-encoding', 'content-length'])

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

  const upstream = await fetch(target, { method: req.method, headers, body })

  const resHeaders = new Headers()
  upstream.headers.forEach((value, key) => {
    if (!SKIP.has(key.toLowerCase())) resHeaders.set(key, value)
  })

  return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders })
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE }
