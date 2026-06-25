'use client'

import type { Session, Role } from '@/types'

const SESSION_KEY = 'nhq_session'

// Representative seed users per role for scope-sensitive dashboards
export const ROLE_USER_MAP: Record<Role, string> = {
  client: 'u9',            // Priya Sharma (Acme)
  account_manager: 'u4',   // Tanvir Ahmed
  support_engineer: 'u6',  // Rafi Uddin
  module_lead: 'u2',       // Sadia Islam
  technical_head: 'u1',    // Arif Rahman
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function setSession(role: Role, overrideUserId?: string): Session {
  const userId = overrideUserId ?? ROLE_USER_MAP[role]
  const session: Session = { userId, role }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}
