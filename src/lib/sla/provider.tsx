'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/lib/auth/context'
import { makeSLARunner } from './mock-runner'

// Mounts a single interval + visibilitychange listener.
// Cleaned up on unmount. Only active for non-client roles.
export function SLAEngineProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth()
  const qc = useQueryClient()

  useEffect(() => {
    if (!session || session.role === 'client') return

    const runner = makeSLARunner()

    const runCheck = async () => {
      const result = await runner.run()
      if (result.fired.length > 0) {
        qc.invalidateQueries({ queryKey: ['cases'] })
        qc.invalidateQueries({ queryKey: ['notifications'] })
      }
    }

    // Run once immediately on mount (catches events from current session)
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
