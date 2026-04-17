/**
 * Server-only JWT helpers (jose — Edge-compatible).
 * Import ONLY in server components, route handlers, or middleware.
 */
import { SignJWT, jwtVerify } from 'jose'

const SECRET = new TextEncoder().encode(
  process.env.ADMIN_JWT_SECRET || 'change-this-secret-in-production'
)

const ALGORITHM = 'HS256'
const SESSION_HOURS = 8

export interface AdminPayload {
  sub:   string   // admin_users.id
  email: string
  name:  string
  role:  string
}

export async function signToken(payload: AdminPayload): Promise<string> {
  return new SignJWT({ email: payload.email, name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(SECRET)
}

export async function verifyToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return {
      sub:   String(payload.sub   ?? ''),
      email: String(payload.email ?? ''),
      name:  String(payload.name  ?? ''),
      role:  String(payload.role  ?? 'admin'),
    }
  } catch {
    return null
  }
}

export const COOKIE_NAME    = 'admin_token'
export const COOKIE_MAX_AGE = SESSION_HOURS * 3600   // seconds
