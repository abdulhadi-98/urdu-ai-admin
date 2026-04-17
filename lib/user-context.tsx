'use client'

import { createContext, useContext } from 'react'
import type { Role } from '@/lib/roles'

export interface SessionUser {
  id:    string
  email: string
  name:  string
  role:  Role
}

export const UserContext = createContext<SessionUser | null>(null)

export function useUser(): SessionUser | null {
  return useContext(UserContext)
}
