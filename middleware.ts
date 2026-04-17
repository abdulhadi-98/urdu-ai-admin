/**
 * Next.js Edge Middleware — server-side route protection.
 *
 * Runs before every request. Protected paths require a valid
 * admin_token cookie (JWT signed with ADMIN_JWT_SECRET).
 *
 * Unprotected paths: /login, /api/auth/login, static assets.
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'change-this-secret-in-production'
)

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
  '/_next',
  '/favicon.ico',
]

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const token = req.cookies.get('admin_token')?.value

  if (!token) {
    return pathname.startsWith('/api/')
      ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      : NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)

    // Forward user info to downstream route handlers via headers
    const res = NextResponse.next()
    res.headers.set('x-admin-id',    String(payload.sub ?? ''))
    res.headers.set('x-admin-email', String(payload.email ?? ''))
    res.headers.set('x-admin-name',  String(payload.name  ?? ''))
    res.headers.set('x-admin-role',  String(payload.role  ?? 'admin'))
    return res
  } catch {
    // Token invalid or expired — clear cookie and redirect
    if (pathname.startsWith('/api/')) {
      const res = NextResponse.json({ error: 'Session expired' }, { status: 401 })
      res.cookies.delete('admin_token')
      return res
    }
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete('admin_token')
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Match all paths except static files.
     * This runs on: /, /dashboard/*, /api/*, etc.
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
