'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { UserContext, type SessionUser } from '@/lib/user-context'
import { BrandingContext, DEFAULT_BRANDING, type BrandingConfig } from '@/lib/branding-context'
import Sidebar from '@/components/layout/Sidebar'
import { Loader2 } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [user,     setUser]     = useState<SessionUser | null>(null)
  const [ready,    setReady]    = useState(false)
  const [branding, setBranding] = useState<BrandingConfig>(DEFAULT_BRANDING)

  useEffect(() => {
    getSession().then((session) => {
      if (!session) { router.replace('/login'); return }
      setUser(session as SessionUser)
      setReady(true)
    })
  }, [router])

  // Fetch branding config once session is ready
  useEffect(() => {
    if (!ready) return
    fetch('/api/branding')
      .then((r) => r.json())
      .then(({ branding: b }) => {
        if (!b) return
        const config: BrandingConfig = {
          id:           b.id,
          orgName:      b.org_name      || DEFAULT_BRANDING.orgName,
          slug:         b.slug          || DEFAULT_BRANDING.slug,
          agentName:    b.agent_name    || DEFAULT_BRANDING.agentName,
          logoUrl:      b.logo_url      ?? null,
          primaryColor: b.primary_color || DEFAULT_BRANDING.primaryColor,
        }
        setBranding(config)
        // Apply primary colour as CSS variable
        document.documentElement.style.setProperty('--primary', config.primaryColor)
      })
      .catch(() => {})
  }, [ready])

  // Periodic session re-check every 2 min
  useEffect(() => {
    if (!ready) return
    const interval = setInterval(() => {
      getSession().then((s) => { if (!s) router.replace('/login') })
    }, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [router, ready])

  // Inactivity logout — 15 minutes of no user interaction
  useEffect(() => {
    if (!ready) return
    const TIMEOUT_MS = 15 * 60 * 1000
    let timer: ReturnType<typeof setTimeout>

    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        router.replace('/login')
      }, TIMEOUT_MS)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [router, ready])

  // Network change — re-validate session when connection restores
  useEffect(() => {
    if (!ready) return
    const onOnline = () => {
      getSession().then((s) => { if (!s) router.replace('/login') })
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
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
      <BrandingContext.Provider value={branding}>
        <div className="flex h-screen bg-dark-900 overflow-hidden">
          <Sidebar />
          <main className="flex-1 flex flex-col overflow-hidden">
            {children}
          </main>
        </div>
      </BrandingContext.Provider>
    </UserContext.Provider>
  )
}
