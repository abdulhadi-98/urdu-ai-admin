'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { Save, RotateCcw, Info, CheckCircle } from 'lucide-react'
import Header from '@/components/layout/Header'

const STORAGE_KEYS = {
  systemPrompt: 'prompt_system',
  voicePrompt: 'prompt_voice',
  handoffRules: 'prompt_handoff',
}

const DEFAULTS = {
  systemPrompt: `You are an Urdu-speaking AI assistant for Discret Digital's real estate platform. You help Pakistani customers find properties, answer questions about real estate, and provide information about available listings.

Key behaviors:
- Always respond in Urdu (or Urdu-English mix based on user's language)
- Be warm, professional, and helpful
- Collect lead information naturally (name, budget, preferred location, property type)
- Escalate to human agent when user seems ready to visit or has specific urgent needs
- Never make up property prices or listings`,

  voicePrompt: `You are responding to a voice message from a customer. Keep your response:
- Conversational and natural for voice
- Shorter than text responses (2-3 sentences max)
- Clear pronunciation hints for Urdu numbers and addresses
- Always confirm you understood their message correctly`,

  handoffRules: `Escalate to human agent when:
1. Customer explicitly asks to speak with a human
2. Customer is ready to visit a property ("daikhnaa chahta hoon")
3. Customer wants to make an offer or negotiate price
4. Customer has a complaint or dispute
5. Query involves legal documentation or registration
6. Customer mentions an emergency or urgent timeline

Do NOT escalate for:
- General property inquiries
- Price range questions
- Location information
- Standard FAQs`,
}

export default function PromptsPage() {
  const [systemPrompt, setSystemPrompt] = useState('')
  const [voicePrompt, setVoicePrompt] = useState('')
  const [handoffRules, setHandoffRules] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setSystemPrompt(localStorage.getItem(STORAGE_KEYS.systemPrompt) ?? DEFAULTS.systemPrompt)
    setVoicePrompt(localStorage.getItem(STORAGE_KEYS.voicePrompt) ?? DEFAULTS.voicePrompt)
    setHandoffRules(localStorage.getItem(STORAGE_KEYS.handoffRules) ?? DEFAULTS.handoffRules)
  }, [])

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEYS.systemPrompt, systemPrompt)
    localStorage.setItem(STORAGE_KEYS.voicePrompt, voicePrompt)
    localStorage.setItem(STORAGE_KEYS.handoffRules, handoffRules)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const handleReset = (key: keyof typeof DEFAULTS) => {
    if (key === 'systemPrompt') setSystemPrompt(DEFAULTS.systemPrompt)
    if (key === 'voicePrompt') setVoicePrompt(DEFAULTS.voicePrompt)
    if (key === 'handoffRules') setHandoffRules(DEFAULTS.handoffRules)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <Header />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Info banner */}
        <div className="flex items-start gap-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-4 py-3">
          <Info className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm text-indigo-300 font-medium">Stored locally</p>
            <p className="text-xs text-indigo-400/80 mt-0.5">
              These prompts are saved in your browser&apos;s localStorage for reference. To apply
              changes to the live agent, update the system prompts in your backend&apos;s environment
              configuration and restart the service.
            </p>
          </div>
        </div>

        {/* System Prompt */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-600">
            <div>
              <h3 className="text-sm font-semibold text-white">System Prompt</h3>
              <p className="text-xs text-gray-500 mt-0.5">Main instruction for the AI agent</p>
            </div>
            <button
              onClick={() => handleReset('systemPrompt')}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
          <div className="p-5">
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={10}
              className="w-full bg-dark-700 border border-dark-600 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 resize-y font-mono leading-relaxed"
              placeholder="Enter system prompt..."
            />
            <p className="text-xs text-gray-600 mt-1.5">{systemPrompt.length} characters</p>
          </div>
        </div>

        {/* Voice Mode Prompt */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-600">
            <div>
              <h3 className="text-sm font-semibold text-white">Voice Mode Prompt</h3>
              <p className="text-xs text-gray-500 mt-0.5">Additional context when processing voice messages</p>
            </div>
            <button
              onClick={() => handleReset('voicePrompt')}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
          <div className="p-5">
            <textarea
              value={voicePrompt}
              onChange={(e) => setVoicePrompt(e.target.value)}
              rows={7}
              className="w-full bg-dark-700 border border-dark-600 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 resize-y font-mono leading-relaxed"
              placeholder="Enter voice mode prompt..."
            />
            <p className="text-xs text-gray-600 mt-1.5">{voicePrompt.length} characters</p>
          </div>
        </div>

        {/* Handoff Rules */}
        <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-dark-600">
            <div>
              <h3 className="text-sm font-semibold text-white">Handoff Rules</h3>
              <p className="text-xs text-gray-500 mt-0.5">When to escalate to a human agent</p>
            </div>
            <button
              onClick={() => handleReset('handoffRules')}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
          <div className="p-5">
            <textarea
              value={handoffRules}
              onChange={(e) => setHandoffRules(e.target.value)}
              rows={10}
              className="w-full bg-dark-700 border border-dark-600 text-white text-sm rounded-lg px-4 py-3 focus:outline-none focus:border-indigo-500 resize-y font-mono leading-relaxed"
              placeholder="Enter handoff rules..."
            />
            <p className="text-xs text-gray-600 mt-1.5">{handoffRules.length} characters</p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-end gap-3 pb-6">
          {saved && (
            <div className="flex items-center gap-2 text-green-400 text-sm animate-fade-in">
              <CheckCircle className="w-4 h-4" />
              Saved to localStorage
            </div>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            Save Prompts
          </button>
        </div>
      </div>
    </div>
  )
}
