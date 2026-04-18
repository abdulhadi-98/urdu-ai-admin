/**
 * Next.js Edge Middleware — authentication + role-based route protection.
 *
 * super_admin → full access
 * admin       → all routes except /prompts and /knowledge-base
 * member      → only /conversations and /web-leads
 */
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { canAccess, type Role } from '@/lib/roles'

const _jwtRaw = process.env.ADMIN_JWT_SECRET
if (!_jwtRaw) throw new Error('ADMIN_JWT_SECRET environment variable is not set')
const JWT_SECRET = new TextEncoder().encode(_jwtRaw)

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/_next', '/favicon.ico']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

function forbidden(req: NextRequest, message: string) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: message }, { status: 403 })
  }
  // Redirect to the first allowed page based on role (handled client-side via sidebar)
  return NextResponse.redirect(new URL('/conversations', req.url))
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
    const role = (payload.role ?? 'member') as Role

    // ── Role-based access check ──────────────────────────────────────────────
    if (!canAccess(role, pathname)) {
      return forbidden(req, `Access denied — your role (${role}) cannot access this page`)
    }

    // Forward user info to downstream route handlers
    const res = NextResponse.next()
    res.headers.set('x-admin-id',    String(payload.sub   ?? ''))
    res.headers.set('x-admin-email', String(payload.email ?? ''))
    res.headers.set('x-admin-name',  String(payload.name  ?? ''))
    res.headers.set('x-admin-role',  String(role))
    return res
  } catch {
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
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
