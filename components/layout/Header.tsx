'use client'

import { usePathname } from 'next/navigation'
import { Bell, RefreshCw } from 'lucide-react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/conversations': 'Conversations',
  '/notifications': 'Notifications',
  '/knowledge-base': 'Knowledge Base',
  '/prompts': 'Prompt Editor',
  '/settings': 'Settings',
}

interface HeaderProps {
  onRefresh?: () => void
  refreshing?: boolean
}

export default function Header({ onRefresh, refreshing }: HeaderProps) {
  const pathname = usePathname()
  const title = PAGE_TITLES[pathname] ?? 'Admin'

  return (
    <header className="h-14 bg-dark-800 border-b border-dark-600 flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
        <div className="w-8 h-8 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
          <span className="text-xs font-bold text-indigo-300">A</span>
        </div>
      </div>
    </header>
  )
}
