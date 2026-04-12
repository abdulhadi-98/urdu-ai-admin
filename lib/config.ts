type AppConfig = {
  apiUrl: string
  supabaseAnonKey: string
  supabaseServiceKey: string
}

function getConfig(): AppConfig {
  if (typeof window !== 'undefined' && (window as any).__APP_CONFIG__) {
    return (window as any).__APP_CONFIG__ as AppConfig
  }
  // Server-side fallback (build time)
  return {
    apiUrl: process.env.API_URL || 'http://localhost:3000',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'placeholder',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_KEY || 'placeholder',
  }
}

export const config = {
  get apiUrl() { return getConfig().apiUrl },
  get supabaseAnonKey() { return getConfig().supabaseAnonKey },
  get supabaseServiceKey() { return getConfig().supabaseServiceKey },
}
