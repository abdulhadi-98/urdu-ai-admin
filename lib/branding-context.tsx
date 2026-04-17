'use client'

import { createContext, useContext } from 'react'

export interface BrandingConfig {
  id?:          string
  orgName:      string
  slug:         string
  agentName:    string
  logoUrl:      string | null
  primaryColor: string
}

export const DEFAULT_BRANDING: BrandingConfig = {
  orgName:      'Discret Digital',
  slug:         'discret',
  agentName:    'Urdu AI Agent',
  logoUrl:      null,
  primaryColor: '#6366f1',
}

export const BrandingContext = createContext<BrandingConfig>(DEFAULT_BRANDING)

export function useBranding(): BrandingConfig {
  return useContext(BrandingContext)
}

/** Convert hex to rgba string */
export function hexToRgba(hex: string, alpha: number): string {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  } catch {
    return `rgba(99,102,241,${alpha})`
  }
}
