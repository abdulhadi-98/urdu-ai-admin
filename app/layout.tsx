import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Discret AI Agentic Platform | Agent Dashboard',
  description: 'Discret AI Agentic Platform — the intelligent AI agent dashboard by Discret Digital. Manage conversations, web leads, and AI-powered workflows from one place.',
  keywords: 'Discret AI, Discret Digital, AI agent, agentic platform, WhatsApp AI, AI dashboard, Urdu AI agent, discretdigital.com',
  authors: [{ name: 'Discret Digital', url: 'https://www.discretdigital.com' }],
  creator: 'Discret Digital',
  publisher: 'Discret Digital',
  metadataBase: new URL('https://www.discretdigital.com'),
  openGraph: {
    title: 'Discret AI Agentic Platform | Agent Dashboard',
    description: 'Intelligent AI agent dashboard by Discret Digital. Manage conversations, web leads, and AI-powered workflows.',
    url: 'https://www.discretdigital.com',
    siteName: 'Discret AI Agentic Platform',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Discret AI Agentic Platform | Agent Dashboard',
    description: 'Intelligent AI agent dashboard by Discret Digital.',
    creator: '@discretdigital',
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Inject runtime config — read from server-side env vars (set in Dokploy UI)
  const config = {
    apiUrl:
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      '',
    supabaseAnonKey:
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      '',
    supabaseServiceKey:
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY ||
      '',
  }

  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__APP_CONFIG__ = ${JSON.stringify(config)}`,
          }}
        />
      </head>
      <body className={`${inter.className} bg-dark-900 text-white antialiased`}>
        {children}
      </body>
    </html>
  )
}
