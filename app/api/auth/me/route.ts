/**
 * GET /api/auth/me
 * Returns the authenticated admin's profile.
 * Middleware injects x-admin-* headers after validating the JWT cookie.
 */
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const id    = req.headers.get('x-admin-id')
  const email = req.headers.get('x-admin-email')
  const name  = req.headers.get('x-admin-name')
  const role  = req.headers.get('x-admin-role')

  if (!id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ id, email, name, role })
}
