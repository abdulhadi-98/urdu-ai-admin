/**
 * SSE endpoint: streams new conversation rows to the admin UI in real-time.
 *
 * How it works:
 *   - A server-side Supabase client (direct HTTP → ws://) subscribes to
 *     postgres_changes on the conversations table.
 *   - Node.js has no mixed-content restrictions, so ws:// works even though
 *     the admin dashboard is served over HTTPS.
 *   - Each INSERT is forwarded as an SSE "data:" event to the browser.
 *   - The browser uses EventSource (plain HTTP), avoiding all mixed-content issues.
 *   - A keepalive comment is sent every 20 s to prevent proxies from closing the stream.
 *   - On client disconnect the channel is cleaned up immediately.
 */

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'http://localhost:54321'
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY ||
    ''

  const encoder = new TextEncoder()

  let cleanedUp = false
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let channelRef: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let clientRef: any = null
  let keepaliveTimer: ReturnType<typeof setInterval> | null = null
  let controllerRef: ReadableStreamDefaultController | null = null

  const cleanup = () => {
    if (cleanedUp) return
    cleanedUp = true
    if (keepaliveTimer) clearInterval(keepaliveTimer)
    if (channelRef && clientRef) {
      clientRef.removeChannel(channelRef).catch(() => {})
    }
    try { controllerRef?.close() } catch {}
  }

  const stream = new ReadableStream({
    start(controller) {
      controllerRef = controller

      // Server-side client — direct HTTP URL, realtime goes ws:// which Node.js allows
      const client = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      clientRef = client

      // Keepalive every 20 s (SSE comments are ignored by EventSource)
      keepaliveTimer = setInterval(() => {
        try { controller.enqueue(encoder.encode(': keepalive\n\n')) } catch {}
      }, 20_000)

      const channel = client
        .channel('admin-conv-stream')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'conversations' },
          (payload) => {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify(payload.new)}\n\n`)
              )
            } catch {}
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ _type: 'connected' })}\n\n`)
              )
            } catch {}
          }
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            // Let the client know realtime failed; it will fall back to polling
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ _type: 'error' })}\n\n`)
              )
            } catch {}
            cleanup()
          }
        })

      channelRef = channel
    },
    cancel() {
      cleanup()
    },
  })

  // Also clean up when the HTTP request is aborted (browser tab closed / navigation)
  req.signal.addEventListener('abort', cleanup)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // tells nginx/traefik not to buffer the stream
    },
  })
}
