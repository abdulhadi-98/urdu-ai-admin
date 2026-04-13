'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Save, RotateCcw, Info, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import Header from '@/components/layout/Header'

const API = '/api/backend'

const DEFAULTS = {
  system: `You are a helpful, friendly AI assistant for a Pakistani business. Your name is "Amara".

LANGUAGE RULES:
- Detect the user's language automatically
- If they write in Urdu (نستعلیق), respond in Urdu script
- If they write in Roman Urdu (e.g., "Kya haal hai"), respond in Roman Urdu
- If they write in English, respond in English
- If they mix languages, mirror their style
- Use Pakistani cultural context — greetings like "Assalam o Alaikum", references to local context

PERSONALITY:
- Warm, professional, slightly witty (like a smart friend who works in business)
- Use appropriate Urdu honorifics (aap, janab) based on conversation tone
- Keep responses concise — max 3-4 sentences for simple queries
- Be direct and helpful, don't over-explain

CAPABILITIES:
- Answer questions about products/services
- Help schedule meetings and appointments
- Handle complaints with empathy
- Qualify leads by understanding their needs
- Escalate to human when: user explicitly asks, you can't help, emotional distress detected`,

  voice: `VOICE MODE ACTIVE — your response will be spoken aloud by a Pakistani TTS voice:
- CRITICAL: Respond in ROMAN URDU only — do NOT use Urdu script (نستعلیق) at all, it will be mispronounced
- Write exactly how a Pakistani speaks on a phone call, e.g. "Jee bilkul, main aapki help kar sakta hoon. Koi bhi masla ho, batayein"
- Keep it SHORT — 1 to 2 sentences max
- Mix Roman Urdu and English naturally the way Pakistanis do
- NO bullet points, NO lists, NO emojis, NO formatting — only spoken words
- Use natural fillers: "jee", "haan zaroor", "bilkul", "dekhtay hain", "theek hai"
- Add commas where a speaker would naturally pause or breathe
- Vary your openings — don't always start the same way`,

  handoff: `Escalate to human agent when:
1. Customer explicitly asks to speak with a human
2. Customer is ready to visit a property ("daikhnaa chahta hoon")
3. Customer wants to make an offer or negotiate price
4. Customer has a complaint or dispute
5. Query involves legal documentation or registration
6. Customer mentions an emergency or urgent timeline`,
}

type PromptKey = 'system' | 'voice' | 'handoff'

export default function PromptsPage() {
  const [prompts, setPrompts] = useState({ system: '', voice: '', handoff: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<PromptKey | null>(null)
  const [savedKey, setSavedKey] = useState<PromptKey | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load prompts from backend on mount
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`${API}/api/admin/prompts`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load prompts')

        const map: Record<string, string> = {}
        for (const row of json.data || []) map[row.agent_type] = row.prompt

        setPrompts({
          system:  map.system  || DEFAULTS.system,
          voice:   map.voice   || DEFAULTS.voice,
          handoff: map.handoff || DEFAULTS.handoff,
        })
      } catch (err: unknown) {
        // Fall back to defaults silently — agent will also use defaults
        setPrompts(DEFAULTS)
        if (err instanceof Error) setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleSave = async (key: PromptKey) => {
    setSaving(key)
    setError(null)
    try {
      const res = await fetch(`${API}/api/admin/prompts/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompts[key] }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Save failed')
      setSavedKey(key)
      setTimeout(() => setSavedKey(null), 3000)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  const handleReset = (key: PromptKey) => {
    setPrompts(p => ({ ...p, [key]: DEFAULTS[key] }))
  }

  const SECTIONS: { key: PromptKey; title: string; subtitle: string; rows: number }[] = [
    { key: 'system',  title: 'System Prompt',     subtitle: 'Main instruction for the AI agent',                  rows: 10 },
    { key: 'voice',   title: 'Voice Mode Prompt',  subtitle: 'Additional context when processing voice messages',  rows: 7  },
    { key: 'handoff', title: 'Handoff Rules',      subtitle: 'When to escalate to a human agent',                  rows: 10 },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Info banner */}
        <div className="flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-indigo-300 font-medium">Live — changes apply within 60 seconds</p>
            <p className="text-xs text-indigo-400/80 mt-0.5">
              Prompts are stored in the database. Each save updates the live agent immediately (cache clears on save, refreshes within 60 s for any in-flight requests).
            </p>
          </div>
        </div>

        {/* Global error */}
        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
          </div>
        ) : (
          SECTIONS.map(({ key, title, subtitle, rows }) => (
            <div key={key} className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-600">
                <div>
                  <h3 className="text-sm font-semibold text-white">{title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
                </div>
                <button
                  onClick={() => handleReset(key)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
              </div>

              <div className="p-5 space-y-3">
                <textarea
                  value={prompts[key]}
                  onChange={e => setPrompts(p => ({ ...p, [key]: e.target.value }))}
                  rows={rows}
                  className="w-full bg-dark-700 border border-dark-600 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 resize-y font-mono leading-relaxed"
                  placeholder={`Enter ${title.toLowerCase()}...`}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">{prompts[key].length} characters</p>
                  <div className="flex items-center gap-3">
                    {savedKey === key && (
                      <span className="flex items-center gap-1.5 text-green-400 text-xs">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Saved — agent updated
                      </span>
                    )}
                    <button
                      onClick={() => handleSave(key)}
                      disabled={saving === key}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      {saving === key
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                        : <><Save className="w-3.5 h-3.5" /> Save</>
                      }
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
