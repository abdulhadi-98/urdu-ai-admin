'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  MessageSquare,
  Bell,
  BookOpen,
  Settings,
  User,
  LogOut,
  Bot,
  ChevronRight,
  Puzzle,
  Globe,
} from 'lucide-react'
import { logout } from '@/lib/auth'
import { TENANT } from '@/lib/auth'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Conversations', icon: MessageSquare, href: '/conversations' },
  { label: 'Web Leads', icon: Globe, href: '/web-leads' },
  { label: 'Notifications', icon: Bell, href: '/notifications' },
  { label: 'Knowledge Base', icon: BookOpen, href: '/knowledge-base' },
  { label: 'Prompts', icon: Settings, href: '/prompts' },
  { label: 'Widget Config', icon: Puzzle, href: '/widget-config' },
  { label: 'Settings', icon: User, href: '/settings' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  return (
    <aside className="w-64 shrink-0 bg-dark-800 border-r border-dark-600 flex flex-col h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-dark-600">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <Bot className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{TENANT.agentName}</p>
          <p className="text-xs text-gray-500">{TENANT.name}</p>
        </div>
      </div>

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
                active
                  ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-dark-700'
              )}
            >
              <item.icon
                className={cn('w-4 h-4 shrink-0', active ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300')}
              />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 text-indigo-400/60" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom: sign out */}
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
