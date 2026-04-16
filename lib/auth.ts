const AUTH_KEY   = 'admin_authed'
const EXPIRY_KEY = 'admin_expiry'

/** Session lifetime — 20 minutes */
const SESSION_MS = 20 * 60 * 1000

/**
 * Verifies the password server-side (against DB, then env var).
 * Stores an expiry timestamp (now + 20 min) on success.
 */
export async function login(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    if (data.success) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(AUTH_KEY, 'true')
        sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_MS))
      }
      return true
    }
    return false
  } catch {
    return false
  }
}

export function logout(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(EXPIRY_KEY)
  }
}

/** Returns true only if the session exists AND hasn't expired */
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  if (sessionStorage.getItem(AUTH_KEY) !== 'true') return false
  const expiry = Number(sessionStorage.getItem(EXPIRY_KEY) ?? 0)
  if (Date.now() > expiry) {
    // Session timed out — clear storage so next check is instant
    sessionStorage.removeItem(AUTH_KEY)
    sessionStorage.removeItem(EXPIRY_KEY)
    return false
  }
  return true
}

/**
 * Refresh the session expiry — call this on meaningful user activity.
 * Silently does nothing if the session has already expired.
 */
export function refreshSession(): void {
  if (typeof window === 'undefined') return
  if (sessionStorage.getItem(AUTH_KEY) !== 'true') return
  sessionStorage.setItem(EXPIRY_KEY, String(Date.now() + SESSION_MS))
}

export const TENANT = {
  name: 'Discret Digital',
  slug: 'discret',
  agentName: 'Urdu AI Agent',
}
