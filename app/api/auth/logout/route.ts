import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/jwt'

export const dynamic = 'force-dynamic'

export async function POST() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
