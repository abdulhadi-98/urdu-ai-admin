/**
 * Role-based access control definitions.
 *
 * super_admin — full access to everything
 * admin       — all dashboard routes except /prompts and /knowledge-base
 * member      — only /conversations and /web-leads
 */

export type Role = 'super_admin' | 'admin' | 'member'

// Routes each role is ALLOWED to visit (prefix match)
export const ROLE_ALLOWED_PATHS: Record<Role, string[]> = {
  super_admin: ['*'],   // unrestricted
  admin: [
    '/dashboard',
    '/conversations',
    '/web-leads',
    '/notifications',
    '/widget-config',
    '/settings',
    '/api',
  ],
  // Note: /branding is super_admin only — canAccess returns true for super_admin unconditionally
  member: [
    '/conversations',
    '/web-leads',
    '/api/auth',                              // session checks
    '/api/branding',                          // sidebar branding (layout)
    '/api/conversations',                     // stream endpoint
    '/api/sb',                                // Supabase proxy — needed for data fetching
    '/api/backend/api/admin/conversations',
    '/api/backend/api/admin/web-leads',
    '/api/backend/api/admin/notifications',   // web-leads page actions
    '/api/backend/api/admin/send',            // reply to WhatsApp from conversations
    '/api/backend/api/admin/send-voice',      // voice reply
  ],
}

// Max users allowed per role (excluding super_admin — unlimited)
export const ROLE_LIMITS: Partial<Record<Role, number>> = {
  admin:  2,
  member: 3,
}

export function canAccess(role: Role, pathname: string): boolean {
  if (role === 'super_admin') return true
  const allowed = ROLE_ALLOWED_PATHS[role] ?? []
  return allowed.some((p) => pathname.startsWith(p))
}

export function roleLabel(role: Role): string {
  return role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : 'Member'
}

export function roleColor(role: Role): string {
  return role === 'super_admin'
    ? 'bg-purple-500/15 text-purple-400 border-purple-500/20'
    : role === 'admin'
    ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/20'
    : 'bg-gray-500/15 text-gray-400 border-gray-500/20'
}
