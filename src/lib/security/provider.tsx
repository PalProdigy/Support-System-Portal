'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/context'
import { runPasswordExpiryCheck } from './password-expiry-runner'

// Mirrors SLAEngineProvider's interval + visibilitychange pattern — checks
// the configured password-expiration date and fires reminder notifications
// as it approaches. Active for any signed-in non-client session.
export function PasswordExpiryProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!session || session.role === 'client') return

    const runCheck = async () => {
      const result = await runPasswordExpiryCheck()
      if (result.notified) qc.invalidateQueries({ queryKey: ['notifications'] })
    }

    runCheck()

    const intervalId = setInterval(runCheck, 60_000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') runCheck()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [session, qc])

  return <>{children}</>
}
