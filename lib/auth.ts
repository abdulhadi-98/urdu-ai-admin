/**
 * Client-side auth helpers.
 *
 * The actual session is an httpOnly JWT cookie — client JS cannot read it.
 * Auth state is checked via GET /api/auth/me (server validates the cookie).
 */

export const TENANT = {
  name:      'Discret Digital',
  slug:      'discret',
  agentName: 'Urdu AI Agent',
}

export interface AdminUser {
  id:    string
  email: string
  name:  string
  role:  string
}

// ── Login ─────────────────────────────────────────────────────────────────────

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string; user?: Pick<AdminUser, 'name' | 'role'> }> {
  try {
    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email: email.trim().toLowerCase(), password }),
    })
    const data = await res.json()
    if (res.ok && data.success) return { success: true, user: { name: data.name, role: data.role } }
    return { success: false, error: data.error ?? 'Login failed' }
  } catch {
    return { success: false, error: 'Network error — check your connection' }
  }
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch { /* ignore */ }
}

// ── Session check ─────────────────────────────────────────────────────────────
// Calls /api/auth/me — middleware validates the cookie server-side.
// Returns null if the session is missing or expired.

export async function getSession(): Promise<AdminUser | null> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store' })
    if (!res.ok) return null
    return res.json() as Promise<AdminUser>
  } catch {
    return null
  }
}

// ── isAuthenticated (async) ───────────────────────────────────────────────────
// Use in useEffect — not synchronous like the old version.

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}
