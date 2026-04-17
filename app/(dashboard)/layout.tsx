'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'
import { Loader2 } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const [ready, setReady] = useState(false)

  // ── Initial auth check ───────────────────────────────────────────────────
  useEffect(() => {
    isAuthenticated().then((ok) => {
      if (!ok) router.replace('/login')
      else setReady(true)
    })
  }, [router])

  // ── Periodic re-check every 2 min — catches expired sessions ────────────
  useEffect(() => {
    if (!ready) return
    const interval = setInterval(() => {
      isAuthenticated().then((ok) => {
        if (!ok) router.replace('/login')
      })
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
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
