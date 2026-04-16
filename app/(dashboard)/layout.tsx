'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated, refreshSession } from '@/lib/auth'
import Sidebar from '@/components/layout/Sidebar'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()

  // Guard: redirect to login immediately if not authenticated
  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace('/login')
    }
  }, [router])

  // Auto-logout: check every 30 seconds; redirect when the 20-min window closes
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isAuthenticated()) {
        router.replace('/login')
      }
    }, 30_000)
    return () => clearInterval(interval)
  }, [router])

  // Activity refresh: reset the 20-min timer on user interaction
  const handleActivity = useCallback(() => {
    refreshSession()
  }, [])

  useEffect(() => {
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }))
    return () => events.forEach((e) => window.removeEventListener(e, handleActivity))
  }, [handleActivity])

  return (
    <div className="flex h-screen bg-dark-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
    </div>
  )
}
