const AUTH_KEY = 'admin_authed'

/**
 * Verifies the password server-side (against DB, then env var).
 * Password is never stored or compared in client code.
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
      if (typeof window !== 'undefined') sessionStorage.setItem(AUTH_KEY, 'true')
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
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(AUTH_KEY) === 'true'
}

export const TENANT = {
  name: 'Discret Digital',
  slug: 'discret',
  agentName: 'Urdu AI Agent',
}
