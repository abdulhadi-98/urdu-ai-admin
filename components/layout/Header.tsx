'use client'

import { usePathname } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/conversations':'Conversations',
  '/web-leads':    'Web Leads',
  '/notifications':'Notifications',
  '/knowledge-base':'Knowledge Base',
  '/prompts':      'Prompt Editor',
  '/widget-config':'Widget Configuration',
  '/branding':     'Branding',
  '/settings':     'Settings',
}

interface HeaderProps {
  onRefresh?: () => void
  refreshing?: boolean
}

export default function Header({ onRefresh, refreshing }: HeaderProps) {
  const pathname = usePathname()
  const title    = PAGE_TITLES[pathname] ?? 'Admin'

  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const dateStr = now.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
  const timeStr = now.toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  return (
    <header className="h-14 bg-dark-800 border-b border-dark-600 flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 className="text-base font-semibold text-white">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
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
        <div className="text-right">
          <p className="text-xs font-medium text-white leading-none">{timeStr}</p>
          <p className="text-xs text-gray-500 mt-0.5 leading-none">{dateStr}</p>
        </div>
      </div>
    </header>
  )
}
