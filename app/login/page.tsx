'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { login, isAuthenticated } from '@/lib/auth'
import { Eye, EyeOff, Lock, Mail, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
const WEBSITE_URL = 'https://www.discretdigital.com'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError]               = useState('')
  const [loading, setLoading]           = useState(false)
  const [checking, setChecking]         = useState(true)

  useEffect(() => {
    isAuthenticated().then((ok) => {
      if (ok) router.replace('/dashboard')
      else setChecking(false)
    })
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) { setError('Email is required'); return }
    if (!password)     { setError('Password is required'); return }

    setLoading(true)
    const result = await login(email, password)
    if (result.success) {
      router.replace('/dashboard')
    } else {
      setError(result.error ?? 'Invalid credentials')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-dark-900 flex flex-col">

      {/* ── Top Bar ── */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
        {/* Top-left: Discret logo → website */}
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 opacity-90 hover:opacity-100 transition-opacity"
          title="Visit Discret Digital"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/discret-ai-logo.svg"
            alt="Discret Digital"
            className="h-8 w-auto object-contain"
          />
        </a>

        {/* Top-right: Visit our website button */}
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white border border-dark-600 hover:border-dark-500 bg-dark-800 hover:bg-dark-700 rounded-lg px-4 py-2 transition-all"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Visit our website
        </a>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">

          {/* Logo + Heading */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/discret-ai-logo.svg"
                alt="Discret AI Agentic Platform"
                className="h-12 w-auto object-contain"
              />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Discret AI Agentic Platform
            </h1>
            <p className="text-gray-400 mt-1 text-sm">
              Agent Dashboard &mdash;{' '}
              <a
                href={WEBSITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 transition-colors"
              >
                Discret Digital
              </a>
            </p>
          </div>

          {/* Card */}
          <div className="bg-dark-800 border border-dark-600 rounded-2xl p-8">
            <h2 className="text-lg font-semibold text-white mb-6">Sign in to your account</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Email address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@discret.digital"
                    autoComplete="email"
                    className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    className="w-full bg-dark-700 border border-dark-600 text-white placeholder-gray-600 rounded-lg pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg py-2.5 text-sm transition-colors mt-2 flex items-center justify-center gap-2"
              >
                {loading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</>
                  : 'Sign in'
                }
              </button>
            </form>
          </div>

          {/* Powered By — bottom of card area */}
          <p className="text-center text-xs text-gray-600 mt-5">
            Powered by{' '}
            <a
              href={WEBSITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 underline underline-offset-2 transition-colors"
            >
              Discret AI
            </a>
          </p>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="px-6 py-5 border-t border-dark-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600">
        <div className="flex items-center gap-4">
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/discret-logo.svg"
              alt="Discret Digital"
              className="h-6 w-auto object-contain opacity-50 hover:opacity-80 transition-opacity"
            />
          </a>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Discret Digital
          </a>
          <span>&copy; {new Date().getFullYear()} All rights reserved.</span>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href={WEBSITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </footer>

    </div>
  )
}
