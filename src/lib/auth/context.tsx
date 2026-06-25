'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, Role } from '@/types'
import { getSession, setSession, clearSession } from './session'

interface AuthContextValue {
  session: Session | null
  isLoading: boolean
  login: (role: Role, userId?: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setSessionState(getSession())
    setIsLoading(false)
  }, [])

  const login = useCallback((role: Role, userId?: string) => {
    const s = setSession(role, userId)
    setSessionState(s)
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSessionState(null)
  }, [])

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function useSession(): Session {
  const { session } = useAuth()
  if (!session) throw new Error('No active session')
  return session
}
