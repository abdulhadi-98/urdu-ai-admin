'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { UserContext, type SessionUser } from '@/lib/user-context'
import Sidebar from '@/components/layout/Sidebar'
import { Loader2 } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user, setUser]   = useState<SessionUser | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    getSession().then((session) => {
      if (!session) { router.replace('/login'); return }
      setUser(session as SessionUser)
      setReady(true)
    })
  }, [router])

  // Periodic re-check every 2 min
  useEffect(() => {
    if (!ready) return
    const interval = setInterval(() => {
      getSession().then((s) => { if (!s) router.replace('/login') })
    }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [router, ready])

  if (!ready) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  return (
    <UserContext.Provider value={user}>
      <div className="flex h-screen bg-dark-900 overflow-hidden">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          {children}
        </main>
      </div>
    </UserContext.Provider>
  )
}
