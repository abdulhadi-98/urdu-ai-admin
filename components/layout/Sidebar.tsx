'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, MessageSquare, Bell, BookOpen,
  Settings, LogOut, Bot, ChevronRight, Puzzle, Globe, FileText, Palette, CreditCard,
} from 'lucide-react'
import { logout } from '@/lib/auth'
import { useUser } from '@/lib/user-context'
import { useBranding, hexToRgba } from '@/lib/branding-context'
import { canAccess, roleLabel, roleColor, type Role } from '@/lib/roles'
import { cn } from '@/lib/utils'

const ALL_NAV = [
  { label: 'Dashboard',     icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Conversations', icon: MessageSquare,   href: '/conversations' },
  { label: 'Web Leads',     icon: Globe,           href: '/web-leads' },
  { label: 'Notifications', icon: Bell,            href: '/notifications' },
  { label: 'Knowledge Base',icon: BookOpen,        href: '/knowledge-base' },
  { label: 'Prompts',       icon: FileText,        href: '/prompts' },
  { label: 'Widget Config', icon: Puzzle,          href: '/widget-config' },
  { label: 'Branding',      icon: Palette,         href: '/branding' },
  { label: 'Billing',       icon: CreditCard,      href: '/billing' },
  { label: 'Settings',      icon: Settings,        href: '/settings' },
]

export default function Sidebar() {
  const pathname  = usePathname()
  const router    = useRouter()
  const user      = useUser()
  const branding  = useBranding()
  const role      = (user?.role ?? 'member') as Role
  const primary   = branding.primaryColor

  const navItems = ALL_NAV.filter((item) => canAccess(role, item.href))

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  return (
    <aside className="w-64 shrink-0 bg-dark-800 border-r border-dark-600 flex flex-col h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-dark-600">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 overflow-hidden"
          style={{
            backgroundColor: hexToRgba(primary, 0.2),
            border: `1px solid ${hexToRgba(primary, 0.3)}`,
          }}
        >
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="w-full h-full object-contain p-0.5"
            />
          ) : (
            <Bot className="w-5 h-5" style={{ color: primary }} />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{branding.agentName}</p>
          <p className="text-xs text-gray-500">{branding.orgName}</p>
        </div>
      </div>

      {/* Current user badge */}
      {user && (
        <div className="px-4 py-3 border-b border-dark-600">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: hexToRgba(primary, 0.2) }}
            >
              <span className="text-xs font-semibold" style={{ color: primary }}>
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user.name}</p>
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 border', roleColor(role))}>
                {roleLabel(role)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all group',
                active ? '' : 'text-gray-400 hover:text-white hover:bg-dark-700'
              )}
              style={active ? {
                backgroundColor: hexToRgba(primary, 0.15),
                border: `1px solid ${hexToRgba(primary, 0.2)}`,
                color: primary,
              } : undefined}
            >
              <item.icon
                className="w-4 h-4 shrink-0"
                style={active ? { color: primary } : undefined}
              />
              <span className="flex-1">{item.label}</span>
              {active && (
                <ChevronRight className="w-3.5 h-3.5" style={{ color: hexToRgba(primary, 0.6) }} />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-dark-600">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all group"
        >
          <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-400" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  )
}
